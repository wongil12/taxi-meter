import assert from 'node:assert/strict';
import test from 'node:test';
import { type TripRecord } from '../domain/tripHistory';
import { createTripHistoryStore, TRIP_HISTORY_STORAGE_KEY, type AsyncKeyValueStore } from './tripHistoryStore';

class MemoryStorage implements AsyncKeyValueStore {
  value: string | null = null;
  writes = 0;
  failRead = false;
  failWrite = false;
  async getItem(key: string): Promise<string | null> {
    assert.equal(key, TRIP_HISTORY_STORAGE_KEY);
    await Promise.resolve();
    if (this.failRead) { this.failRead = false; throw new Error('read unavailable'); }
    return this.value;
  }
  async setItem(key: string, value: string): Promise<void> {
    assert.equal(key, TRIP_HISTORY_STORAGE_KEY);
    await Promise.resolve();
    if (this.failWrite) { this.failWrite = false; throw new Error('write unavailable'); }
    this.writes++;
    this.value = value;
  }
}

const record = (id: string): TripRecord => ({
  id,
  startedAt: '2026-10-07T01:00:00.000Z',
  endedAt: '2026-10-07T01:10:00.000Z',
  durationSeconds: 600,
  distanceMeters: 2500,
  fare: 5400,
});

test('new storage loads empty and a saved trip survives store recreation', async () => {
  const storage = new MemoryStorage();
  const store = createTripHistoryStore(storage);
  assert.deepEqual(await store.load(), []);
  assert.deepEqual(await store.save(record('one')), [record('one')]);
  assert.deepEqual(await createTripHistoryStore(storage).load(), [record('one')]);
});

test('parallel saves, initial load and removal preserve invocation order without lost updates', async () => {
  const storage = new MemoryStorage();
  const store = createTripHistoryStore(storage);
  const [initial, first, second, removed, final] = await Promise.all([
    store.load(),
    store.save(record('one')),
    store.save(record('two')),
    store.remove('one'),
    store.load(),
  ]);
  assert.deepEqual(initial, []);
  assert.deepEqual(first.map(item => item.id), ['one']);
  assert.deepEqual(new Set(second.map(item => item.id)), new Set(['one', 'two']));
  assert.deepEqual(removed.map(item => item.id), ['two']);
  assert.deepEqual(final.map(item => item.id), ['two']);
});

test('saving the same trip ID updates it without duplication', async () => {
  const storage = new MemoryStorage();
  const store = createTripHistoryStore(storage);
  await store.save(record('one'));
  const updated = { ...record('one'), fare: 5600 };
  assert.deepEqual(await store.save(updated), [updated]);
});

test('corrupt storage rejects reads and mutations without overwriting the original', async () => {
  const storage = new MemoryStorage();
  const damaged = '{this is not a valid history';
  storage.value = damaged;
  const store = createTripHistoryStore(storage);
  await assert.rejects(store.load());
  await assert.rejects(store.save(record('one')));
  await assert.rejects(store.remove('one'));
  assert.equal(storage.value, damaged);
  assert.equal(storage.writes, 0);
});

test('read failure does not overwrite data or block the next queued operation', async () => {
  const storage = new MemoryStorage();
  const store = createTripHistoryStore(storage);
  await store.save(record('one'));
  storage.failRead = true;
  const failedSave = store.save(record('two'));
  const succeedingSave = store.save(record('three'));
  await assert.rejects(failedSave, /read unavailable/);
  assert.deepEqual(new Set((await succeedingSave).map(item => item.id)), new Set(['one', 'three']));
  assert.equal(storage.writes, 2);
});

test('write failure preserves previous data and the queue remains usable', async () => {
  const storage = new MemoryStorage();
  const store = createTripHistoryStore(storage);
  await store.save(record('one'));
  storage.failWrite = true;
  const failedRemove = store.remove('one');
  const subsequentLoad = store.load();
  await assert.rejects(failedRemove, /write unavailable/);
  assert.deepEqual(await subsequentLoad, [record('one')]);
  assert.deepEqual(await store.remove('one'), []);
});
