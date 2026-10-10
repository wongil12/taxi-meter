import assert from 'node:assert/strict';
import test from 'node:test';
import { createTripClock, getTripElapsedSeconds, pauseTripClock, resumeTripClock } from './tripClock';

test('active time advances without GPS fixes or regularly scheduled callbacks', () => {
  const clock = resumeTripClock(createTripClock(), 10_000);
  assert.equal(getTripElapsedSeconds(clock, 10_999), 0);
  assert.equal(getTripElapsedSeconds(clock, 11_000), 1);
  // A delayed callback catches up directly instead of incrementing by one.
  assert.equal(getTripElapsedSeconds(clock, 17_800), 7);
});

test('pause and background gaps do not accrue and subsecond active segments survive resume', () => {
  let clock = resumeTripClock(createTripClock(), 100);
  clock = pauseTripClock(clock, 850);
  assert.equal(getTripElapsedSeconds(clock, 100_000), 0);
  clock = resumeTripClock(clock, 100_000);
  assert.equal(getTripElapsedSeconds(clock, 100_250), 1);
  clock = pauseTripClock(clock, 100_750);
  assert.equal(getTripElapsedSeconds(clock, 200_000), 1);
  clock = resumeTripClock(clock, 200_000);
  assert.equal(getTripElapsedSeconds(clock, 200_500), 2);
});

test('duplicate lifecycle events neither restart nor double-count the clock', () => {
  let clock = resumeTripClock(createTripClock(), 1000);
  const resumed = resumeTripClock(clock, 2000);
  assert.equal(resumed, clock);
  clock = pauseTripClock(resumed, 3500);
  assert.equal(pauseTripClock(clock, 9000), clock);
  assert.equal(getTripElapsedSeconds(clock, 20_000), 2);
});

test('finish freezes the duration and reset starts a fresh trip', () => {
  const running = resumeTripClock(createTripClock(), 200);
  const finished = pauseTripClock(running, 65_400);
  assert.equal(getTripElapsedSeconds(finished, 800_000), 65);
  const reset = createTripClock();
  assert.equal(getTripElapsedSeconds(reset, 800_000), 0);
  const nextTrip = resumeTripClock(reset, 800_000);
  assert.equal(getTripElapsedSeconds(nextTrip, 801_000), 1);
});
