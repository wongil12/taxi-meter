/** A foreground GPS fix. All timestamps use Unix milliseconds. */
export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestampMs: number;
  /** Core Location / Android fused location speed, in m/s; negative means unavailable. */
  speedMetersPerSecond?: number | null;
}

export interface TrackingState {
  lastSample: LocationSample | null;
  distanceAnchor: LocationSample | null;
  speedWindow: LocationSample[];
  nativeSpeeds: { metersPerSecond: number; timestampMs: number }[];
  displaySpeedKmh: number | null;
}

export type TrackingReason =
  | 'initial' | 'movement' | 'stationary' | 'gap' | 'position-noise'
  | 'invalid' | 'inaccurate' | 'stale' | 'out-of-order' | 'unrealistic-speed';

export interface TrackingResult {
  state: TrackingState;
  accepted: boolean;
  reason: TrackingReason;
  distanceMeters: number;
  elapsedSeconds: number;
  /** Filtered measurement for the fare threshold; null is not a stationary reading. */
  speedKmh: number | null;
  displaySpeedKmh: number | null;
}

export const TRACKING_LIMITS = {
  maxAccuracyMeters: 35,
  maxAgeMs: 4_000,
  maxFutureMs: 2_000,
  maxGapMs: 15_000,
  maxSpeedKmh: 180,
  jitterMeters: 3,
  speedExpiryMs: 4_000,
  speedWindowMs: 5_000,
  minimumSpeedWindowMs: 3_000,
} as const;

export function createTrackingState(): TrackingState {
  return { lastSample: null, distanceAnchor: null, speedWindow: [], nativeSpeeds: [], displaySpeedKmh: null };
}

function nativeSpeed(sample: LocationSample): number | null {
  const speed = sample.speedMetersPerSecond;
  return typeof speed === 'number' && Number.isFinite(speed) && speed >= 0
    && speed * 3.6 <= TRACKING_LIMITS.maxSpeedKmh ? speed : null;
}

function measureSpeed(state: TrackingState, sample: LocationSample) {
  const speedWindow = [...state.speedWindow, sample]
    .filter(fix => sample.timestampMs - fix.timestampMs <= TRACKING_LIMITS.speedWindowMs);
  const native = nativeSpeed(sample);
  const nativeSpeeds = native === null ? [] : [...state.nativeSpeeds, {
    metersPerSecond: native, timestampMs: sample.timestampMs,
  }].filter(fix => sample.timestampMs - fix.timestampMs <= TRACKING_LIMITS.speedExpiryMs).slice(-3);
  let speedKmh: number | null = null;
  if (native !== null) {
    // A genuine zero must never fall back to coordinate drift. Snap to rest
    // immediately; median filtering removes isolated spikes while moving.
    if (native <= 0.5) {
      speedKmh = 0;
      nativeSpeeds.splice(0, nativeSpeeds.length, { metersPerSecond: 0, timestampMs: sample.timestampMs });
    } else if (nativeSpeeds.length === 3) {
      speedKmh = [...nativeSpeeds].sort((a, b) => a.metersPerSecond - b.metersPerSecond)[1].metersPerSecond * 3.6;
    } else {
      const previous = nativeSpeeds.at(-2);
      const seconds = previous ? (sample.timestampMs - previous.timestampMs) / 1000 : 0;
      const suddenChange = previous && seconds > 0 && Math.abs(native - previous.metersPerSecond) / seconds > 8;
      speedKmh = (suddenChange ? previous.metersPerSecond : native) * 3.6;
    }
  } else {
    // Coordinate fallback uses a recent time window, never the distance anchor
    // that can include a long stationary period. Ambiguous motion stays unknown.
    const first = speedWindow[0];
    const duration = sample.timestampMs - first.timestampMs;
    const displacement = haversineMeters(first, sample);
    const uncertainty = Math.max(TRACKING_LIMITS.jitterMeters, first.accuracyMeters + sample.accuracyMeters);
    if (duration >= TRACKING_LIMITS.minimumSpeedWindowMs && displacement > uncertainty) {
      const estimate = displacement / (duration / 1000) * 3.6;
      if (estimate <= TRACKING_LIMITS.maxSpeedKmh) speedKmh = estimate;
    }
  }
  const seconds = state.lastSample ? (sample.timestampMs - state.lastSample.timestampMs) / 1000 : 0;
  const alpha = 1 - Math.exp(-seconds / 1.5);
  const displaySpeedKmh = speedKmh === null || speedKmh === 0 || state.displaySpeedKmh === null
    ? speedKmh : state.displaySpeedKmh + alpha * (speedKmh - state.displaySpeedKmh);
  return { speedWindow, nativeSpeeds, speedKmh, displaySpeedKmh };
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
    state, accepted: false, reason, distanceMeters: 0, elapsedSeconds: 0, speedKmh: null, displaySpeedKmh: null,
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
    const measured = measureSpeed(createTrackingState(), fix);
    return {
      state: { lastSample: fix, distanceAnchor: fix, ...measured },
      accepted: true, reason: previous ? 'gap' : 'initial',
      distanceMeters: 0, elapsedSeconds: 0, speedKmh: measured.speedKmh, displaySpeedKmh: measured.displaySpeedKmh,
    };
  }
  const elapsedSeconds = elapsedMs / 1000;
  const segmentMeters = haversineMeters(previous, sample);
  const segmentLimit = TRACKING_LIMITS.maxSpeedKmh / 3.6 * elapsedSeconds;
  if (segmentMeters > segmentLimit + previous.accuracyMeters + sample.accuracyMeters) {
    return reject('unrealistic-speed');
  }
  const positionNoise = segmentMeters > segmentLimit;
  // Keep the spatial anchor through small fluctuations so slow movement can
  // eventually cross the deadband rather than being discarded every second.
  const anchor = state.distanceAnchor ?? previous;
  const distanceMeters = haversineMeters(anchor, sample);
  const measured = measureSpeed(state, fix);
  const native = nativeSpeed(fix);
  const stationary = native !== null && native <= 0.5;
  const deadband = Math.max(TRACKING_LIMITS.jitterMeters, anchor.accuracyMeters + fix.accuracyMeters);
  const moving = !stationary && !positionNoise && distanceMeters >= deadband;
  return {
    state: { lastSample: fix, distanceAnchor: moving || stationary || positionNoise ? fix : anchor, ...measured },
    accepted: true,
    reason: positionNoise ? 'position-noise' : moving ? 'movement' : 'stationary',
    distanceMeters: moving ? distanceMeters : 0,
    elapsedSeconds,
    speedKmh: measured.speedKmh,
    displaySpeedKmh: measured.displaySpeedKmh,
  };
}
