import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { TripRecord } from '../domain/tripHistory';
import type { TripMode } from '../domain/meter';
import { initialNativeSnapshot, nativeMeterState, parseNativeSnapshot,
  type NativeMeterSnapshot, type NativeTaxiCarPlay } from '../carplay/nativeMeter';
import { useForegroundTaxiMeter } from './useForegroundTaxiMeter';

// Fixed for this bundle. Old iOS builds and Android retain the foreground engine.
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeTaxiCarPlay>('TaxiCarPlay') : null;
const noTrips: TripRecord[] = [];
const acknowledgeNothing = async (_ids: string[]) => {};

function useNativeTaxiMeter() {
  const [snapshot, setSnapshot] = useState(initialNativeSnapshot);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(-1);
  const mounted = useRef(true);
  const accept = useCallback((value: NativeMeterSnapshot) => {
    const next = parseNativeSnapshot(value);
    if (!mounted.current || next.revision < revision.current) return;
    revision.current = next.revision;
    setSnapshot(next);
    setError(null);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => { void native!.getSnapshot().then(accept).catch(() => {
      if (mounted.current) setError('주행 상태를 불러오지 못했습니다. 앱을 다시 열어 주세요.');
    }); };
    const listener = native!.addListener('onStateChange', value => {
      try { accept(value); }
      catch { if (mounted.current) setError('주행 상태를 확인하지 못했습니다. 앱을 다시 열어 주세요.'); }
    });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    refresh();
    return () => { mounted.current = false; listener.remove(); appState.remove(); };
  }, [accept]);
  const perform = useCallback(async (method: 'begin' | 'pause' | 'finish' | 'reset', mode?: TripMode) => {
    try { accept(await (method === 'begin' ? native!.begin(mode ?? 'log') : native![method]())); return true; }
    catch { if (mounted.current) setError('주행 동작을 완료하지 못했습니다. 현재 상태를 확인하고 다시 시도해 주세요.'); return false; }
  }, [accept]);
  const acknowledgeCompletedTrips = useCallback(async (ids: string[]) => {
    accept(await native!.acknowledgeTrips(ids));
  }, [accept]);
  return {
    nativeHistory: true, meter: nativeMeterState(snapshot), mode: snapshot.mode, speed: snapshot.speedKmh, gpsMessage: error ?? snapshot.gpsMessage,
    busy: snapshot.busy, tripElapsedSeconds: snapshot.elapsedSeconds, completedTrip: snapshot.completedTrip,
    carPlayConnected: snapshot.carPlayConnected, pendingTrips: snapshot.pendingTrips, acknowledgeCompletedTrips,
    begin: (mode: TripMode = 'log') => perform('begin', mode), pause: () => { void perform('pause'); },
    finish: () => { void perform('finish'); }, reset: () => perform('reset'),
  };
}

function usePhoneTaxiMeter() {
  return { ...useForegroundTaxiMeter(), nativeHistory: false, carPlayConnected: false, pendingTrips: noTrips,
    acknowledgeCompletedTrips: acknowledgeNothing };
}

const usePlatformMeter = native ? useNativeTaxiMeter : usePhoneTaxiMeter;
export function useTaxiMeter() { return usePlatformMeter(); }
