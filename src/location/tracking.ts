/** A foreground GPS fix. All timestamps use Unix milliseconds. */
export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestampMs: number;
}

export interface TrackingState {
  lastSample: LocationSample | null;
  distanceAnchor: LocationSample | null;
}

export type TrackingReason =
  | 'initial' | 'movement' | 'stationary' | 'gap'
  | 'invalid' | 'inaccurate' | 'stale' | 'out-of-order' | 'unrealistic-speed';

export interface TrackingResult {
  state: TrackingState;
  accepted: boolean;
  reason: TrackingReason;
  distanceMeters: number;
  elapsedSeconds: number;
  speedKmh: number;
}

export const TRACKING_LIMITS = {
  maxAccuracyMeters: 35,
  maxAgeMs: 10_000,
  maxFutureMs: 2_000,
  maxGapMs: 15_000,
  maxSpeedKmh: 180,
  jitterMeters: 3,
} as const;

export function createTrackingState(): TrackingState {
  return { lastSample: null, distanceAnchor: null };
}

export function haversineMeters(
  from: Pick<LocationSample, 'latitude' | 'longitude'>,
  to: Pick<LocationSample, 'latitude' | 'longitude'>,
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians)
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

/**
 * Rejects poor fixes without advancing the trusted state. After a reception gap,
 * a new baseline prevents billing unknown movement or time. Create a fresh state
 * when starting/resuming a trip or returning from the background.
 */
export function processLocation(
  state: TrackingState,
  sample: LocationSample,
  nowMs: number = Date.now(),
): TrackingResult {
  const reject = (reason: TrackingReason): TrackingResult => ({
    state, accepted: false, reason, distanceMeters: 0, elapsedSeconds: 0, speedKmh: 0,
  });
  if (![sample.latitude, sample.longitude, sample.accuracyMeters, sample.timestampMs, nowMs].every(Number.isFinite)
    || Math.abs(sample.latitude) > 90 || Math.abs(sample.longitude) > 180
    || sample.accuracyMeters < 0 || sample.timestampMs < 0
    || sample.timestampMs > nowMs + TRACKING_LIMITS.maxFutureMs) {
    return reject('invalid');
  }
  if (sample.accuracyMeters > TRACKING_LIMITS.maxAccuracyMeters) return reject('inaccurate');
  if (nowMs - sample.timestampMs > TRACKING_LIMITS.maxAgeMs) return reject('stale');
  const previous = state.lastSample;
  if (previous && sample.timestampMs <= previous.timestampMs) return reject('out-of-order');
  const elapsedMs = previous ? sample.timestampMs - previous.timestampMs : 0;
  const fix = { ...sample };
  if (!previous || elapsedMs > TRACKING_LIMITS.maxGapMs) {
    return {
      state: { lastSample: fix, distanceAnchor: fix },
      accepted: true, reason: previous ? 'gap' : 'initial',
      distanceMeters: 0, elapsedSeconds: 0, speedKmh: 0,
    };
  }
  const elapsedSeconds = elapsedMs / 1000;
  const segmentMeters = haversineMeters(previous, sample);
  if (segmentMeters / elapsedSeconds * 3.6 > TRACKING_LIMITS.maxSpeedKmh) {
    return reject('unrealistic-speed');
  }
  // Keep the spatial anchor through small fluctuations so slow movement can
  // eventually cross the deadband rather than being discarded every second.
  const anchor = state.distanceAnchor ?? previous;
  const distanceMeters = haversineMeters(anchor, sample);
  const moving = distanceMeters >= TRACKING_LIMITS.jitterMeters;
  const anchorElapsedSeconds = (sample.timestampMs - anchor.timestampMs) / 1000;
  return {
    state: { lastSample: fix, distanceAnchor: moving ? fix : anchor },
    accepted: true,
    reason: moving ? 'movement' : 'stationary',
    distanceMeters: moving ? distanceMeters : 0,
    elapsedSeconds,
    speedKmh: moving ? distanceMeters / anchorElapsedSeconds * 3.6 : 0,
  };
}
