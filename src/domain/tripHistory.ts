import { DEFAULT_RECEIPT_KEYWORD, receiptCompanyName } from './receiptSettings';
import { formatDuration, formatFare } from './meter';

export interface TripRecord {
  readonly mode?: 'log' | 'taxi';
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationSeconds: number;
  readonly distanceMeters: number;
  readonly fare: number;
}

export const TRIP_HISTORY_LIMIT = 100;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string') throw new Error('주행 날짜가 올바르지 않습니다.');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) throw new Error('주행 날짜가 올바르지 않습니다.');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) {
    throw new Error('주행 날짜가 올바르지 않습니다.');
  }
  return new Date(value).toISOString();
}

function metric(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} 값이 올바르지 않습니다.`);
  }
  return value;
}

function validateRecord(input: unknown): TripRecord {
  if (!object(input) || typeof input.id !== 'string' || !input.id.trim()) {
    throw new Error('주행 기록 식별자가 올바르지 않습니다.');
  }
  const startedAt = timestamp(input.startedAt);
  const endedAt = timestamp(input.endedAt);
  if (Date.parse(endedAt) < Date.parse(startedAt)) throw new Error('종료 시각은 시작 시각보다 빠를 수 없습니다.');
  if (input.mode !== undefined && input.mode !== 'log' && input.mode !== 'taxi') throw new Error('운행 종류가 올바르지 않습니다.');
  const fare = metric(input.fare, '요금');
  if (input.mode === 'log' && fare !== 0) throw new Error('운행 기록에는 요금이 없어야 합니다.');
  return Object.freeze({
    ...(input.mode === undefined ? {} : { mode: input.mode }),
    id: input.id,
    startedAt,
    endedAt,
    durationSeconds: metric(input.durationSeconds, '주행 시간'),
    distanceMeters: metric(input.distanceMeters, '주행 거리'),
    fare,
  });
}

/** Returns a detached, immutable record with canonical ISO timestamps. */
export function createTripRecord(input: TripRecord): TripRecord {
  return validateRecord(input);
}

function newestFirst(a: TripRecord, b: TripRecord): number {
  return Date.parse(b.endedAt) - Date.parse(a.endedAt) || a.id.localeCompare(b.id);
}

/** Existing duplicate IDs keep their newest record; the incoming record wins its ID. */
export function upsertTripHistory(records: readonly TripRecord[], record: TripRecord): TripRecord[] {
  const validated = records.map(validateRecord).sort(newestFirst);
  const unique = new Map<string, TripRecord>();
  for (const existing of validated) {
    if (!unique.has(existing.id)) unique.set(existing.id, existing);
  }
  const incoming = validateRecord(record);
  unique.set(incoming.id, incoming);
  return [...unique.values()].sort(newestFirst).slice(0, TRIP_HISTORY_LIMIT);
}

function validateHistory(records: unknown): TripRecord[] {
  if (!Array.isArray(records) || records.length > TRIP_HISTORY_LIMIT) {
    throw new Error('저장된 주행 기록 목록이 올바르지 않습니다.');
  }
  const validated = records.map(validateRecord);
  if (new Set(validated.map(record => record.id)).size !== validated.length) {
    throw new Error('저장된 주행 기록에 중복 식별자가 있습니다.');
  }
  return validated.sort(newestFirst);
}

/** Only absent storage means empty. Corrupt or unknown-version data must be surfaced. */
export function parseTripHistory(json: string | null): TripRecord[] {
  if (json === null) return [];
  const parsed: unknown = JSON.parse(json);
  if (!object(parsed) || parsed.version !== 1) throw new Error('지원하지 않는 주행 기록 형식입니다.');
  return validateHistory(parsed.records);
}

export function serializeTripHistory(records: readonly TripRecord[]): string {
  return JSON.stringify({ version: 1, records: validateHistory(records) });
}

export function formatTripReceipt(input: TripRecord, keyword = DEFAULT_RECEIPT_KEYWORD): string {
  const record = validateRecord(input);
  const date = (value: string) => new Date(value).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return [
    record.mode === 'log' ? '운행 기록' : '택시 미터 · 주행 영수증',
    '',
    `출발: ${date(record.startedAt)}`,
    `도착: ${date(record.endedAt)}`,
    `주행 시간: ${formatDuration(record.durationSeconds)}`,
    `이동 거리: ${(record.distanceMeters / 1000).toFixed(2)} km`,
    ...(record.mode === 'log' ? [] : [`요금: ${formatFare(record.fare)}원`, '', receiptCompanyName(keyword)]),
  ].join('\n');
}


export type TripModeFilter = 'all' | 'log' | 'taxi';

export function filterTripHistory(records: readonly TripRecord[], mode: TripModeFilter): TripRecord[] {
  return records.filter(record => mode === 'all' || (record.mode ?? 'taxi') === mode);
}

/** Saved records ending in the device-local month; does not imply a complete driving total. */
export function monthlyTripSummary(records: readonly TripRecord[], month = new Date(), mode: TripModeFilter = 'all') {
  const filtered = filterTripHistory(records, mode).filter(record => {
    const ended = new Date(record.endedAt);
    return ended.getFullYear() === month.getFullYear() && ended.getMonth() === month.getMonth();
  });
  return filtered.reduce((sum, trip) => ({ count: sum.count + 1,
    distanceMeters: sum.distanceMeters + trip.distanceMeters,
    durationSeconds: sum.durationSeconds + trip.durationSeconds,
  }), { count: 0, distanceMeters: 0, durationSeconds: 0 });
}
