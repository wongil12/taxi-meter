import assert from 'node:assert/strict';
import test from 'node:test';
import { initialNativeSnapshot, parseNativeSnapshot, importNativeTrips } from './nativeMeter';
const trip = { id: 'native-trip', startedAt: '2026-10-07T01:00:00.000Z', endedAt: '2026-10-07T01:02:00.000Z', durationSeconds: 120, distanceMeters: 50, fare: 4800 };
test('native payload preserves pending receipts and rejects invalid fare', () => {
  const value = { ...initialNativeSnapshot(), pendingTrips: [trip], completedTrip: trip };
  assert.deepEqual(parseNativeSnapshot(value).pendingTrips, [trip]);
  assert.throws(() => parseNativeSnapshot({ ...value, fare: NaN }));
  assert.throws(() => parseNativeSnapshot({ ...value, pendingTrips: [{ ...trip, distanceMeters: -1 }] }));
});
test('native receipt is acknowledged only after durable history save', async () => {
  const calls: string[] = [];
  await importNativeTrips([trip], async () => { calls.push('save'); return true; }, async ids => { calls.push(`ack:${ids[0]}`); });
  assert.deepEqual(calls, ['save', 'ack:native-trip']);
});
test('failed save leaves native receipt available for retry', async () => {
  let acknowledged = false;
  await importNativeTrips([trip], async () => false, async () => { acknowledged = true; });
  assert.equal(acknowledged, false);
});
test('failed acknowledgement propagates and retains retry opportunity', async () => {
  await assert.rejects(importNativeTrips([trip], async () => true, async () => { throw new Error('bridge interrupted'); }));
});

test('new native snapshot defaults to log while missing legacy mode remains taxi', () => {
  const initial = initialNativeSnapshot();
  assert.equal(initial.mode, 'log');
  assert.equal(initial.fare, 0);
  assert.equal(parseNativeSnapshot(initial).mode, 'log');
  const { mode: _, ...legacy } = initial;
  assert.equal(parseNativeSnapshot({ ...legacy, status: 'paused', fare: 4800 }).mode, 'taxi');
  assert.throws(() => parseNativeSnapshot({ ...initial, mode: 'invalid' }));
});

test('native log trip mode survives completed trip and pending outbox transfer', () => {
  const logged = { ...trip, mode: 'log' as const, fare: 0 };
  const parsed = parseNativeSnapshot({ ...initialNativeSnapshot(), status: 'finished',
    completedTrip: logged, pendingTrips: [logged] });
  assert.equal(parsed.completedTrip?.mode, 'log');
  assert.equal(parsed.pendingTrips[0].fare, 0);
});
