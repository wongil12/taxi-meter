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

test('low speed includes threshold and adds time while distance continues across mixed speeds', () => {
  let state = tick(start(), 160, 1600);
  state = tick(state, 30, 125, 15);
  assert.equal(state.fare, 4900);
  assert.equal(state.chargeableDistanceMeters, 125);
  state = tick(state, 30, 0);
  assert.equal(state.fare, 5000);
  state = tick(state, 13.1, 131);
  assert.equal(state.fare, 5100);
  assert.equal(state.chargeableDistanceMeters, 256);
  assert.equal(state.lowSpeedSeconds, 60);
  assert.equal(state.totalDistanceMeters, 1856);
});

test('base boundary crossing prorates time and excludes waiting inside base distance', () => {
  let state = tick(start(), 120, 0);
  assert.equal(state.lowSpeedSeconds, 0);
  state = tick(state, 150, 1500);
  state = tick(state, 60, 200, 12);
  assert.equal(state.lowSpeedSeconds, 30);
  assert.equal(state.chargeableDistanceMeters, 100);
  assert.equal(state.fare, 4900);
});

test('one low-speed interval can complete both a distance unit and a time unit', () => {
  let state = tick(start(), 160, 1600);
  state = tick(state, 90, 262);
  assert.equal(state.chargeableDistanceMeters, 262);
  assert.equal(state.lowSpeedSeconds, 90);
  assert.equal(state.fare, 5300);
});

test('distance and low-speed time each wait for their own complete billing unit', () => {
  let state = tick(start(), 160, 1600);
  state = tick(state, 29, 120, 15);
  assert.equal(state.fare, 4800);
  state = tick(state, 1, 0);
  assert.equal(state.fare, 4900);
  state = tick(state, 3, 11);
  assert.equal(state.fare, 5000);
  assert.equal(state.chargeableDistanceMeters, 131);
  assert.equal(state.lowSpeedSeconds, 33);
});

test('crossing the base boundary adds only excess distance and proportional low-speed time', () => {
  let state = tick(start(), 150, 1500);
  state = tick(state, 92.4, 231);
  assert.equal(state.chargeableDistanceMeters, 131);
  assert.ok(Math.abs(state.lowSpeedSeconds - 52.4) < 1e-9);
  assert.equal(state.fare, 5000);
});

test('equivalent uniform intervals produce equivalent fares', () => {
  let split = start();
  for (let index = 0; index < 100; index += 1) split = tick(split, 10, 100);
  const whole = tick(start(), 1000, 10000);
  assert.deepEqual(split, whole);
  let slowSplit = start();
  for (let index = 0; index < 20; index += 1) slowSplit = tick(slowSplit, 100, 250);
  const slowWhole = tick(start(), 2000, 5000);
  assert.deepEqual(slowSplit, slowWhole);
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

test('custom billing rules survive reset and displays handle long trips', () => {
  let state = meterReducer(createMeterState({ baseFare: 1000, baseDistanceMeters: 0 }), { type: 'start' });
  state = tick(state, 30, 0);
  assert.equal(state.fare, 1100);
  assert.equal(meterReducer(state, { type: 'reset' }).config.baseFare, 1000);
  assert.equal(formatFare(4800), '4,800');
  assert.equal(formatDuration(3661.9), '01:01:01');
});

test('unknown GPS speed never incurs low-speed time charges', () => {
  const state = tick(start(), 160, 1600);
  const uncertain = meterReducer(state, { type: 'tick', elapsedSeconds: 60,
    distanceMeters: 131, speedKnown: false });
  assert.equal(uncertain.lowSpeedSeconds, 0);
  assert.equal(uncertain.fare, 4900);
  const stationary = meterReducer(uncertain, { type: 'tick', elapsedSeconds: 30,
    distanceMeters: 0, speedKmh: 0, speedKnown: true });
  assert.equal(stationary.fare, 5000);
});

test('explicit log mode records movement without fare or billing counters', () => {
  let state = meterReducer(createMeterState({}, 'log'), { type: 'start', mode: 'log' });
  state = tick(state, 2000, 5000, 9);
  assert.equal(state.mode, 'log');
  assert.equal(state.totalDistanceMeters, 5000);
  assert.equal(state.fare, 0);
  assert.equal(state.chargeableDistanceMeters, 0);
  assert.equal(state.lowSpeedSeconds, 0);
  state = meterReducer(state, { type: 'pause' });
  state = meterReducer(state, { type: 'resume' });
  assert.equal(state.mode, 'log');
  const ready = meterReducer(state, { type: 'reset', mode: 'log' });
  const taxi = meterReducer(ready, { type: 'start', mode: 'taxi' });
  assert.equal(taxi.mode, 'taxi');
  assert.equal(taxi.fare, 4800);
  assert.equal(meterReducer(taxi, { type: 'start', mode: 'log' }), taxi);
});
