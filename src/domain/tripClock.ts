/** Separate from GPS billing time; timestamps come from performance.now(). */
export interface TripClock {
  accumulatedMs: number;
  runningSinceMs: number | null;
}

export function createTripClock(): TripClock {
  return { accumulatedMs: 0, runningSinceMs: null };
}

function elapsedMs(clock: TripClock, nowMs: number): number {
  return clock.accumulatedMs + (clock.runningSinceMs === null
    ? 0
    : Math.max(0, nowMs - clock.runningSinceMs));
}

/** Repeated start/resume calls preserve the original start instant. */
export function resumeTripClock(clock: TripClock, nowMs: number): TripClock {
  return clock.runningSinceMs === null ? { ...clock, runningSinceMs: nowMs } : clock;
}

/** Retains fractional seconds so repeated pauses cannot lose active time. */
export function pauseTripClock(clock: TripClock, nowMs: number): TripClock {
  return clock.runningSinceMs === null
    ? clock
    : { accumulatedMs: elapsedMs(clock, nowMs), runningSinceMs: null };
}

/** Derive from elapsed monotonic time, never the number of timer callbacks. */
export function getTripElapsedSeconds(clock: TripClock, nowMs: number): number {
  return Math.floor(elapsedMs(clock, nowMs) / 1000);
}
