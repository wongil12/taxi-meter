/** Illustrative game rules only; these are not an official taxi tariff. */
export interface MeterConfig {
  baseFare: number;
  baseDistanceMeters: number;
  distanceUnitMeters: number;
  distanceUnitFare: number;
  lowSpeedThresholdKmh: number;
  timeUnitSeconds: number;
  timeUnitFare: number;
}

export const DEFAULT_METER_CONFIG: Readonly<MeterConfig> = Object.freeze({
  baseFare: 4800,
  baseDistanceMeters: 1600,
  distanceUnitMeters: 131,
  distanceUnitFare: 100,
  lowSpeedThresholdKmh: 15,
  timeUnitSeconds: 30,
  timeUnitFare: 100,
});

export type MeterStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface MeterState {
  status: MeterStatus;
  config: Readonly<MeterConfig>;
  /** Active trip time, excluding pauses. */
  elapsedSeconds: number;
  totalDistanceMeters: number;
  /** Only distance traveled above the threshold after the base distance. */
  chargeableDistanceMeters: number;
  /** Only time at or below the threshold after the base distance. */
  lowSpeedSeconds: number;
  fare: number;
}

export type MeterAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'finish' }
  | { type: 'reset' }
  | {
      type: 'tick';
      elapsedSeconds: number;
      distanceMeters: number;
      /** Omit to infer average speed from this tick's distance and duration. */
      speedKmh?: number;
    };

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number`);
  }
}

export function createMeterState(config: Partial<MeterConfig> = {}): MeterState {
  const resolved = { ...DEFAULT_METER_CONFIG, ...config };
  for (const [key, value] of Object.entries(resolved)) nonNegative(value, key);
  if (resolved.distanceUnitMeters === 0 || resolved.timeUnitSeconds === 0) {
    throw new RangeError('Billing units must be greater than zero');
  }
  return {
    status: 'idle',
    config: Object.freeze(resolved),
    elapsedSeconds: 0,
    totalDistanceMeters: 0,
    chargeableDistanceMeters: 0,
    lowSpeedSeconds: 0,
    fare: 0,
  };
}

/** A full billing unit must accrue before it is charged. */
export function calculateFare(state: MeterState): number {
  if (state.status === 'idle') return 0;
  const { config } = state;
  return (
    config.baseFare +
    Math.floor((state.chargeableDistanceMeters + 1e-9) / config.distanceUnitMeters) *
      config.distanceUnitFare +
    Math.floor((state.lowSpeedSeconds + 1e-9) / config.timeUnitSeconds) *
      config.timeUnitFare
  );
}

/**
 * Pure state machine. Invalid lifecycle transitions are harmless no-ops.
 * Each tick represents one uniform-speed interval. Split a sample if its speed
 * crosses the threshold. Distance and time are NEVER charged for the same tick.
 * The initial base distance includes all travel; time is free until it is used.
 * A tick crossing that boundary bills only its proportional remaining duration.
 */
export function meterReducer(state: MeterState, action: MeterAction): MeterState {
  switch (action.type) {
    case 'start':
      return state.status === 'idle'
        ? { ...state, status: 'running', fare: state.config.baseFare }
        : state;
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'running' } : state;
    case 'finish':
      return state.status === 'running' || state.status === 'paused'
        ? { ...state, status: 'finished' }
        : state;
    case 'reset':
      return createMeterState(state.config);
    case 'tick': {
      nonNegative(action.elapsedSeconds, 'elapsedSeconds');
      nonNegative(action.distanceMeters, 'distanceMeters');
      if (action.speedKmh !== undefined) nonNegative(action.speedKmh, 'speedKmh');
      if (action.elapsedSeconds === 0 && action.distanceMeters > 0) {
        throw new RangeError('Distance cannot accrue in a zero-duration tick');
      }
      if (state.status !== 'running' || action.elapsedSeconds === 0) return state;

      const speed = action.speedKmh ?? (action.distanceMeters / action.elapsedSeconds) * 3.6;
      const remainingBase = Math.max(0, state.config.baseDistanceMeters - state.totalDistanceMeters);
      const extraDistance = Math.max(0, action.distanceMeters - remainingBase);
      const chargeableFraction = remainingBase === 0
        ? 1
        : action.distanceMeters > 0 ? extraDistance / action.distanceMeters : 0;
      const lowSpeed = speed <= state.config.lowSpeedThresholdKmh;
      const next: MeterState = {
        ...state,
        elapsedSeconds: state.elapsedSeconds + action.elapsedSeconds,
        totalDistanceMeters: state.totalDistanceMeters + action.distanceMeters,
        chargeableDistanceMeters: state.chargeableDistanceMeters + (lowSpeed ? 0 : extraDistance),
        lowSpeedSeconds: state.lowSpeedSeconds + (lowSpeed ? action.elapsedSeconds * chargeableFraction : 0),
      };
      next.fare = calculateFare(next);
      return next;
    }
  }
}

export function formatFare(fare: number): string {
  nonNegative(fare, 'fare');
  return Math.round(fare).toLocaleString('ko-KR');
}

export function formatDuration(seconds: number): string {
  nonNegative(seconds, 'seconds');
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
}
