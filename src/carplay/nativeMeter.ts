import { createMeterState, type MeterState, type MeterStatus, type TripMode } from '../domain/meter';
import { createTripRecord, type TripRecord } from '../domain/tripHistory';

export interface NativeMeterSnapshot {
  mode: TripMode;
  revision: number;
  status: MeterStatus;
  fare: number;
  totalDistanceMeters: number;
  chargeableDistanceMeters: number;
  lowSpeedSeconds: number;
  elapsedSeconds: number;
  speedKmh: number | null;
  gpsMessage: string;
  busy: boolean;
  carPlayConnected: boolean;
  completedTrip: TripRecord | null;
  pendingTrips: TripRecord[];
}

export interface NativeTaxiCarPlay {
  getSnapshot(): Promise<NativeMeterSnapshot>;
  begin(mode?: TripMode): Promise<NativeMeterSnapshot>;
  pause(): Promise<NativeMeterSnapshot>;
  finish(): Promise<NativeMeterSnapshot>;
  reset(): Promise<NativeMeterSnapshot>;
  acknowledgeTrips(ids: string[]): Promise<NativeMeterSnapshot>;
  addListener(event: 'onStateChange', listener: (snapshot: NativeMeterSnapshot) => void): { remove(): void };
}

export function initialNativeSnapshot(): NativeMeterSnapshot {
  return { ...createMeterState({}, 'log'), revision: 0, speedKmh: null, gpsMessage: '시작하면 위치 접근 권한을 요청합니다.',
    busy: false, carPlayConnected: false, completedTrip: null, pendingTrips: [] };
}

/** Reject malformed bridge payloads instead of displaying invalid fares or losing a receipt. */
export function parseNativeSnapshot(value: unknown): NativeMeterSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid native meter snapshot');
  const raw = value as Record<string, unknown>;
  const mode = raw.mode === undefined ? 'taxi' : raw.mode;
  if (mode !== 'log' && mode !== 'taxi') throw new Error('Invalid native trip mode');
  if (!['idle', 'running', 'paused', 'finished'].includes(String(raw.status))
    || typeof raw.gpsMessage !== 'string' || typeof raw.busy !== 'boolean'
    || typeof raw.carPlayConnected !== 'boolean' || !Array.isArray(raw.pendingTrips)) {
    throw new Error('Invalid native meter state');
  }
  const metric = (key: string): number => {
    const number = raw[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0) throw new Error(`Invalid ${key}`);
    return number;
  };
  return {
    mode,
    revision: metric('revision'),
    status: raw.status as MeterStatus,
    fare: metric('fare'), totalDistanceMeters: metric('totalDistanceMeters'),
    chargeableDistanceMeters: metric('chargeableDistanceMeters'), lowSpeedSeconds: metric('lowSpeedSeconds'),
    elapsedSeconds: metric('elapsedSeconds'), speedKmh: raw.speedKmh == null ? null : metric('speedKmh'),
    gpsMessage: raw.gpsMessage, busy: raw.busy, carPlayConnected: raw.carPlayConnected,
    completedTrip: raw.completedTrip == null ? null : createTripRecord(raw.completedTrip as TripRecord),
    pendingTrips: raw.pendingTrips.map(trip => createTripRecord(trip as TripRecord)),
  };
}

export function nativeMeterState(snapshot: NativeMeterSnapshot): MeterState {
  return { ...createMeterState(), mode: snapshot.mode, status: snapshot.status, fare: snapshot.fare,
    elapsedSeconds: snapshot.elapsedSeconds, totalDistanceMeters: snapshot.totalDistanceMeters,
    chargeableDistanceMeters: snapshot.chargeableDistanceMeters, lowSpeedSeconds: snapshot.lowSpeedSeconds };
}

/** Native storage is acknowledged only after the existing history store durably saves a trip. */
export async function importNativeTrips(
  trips: readonly TripRecord[],
  save: (trip: TripRecord) => Promise<boolean>,
  acknowledge: (ids: string[]) => Promise<void>,
): Promise<void> {
  for (const trip of trips) {
    if (!await save(trip)) return;
    await acknowledge([trip.id]);
  }
}
