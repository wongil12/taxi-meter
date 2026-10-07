import assert from 'node:assert/strict';
import test from 'node:test';
import { createTrackingState, haversineMeters, processLocation, type LocationSample } from './tracking';

const time = 1_000_000;
const sample = (changes: Partial<LocationSample> = {}): LocationSample => ({
  latitude: 37.5, longitude: 127, accuracyMeters: 5, timestampMs: time, ...changes,
});
const first = () => processLocation(createTrackingState(), sample(), time).state;

test('haversine handles identical locations and the date line', () => {
  assert.equal(haversineMeters(sample(), sample()), 0);
  const distance = haversineMeters({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 });
  assert.ok(distance > 222 && distance < 223);
});

test('first fix establishes a baseline and ordinary movement produces distance/time', () => {
  const initial = processLocation(createTrackingState(), sample(), time);
  assert.equal(initial.reason, 'initial');
  assert.equal(initial.elapsedSeconds, 0);
  const next = processLocation(initial.state, sample({ latitude: 37.5001, timestampMs: time + 2000 }), time + 2000);
  assert.equal(next.reason, 'movement');
  assert.equal(next.elapsedSeconds, 2);
  assert.ok(next.distanceMeters > 11 && next.distanceMeters < 12);
  assert.ok(next.speedKmh > 19 && next.speedKmh < 21);
});

test('rejects invalid, imprecise, stale and repeated fixes without moving the state', () => {
  const state = first();
  const cases = [
    [sample({ latitude: NaN }), time, 'invalid'],
    [sample({ longitude: 181 }), time, 'invalid'],
    [sample({ accuracyMeters: -1 }), time, 'invalid'],
    [sample({ timestampMs: time + 3000 }), time, 'invalid'],
    [sample({ accuracyMeters: 100 }), time, 'inaccurate'],
    [sample(), time + 11000, 'stale'],
    [sample(), time, 'out-of-order'],
  ] as const;
  for (const [fix, now, reason] of cases) {
    const result = processLocation(state, fix, now);
    assert.equal(result.accepted, false);
    assert.equal(result.reason, reason);
    assert.equal(result.state, state);
    assert.equal(result.distanceMeters, 0);
    assert.equal(result.elapsedSeconds, 0);
  }
});

test('GPS teleportation is rejected, then a valid nearby fix recovers', () => {
  const state = first();
  const jump = processLocation(state, sample({ latitude: 38, timestampMs: time + 1000 }), time + 1000);
  assert.equal(jump.reason, 'unrealistic-speed');
  const recovery = processLocation(jump.state, sample({ latitude: 37.5001, timestampMs: time + 2000 }), time + 2000);
  assert.equal(recovery.accepted, true);
  assert.ok(recovery.distanceMeters < 12);
});

test('reception gaps reset the baseline and never bill missing distance/time', () => {
  const gap = processLocation(first(), sample({ latitude: 38, timestampMs: time + 16000 }), time + 16000);
  assert.equal(gap.reason, 'gap');
  assert.equal(gap.distanceMeters, 0);
  assert.equal(gap.elapsedSeconds, 0);
  const next = processLocation(gap.state, sample({ latitude: 38.0001, timestampMs: time + 18000 }), time + 18000);
  assert.ok(next.distanceMeters < 12);
});

test('stationary jitter is suppressed while gradual movement eventually counts', () => {
  let state = first();
  const jitter = processLocation(state, sample({ latitude: 37.50001, timestampMs: time + 1000 }), time + 1000);
  assert.equal(jitter.reason, 'stationary');
  assert.equal(jitter.elapsedSeconds, 1);
  assert.equal(jitter.distanceMeters, 0);
  state = jitter.state;
  const moved = processLocation(state, sample({ latitude: 37.50003, timestampMs: time + 3000 }), time + 3000);
  assert.equal(moved.reason, 'movement');
  assert.ok(moved.distanceMeters > 3 && moved.distanceMeters < 4);
  assert.ok(moved.speedKmh > 3 && moved.speedKmh < 5);
});
