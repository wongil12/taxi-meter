import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTripHistoryStore } from '../storage/tripHistoryStore';
import { TripRecord } from '../domain/tripHistory';

const store = createTripHistoryStore(AsyncStorage);

export function useTripHistory() {
  const [records, setRecords] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setRecords(await store.load()); setError(null); }
    catch { setError('주행 기록을 불러오지 못했습니다. 다시 시도해 주세요.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const save = useCallback(async (record: TripRecord) => {
    try { setRecords(await store.save(record)); setError(null); return true; }
    catch { setError('기록을 저장하지 못했습니다. 영수증을 공유하거나 저장을 다시 시도해 주세요.'); return false; }
  }, []);
  const remove = useCallback(async (id: string) => {
    try { setRecords(await store.remove(id)); setError(null); }
    catch { setError('기록을 삭제하지 못했습니다. 다시 시도해 주세요.'); }
  }, []);
  return { records, loading, error, reload, save, remove };
}
