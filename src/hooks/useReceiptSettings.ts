import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_RECEIPT_KEYWORD, normalizeReceiptKeyword } from '../domain/receiptSettings';

const KEY = '@taxi-meter/receipt-keyword';
export function useReceiptSettings() {
  const [keyword, setKeyword] = useState(DEFAULT_RECEIPT_KEYWORD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await AsyncStorage.getItem(KEY);
      setKeyword(stored === null ? DEFAULT_RECEIPT_KEYWORD : normalizeReceiptKeyword(stored));
      setError(null);
    } catch { setError('설정을 불러오지 못했습니다. 다시 불러오거나 이름을 새로 저장해 주세요.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const save = useCallback(async (input: string) => {
    if (pending.current || loading) return false;
    pending.current = true; setSaving(true);
    try {
      const value = normalizeReceiptKeyword(input);
      await AsyncStorage.setItem(KEY, value);
      setKeyword(value); setError(null); return true;
    } catch (error) {
      setError(error instanceof Error && error.message.startsWith('이름은') ? error.message : '저장하지 못했습니다. 다시 시도해 주세요.');
      return false;
    } finally { pending.current = false; setSaving(false); }
  }, [loading]);
  return { keyword, loading, saving, error, save, reload };
}
