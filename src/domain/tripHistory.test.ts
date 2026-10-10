import assert from 'node:assert/strict';
import test from 'node:test';
import { createTripRecord, filterTripHistory, monthlyTripSummary, formatTripReceipt, parseTripHistory, serializeTripHistory, upsertTripHistory, type TripRecord } from './tripHistory';

const record = (overrides: Partial<TripRecord> = {}): TripRecord => ({
  id: 'trip-1', startedAt: '2026-10-07T01:00:00.000Z', endedAt: '2026-10-07T01:10:00.000Z',
  durationSeconds: 600, distanceMeters: 2000, fare: 5100, ...overrides,
});

test('records are detached and immutable and zero metrics survive serialization', () => {
  const input = record({ durationSeconds: 0, distanceMeters: 0, fare: 0 });
  const result = createTripRecord(input);
  assert.notEqual(result, input);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(parseTripHistory(serializeTripHistory([result])), [result]);
  assert.deepEqual(parseTripHistory(null), []);
});

test('ISO offsets normalize and invalid dates, ordering and metrics fail validation', () => {
  assert.equal(createTripRecord(record({ startedAt: '2026-10-07T10:00:00+09:00' })).startedAt, '2026-10-07T01:00:00.000Z');
  for (const startedAt of ['2026-02-30T00:00:00Z', '2026-13-01T00:00:00Z', '2026-10-07', '2026-10-07T24:00:00Z']) {
    assert.throws(() => createTripRecord(record({ startedAt })));
  }
  assert.throws(() => createTripRecord(record({ endedAt: '2026-10-07T00:00:00Z' })));
  assert.throws(() => createTripRecord(record({ id: '  ' })));
  for (const value of [-1, NaN, Infinity]) {
    for (const field of ['durationSeconds', 'distanceMeters', 'fare'] as const) {
      assert.throws(() => createTripRecord(record({ [field]: value })));
    }
  }
});

test('upsert sorts newest first, replaces matching IDs and does not mutate input', () => {
  const old = record({ id: 'old', endedAt: '2026-10-07T01:01:00Z' });
  const current = record();
  const records = [old, current];
  const result = upsertTripHistory(records, record({ fare: 9900 }));
  assert.deepEqual(result.map(item => item.id), ['trip-1', 'old']);
  assert.equal(result[0].fare, 9900);
  assert.equal(records[1].fare, 5100);
  assert.equal(records[0], old);
  const duplicate = upsertTripHistory([current, record({ endedAt: '2026-10-07T01:20:00Z', fare: 7000 })], old);
  assert.equal(duplicate.length, 2);
  assert.equal(duplicate[0].fare, 7000);
});

test('history retains only the latest 100 records', () => {
  const records = Array.from({ length: 100 }, (_, index) => record({
    id: `trip-${index}`, endedAt: new Date(Date.parse('2026-10-07T01:00:00Z') + index * 1000).toISOString(),
  }));
  const result = upsertTripHistory(records, record({ id: 'newest' }));
  assert.equal(result.length, 100);
  assert.equal(result[0].id, 'newest');
  assert.ok(!result.some(item => item.id === 'trip-0'));
});

test('corrupt storage is never interpreted as an empty or partial history', () => {
  const invalid = ['', '{', 'null', '[]', '{}', '{"version":2,"records":[]}',
    JSON.stringify({ version: 1, records: [record(), { fare: 100 }] }),
    JSON.stringify({ version: 1, records: [record(), record()] }),
    JSON.stringify({ version: 1, records: [record({ fare: null as unknown as number })] }),
  ];
  for (const json of invalid) assert.throws(() => parseTripHistory(json));
  assert.throws(() => serializeTripHistory([record(), record()]));
  assert.throws(() => serializeTripHistory([record({ distanceMeters: NaN })]));
});

test('receipt shares Korean trip details without claims about payment', () => {
  const receipt = formatTripReceipt(record());
  assert.match(receipt, /^택시 미터 · 주행 영수증/);
  assert.match(receipt, /주행 시간: 00:10:00/);
  assert.match(receipt, /이동 거리: 2\.00 km/);
  assert.match(receipt, /요금: 5,100원/);
  assert.match(receipt, /우리운수$/);
  assert.doesNotMatch(receipt, /결제 완료|승인번호|사업자|가상 요금|재미로/);
  assert.match(formatTripReceipt(record({ distanceMeters: 0, durationSeconds: 0, fare: 0 })), /요금: 0원/);
});

test('receipt uses the configured company keyword for text sharing', () => {
  assert.match(formatTripReceipt(record(), '우정'), /우정운수$/);
  assert.doesNotMatch(formatTripReceipt(record(), '우정'), /안전 운전/);
});

test('mode preserves old taxi records and serializes logs with zero fare only', () => {
  const legacy = createTripRecord(record());
  assert.equal(legacy.mode, undefined);
  const log = createTripRecord(record({ mode: 'log', fare: 0 }));
  assert.equal(parseTripHistory(serializeTripHistory([log]))[0].mode, 'log');
  assert.throws(() => createTripRecord(record({ mode: 'log', fare: 100 })));
  assert.throws(() => createTripRecord(record({ mode: 'other' as 'log' })));
  const receipt = formatTripReceipt(log, '우정');
  assert.match(receipt, /^운행 기록/);
  assert.doesNotMatch(receipt, /요금|운수|영수증|택시/);
  assert.match(receipt, /이동 거리: 2.00 km/);
});


test('monthly summary uses local completion month and preserves mode filters', () => {
  const localISO = (month: number, day: number) => new Date(2026, month, day, 12).toISOString();
  const trips = [
    record({ id: 'legacy', startedAt: localISO(9, 1), endedAt: localISO(9, 1) }),
    record({ id: 'log', mode: 'log', fare: 0, startedAt: localISO(9, 2), endedAt: localISO(9, 2), distanceMeters: 500 }),
    record({ id: 'previous', mode: 'log', fare: 0, startedAt: localISO(8, 30), endedAt: localISO(8, 30) }),
  ];
  const month = new Date(2026, 9, 9);
  assert.deepEqual(monthlyTripSummary(trips, month), { count: 2, distanceMeters: 2500, durationSeconds: 1200 });
  assert.deepEqual(monthlyTripSummary(trips, month, 'log'), { count: 1, distanceMeters: 500, durationSeconds: 600 });
  assert.deepEqual(monthlyTripSummary([], month), { count: 0, distanceMeters: 0, durationSeconds: 0 });
  assert.deepEqual(filterTripHistory(trips, 'taxi').map(trip => trip.id), ['legacy']);
  assert.equal(filterTripHistory(trips, 'all').length, 3);
});
