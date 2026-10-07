import assert from 'node:assert/strict';
import test from 'node:test';
import { createMeterState, formatDuration, formatFare, meterReducer } from './meter';

const start = () => meterReducer(createMeterState(), { type: 'start' });
const tick = (state: ReturnType<typeof start>, seconds: number, meters: number, speedKmh?: number) =>
  meterReducer(state, { type: 'tick', elapsedSeconds: seconds, distanceMeters: meters, speedKmh });

test('trip lifecycle, pauses, finish and reset preserve their intended boundaries', () => {
  const idle = createMeterState();
  assert.equal(idle.fare, 0);
  assert.equal(meterReducer(idle, { type: 'resume' }), idle);
  let state = start();
  assert.equal(state.fare, 4800);
  state = tick(state, 60, 500);
  const paused = meterReducer(state, { type: 'pause' });
  assert.equal(tick(paused, 60, 500), paused);
  state = tick(meterReducer(paused, { type: 'resume' }), 60, 500);
  assert.equal(state.elapsedSeconds, 120);
  assert.equal(state.totalDistanceMeters, 1000);
  const finished = meterReducer(state, { type: 'finish' });
  assert.equal(tick(finished, 60, 500), finished);
  assert.equal(meterReducer(finished, { type: 'start' }), finished);
  assert.deepEqual(meterReducer(finished, { type: 'reset' }), idle);
});

test('base distance and completed distance units are charged exactly at boundaries', () => {
  let state = tick(start(), 160, 1600);
  assert.equal(state.fare, 4800);
  state = tick(state, 13, 130);
  assert.equal(state.fare, 4800);
  state = tick(state, 0.1, 1);
  assert.equal(state.fare, 4900);
  assert.equal(state.lowSpeedSeconds, 0);
});

test('low speed includes threshold, bills time only and resumes distance accounting', () => {
  let state = tick(start(), 160, 1600);
  state = tick(state, 30, 125, 15);
  assert.equal(state.fare, 4900);
  assert.equal(state.chargeableDistanceMeters, 0);
  state = tick(state, 30, 0);
  assert.equal(state.fare, 5000);
  state = tick(state, 13.1, 131);
  assert.equal(state.fare, 5100);
  assert.equal(state.lowSpeedSeconds, 60);
  assert.equal(state.totalDistanceMeters, 1856);
});

test('base boundary crossing prorates time and excludes waiting inside base distance', () => {
  let state = tick(start(), 120, 0);
  assert.equal(state.lowSpeedSeconds, 0);
  state = tick(state, 150, 1500);
  state = tick(state, 60, 200, 12);
  assert.equal(state.lowSpeedSeconds, 30);
  assert.equal(state.chargeableDistanceMeters, 0);
  assert.equal(state.fare, 4900);
});

test('equivalent uniform intervals produce equivalent fares', () => {
  let split = start();
  for (let index = 0; index < 100; index += 1) split = tick(split, 10, 100);
  const whole = tick(start(), 1000, 10000);
  assert.deepEqual(split, whole);
  let fractional = tick(start(), 160, 1600);
  for (let index = 0; index < 300; index += 1) fractional = tick(fractional, 0.1, 0);
  assert.equal(fractional.fare, 4900);
});

test('invalid data is rejected and prior state is never mutated', () => {
  const state = start();
  const snapshot = structuredClone(state);
  for (const value of [-1, NaN, Infinity]) {
    assert.throws(() => tick(state, value, 0), RangeError);
    assert.throws(() => tick(state, 1, value), RangeError);
    assert.throws(() => tick(state, 1, 0, value), RangeError);
    assert.throws(() => createMeterState({ baseFare: value }), RangeError);
  }
  assert.throws(() => tick(state, 0, 10), RangeError);
  assert.throws(() => createMeterState({ timeUnitSeconds: 0 }), RangeError);
  assert.throws(() => createMeterState({ distanceUnitMeters: 0 }), RangeError);
  tick(state, 100, 2000);
  assert.deepEqual(state, snapshot);
});

test('custom game rules survive reset and displays handle long trips', () => {
  let state = meterReducer(createMeterState({ baseFare: 1000, baseDistanceMeters: 0 }), { type: 'start' });
  state = tick(state, 30, 0);
  assert.equal(state.fare, 1100);
  assert.equal(meterReducer(state, { type: 'reset' }).config.baseFare, 1000);
  assert.equal(formatFare(4800), '4,800');
  assert.equal(formatDuration(3661.9), '01:01:01');
});
