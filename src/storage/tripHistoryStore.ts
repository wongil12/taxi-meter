import {
  parseTripHistory,
  serializeTripHistory,
  upsertTripHistory,
  type TripRecord,
} from '../domain/tripHistory';

export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Keep this key stable; the serialized document carries its own schema version. */
export const TRIP_HISTORY_STORAGE_KEY = '@taxi-meter/trip-history';

export interface TripHistoryStore {
  load(): Promise<TripRecord[]>;
  save(record: TripRecord): Promise<TripRecord[]>;
  remove(id: string): Promise<TripRecord[]>;
}

/**
 * Use one shared instance per storage backend. Queue the complete operation,
 * including reads, so overlapping saves/deletes cannot replace each other's data.
 * Read/parse errors propagate; existing data is never overwritten on corruption.
 */
export function createTripHistoryStore(storage: AsyncKeyValueStore): TripHistoryStore {
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    // A failed request rejects its own caller, but does not poison later requests.
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function read(): Promise<TripRecord[]> {
    const raw = await storage.getItem(TRIP_HISTORY_STORAGE_KEY);
    return raw === null ? [] : parseTripHistory(raw);
  }

  return {
    load: () => enqueue(read),
    save: record => enqueue(async () => {
      const records = upsertTripHistory(await read(), record);
      await storage.setItem(TRIP_HISTORY_STORAGE_KEY, serializeTripHistory(records));
      return records;
    }),
    remove: id => enqueue(async () => {
      const records = (await read()).filter(record => record.id !== id);
      await storage.setItem(TRIP_HISTORY_STORAGE_KEY, serializeTripHistory(records));
      return records;
    }),
  };
}
