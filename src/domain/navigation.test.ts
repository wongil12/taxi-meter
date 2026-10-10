import test from 'node:test';
import assert from 'node:assert/strict';
import { tripEntry } from './navigation';
test('finished log can open taxi after saving without retaining log selection', () => {
  assert.equal(tripEntry('finished', 'log', 'taxi', true), 'reset');
  assert.equal(tripEntry('finished', 'taxi', 'log', true), 'reset');
  assert.equal(tripEntry('finished', 'log', 'taxi', false), 'unsaved');
});
test('active trip mode cannot be replaced through a tab', () => {
  for (const status of ['running', 'paused'] as const) {
    assert.equal(tripEntry(status, 'log', 'taxi', true), 'blocked');
    assert.equal(tripEntry(status, 'taxi', 'taxi', true), 'current');
  }
  assert.equal(tripEntry('idle', 'log', 'taxi', false), 'open');
});
