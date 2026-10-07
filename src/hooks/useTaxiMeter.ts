import { useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { createMeterState, meterReducer } from '../domain/meter';
import { createTrackingState, processLocation } from '../location/tracking';

export function useTaxiMeter() {
  const [meter, dispatch] = useReducer(meterReducer, undefined, () => createMeterState());
  const [gpsMessage, setGpsMessage] = useState('시작하면 위치 접근 권한을 요청합니다.');
  const [speed, setSpeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const active = useRef(false);
  const tracking = useRef(createTrackingState());
  const lastFix = useRef(0);

  const stop = () => {
    generation.current++;
    active.current = false;
    watcher.current?.remove();
    watcher.current = null;
    tracking.current = createTrackingState();
    setSpeed(0);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background' || (state === 'inactive' && active.current)) {
        stop();
        dispatch({ type: 'pause' });
        setGpsMessage('앱을 벗어나 측정을 멈췄습니다. 다시 시작해 주세요.');
      }
    });
    const timer = setInterval(() => {
      if (active.current && Date.now() - lastFix.current > 10_000) {
        setSpeed(0);
        tracking.current = createTrackingState();
        setGpsMessage('GPS 신호를 기다립니다. 미수신 구간은 계산하지 않습니다.');
      }
    }, 2000);
    return () => { subscription.remove(); clearInterval(timer); stop(); };
  }, []);

  const begin = async () => {
    if (starting.current || active.current || !['idle', 'paused'].includes(meter.status)) return;
    starting.current = true;
    setBusy(true);
    const ticket = ++generation.current;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (ticket !== generation.current) return;
      if (permission.status !== 'granted') {
        setGpsMessage(permission.canAskAgain
          ? '위치 권한이 필요합니다. 시작 버튼으로 다시 허용해 주세요.'
          : '위치 권한이 꺼져 있습니다. 기기 설정에서 허용해 주세요.');
        return;
      }
      if (!await Location.hasServicesEnabledAsync()) {
        setGpsMessage('위치 서비스가 꺼져 있습니다. 기기 설정에서 켜 주세요.');
        return;
      }
      if (ticket !== generation.current) return;
      tracking.current = createTrackingState();
      setGpsMessage('GPS 신호를 찾고 있습니다…');
      lastFix.current = Date.now();
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 },
        location => {
          if (ticket !== generation.current || !active.current) return;
          const result = processLocation(tracking.current, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracyMeters: location.coords.accuracy ?? Infinity,
            timestampMs: location.timestamp,
          });
          tracking.current = result.state;
          if (!result.accepted) {
            tracking.current = createTrackingState();
            setSpeed(0);
            setGpsMessage('GPS 정확도가 낮습니다. 신호가 회복되면 계산합니다.');
            return;
          }
          lastFix.current = Date.now();
          setSpeed(result.speedKmh);
          setGpsMessage(result.reason === 'gap' ? 'GPS 재연결 · 누락 구간은 제외했습니다.' : 'GPS 연결됨 · 휴대폰에서만 측정 중');
          dispatch({ type: 'tick', elapsedSeconds: result.elapsedSeconds, distanceMeters: result.distanceMeters, speedKmh: result.speedKmh });
        },
        () => {
          if (ticket !== generation.current) return;
          stop(); dispatch({ type: 'pause' });
          setGpsMessage('GPS 측정이 중단됐습니다. 다시 시작해 주세요.');
        },
      );
      if (ticket !== generation.current) { subscription.remove(); return; }
      watcher.current = subscription;
      active.current = true;
      dispatch({ type: meter.status === 'paused' ? 'resume' : 'start' });
    } catch {
      if (ticket === generation.current) {
        stop(); dispatch({ type: 'pause' });
        setGpsMessage('위치를 가져오지 못했습니다. 위치 설정을 확인하고 다시 시작해 주세요.');
      }
    } finally { starting.current = false; setBusy(false); }
  };

  return {
    meter, speed, gpsMessage, busy, begin,
    pause: () => { stop(); dispatch({ type: 'pause' }); setGpsMessage('일시정지 · 요금이 올라가지 않습니다.'); },
    finish: () => { stop(); dispatch({ type: 'finish' }); setGpsMessage('이번 주행을 마쳤습니다.'); },
    reset: () => { stop(); dispatch({ type: 'reset' }); setGpsMessage('새로운 주행을 시작해 보세요.'); },
  };
}
