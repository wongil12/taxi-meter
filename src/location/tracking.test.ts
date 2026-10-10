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
  const next = processLocation(initial.state, sample({ latitude: 37.5001, speedMetersPerSecond: 5.56, timestampMs: time + 2000 }), time + 2000);
  assert.equal(next.reason, 'movement');
  assert.equal(next.elapsedSeconds, 2);
  assert.ok(next.distanceMeters > 11 && next.distanceMeters < 12);
  assert.ok(next.speedKmh !== null && next.speedKmh > 19 && next.speedKmh < 21);
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
  const moved = processLocation(state, sample({ latitude: 37.5001, speedMetersPerSecond: 1, timestampMs: time + 11000 }), time + 11000);
  assert.equal(moved.reason, 'movement');
  assert.ok(moved.distanceMeters > 11 && moved.distanceMeters < 12);
  assert.ok(moved.speedKmh !== null && moved.speedKmh > 3 && moved.speedKmh < 5);
});

test('native speed is available on the first fix without adding fare distance or time', () => {
  const result = processLocation(createTrackingState(), sample({ speedMetersPerSecond: 20 }), time);
  assert.equal(result.speedKmh, 72);
  assert.equal(result.displaySpeedKmh, 72);
  assert.equal(result.distanceMeters, 0);
  assert.equal(result.elapsedSeconds, 0);
});

test('native stationary speed suppresses coordinate drift and stops display immediately', () => {
  const initial = processLocation(createTrackingState(), sample({ speedMetersPerSecond: 10 }), time);
  const stopped = processLocation(initial.state, sample({ latitude: 37.5001, speedMetersPerSecond: 0,
    timestampMs: time + 1000 }), time + 1000);
  assert.equal(stopped.speedKmh, 0);
  assert.equal(stopped.displaySpeedKmh, 0);
  assert.equal(stopped.distanceMeters, 0);
  assert.equal(stopped.elapsedSeconds, 1);
});

test('native speed does not oscillate with the coordinate deadband or irregular callbacks', () => {
  let state = processLocation(createTrackingState(), sample({ speedMetersPerSecond: 2 }), time).state;
  for (const offset of [250, 800, 1800, 4000]) {
    const result = processLocation(state, sample({ latitude: 37.5 + offset / 1000 * 2 / 111195,
      speedMetersPerSecond: 2, timestampMs: time + offset }), time + offset);
    assert.equal(result.speedKmh, 7.2);
    assert.equal(result.displaySpeedKmh, 7.2);
    state = result.state;
  }
});

test('an isolated native speed spike is suppressed without delaying confirmed rest', () => {
  let state = processLocation(createTrackingState(), sample({ speedMetersPerSecond: 10 }), time).state;
  for (const [index, speed] of [10, 40, 10, 0].entries()) {
    const result = processLocation(state, sample({ latitude: 37.5 + (index + 1) * 0.00009,
      speedMetersPerSecond: speed, timestampMs: time + (index + 1) * 1000 }), time + (index + 1) * 1000);
    assert.equal(result.speedKmh, speed === 0 ? 0 : 36);
    state = result.state;
  }
});

test('unavailable native speeds use a recent multi-second coordinate window', () => {
  for (const missing of [undefined, null, -1, NaN, 100]) {
    let state = processLocation(createTrackingState(), sample({ speedMetersPerSecond: missing }), time).state;
    for (let second = 1; second <= 4; second++) {
      const result = processLocation(state, sample({ latitude: 37.5 + second * 0.0001,
        speedMetersPerSecond: missing, timestampMs: time + second * 1000 }), time + second * 1000);
      if (second < 3) assert.equal(result.speedKmh, null);
      else assert.ok(result.speedKmh !== null && result.speedKmh > 39 && result.speedKmh < 41);
      state = result.state;
    }
  }
});

test('position noise without native speed remains unknown rather than false zero or high speed', () => {
  let state = processLocation(createTrackingState(), sample({ accuracyMeters: 20 }), time).state;
  for (let second = 1; second <= 20; second++) {
    const result = processLocation(state, sample({ latitude: 37.5 + (second % 2 ? 0.0001 : -0.0001),
      accuracyMeters: 20, timestampMs: time + second * 1000 }), time + second * 1000);
    assert.equal(result.speedKmh, null);
    assert.equal(result.displaySpeedKmh, null);
    assert.equal(result.distanceMeters, 0);
    state = result.state;
  }
});

test('native speed does not authorize a coordinate teleport', () => {
  const result = processLocation(first(), sample({ latitude: 38, speedMetersPerSecond: 10,
    timestampMs: time + 1000 }), time + 1000);
  assert.equal(result.accepted, false);
  assert.equal(result.distanceMeters, 0);
});

test('short-interval coordinate noise does not erase valid native speed or bill a jump', () => {
  const initial = processLocation(createTrackingState(), sample({ speedMetersPerSecond: 10, accuracyMeters: 10 }), time);
  const result = processLocation(initial.state, sample({ latitude: 37.500055,
    accuracyMeters: 10, speedMetersPerSecond: 10, timestampMs: time + 100 }), time + 100);
  assert.equal(result.accepted, true);
  assert.equal(result.reason, 'position-noise');
  assert.equal(result.speedKmh, 36);
  assert.equal(result.distanceMeters, 0);
});

test('expired native speed cannot reappear from a delayed location callback', () => {
  const result = processLocation(first(), sample({ speedMetersPerSecond: 10,
    timestampMs: time + 1000 }), time + 7000);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'stale');
  assert.equal(result.displaySpeedKmh, null);
});

test('walking speed remains stable despite coordinate deltas that imply 40 then 10 km/h', () => {
  let state = processLocation(createTrackingState(), sample({ speedMetersPerSecond: 1.4 }), time).state;
  for (const [index, meters] of [11.1, 13.9, 25, 27.8].entries()) {
    const result = processLocation(state, sample({ latitude: 37.5 + meters / 111195,
      speedMetersPerSecond: 1.4, timestampMs: time + (index + 1) * 1000 }), time + (index + 1) * 1000);
    assert.ok(result.displaySpeedKmh !== null && Math.abs(result.displaySpeedKmh - 5.04) < 0.001);
    state = result.state;
  }
});
