import type { MeterStatus, TripMode } from './meter';
export type TripEntry = 'open' | 'current' | 'blocked' | 'reset' | 'unsaved';
export function tripEntry(status: MeterStatus, current: TripMode, requested: TripMode, saved: boolean): TripEntry {
  if (status === 'idle') return 'open';
  if (status === 'finished') return saved ? 'reset' : 'unsaved';
  return current === requested ? 'current' : 'blocked';
}
