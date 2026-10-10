import { useEffect, useReducer, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { createMeterState, meterReducer, type TripMode } from '../domain/meter';
import { createTripClock, getTripElapsedSeconds, pauseTripClock, resumeTripClock } from '../domain/tripClock';
import { createTripRecord, TripRecord } from '../domain/tripHistory';
import { createTrackingState, processLocation, TRACKING_LIMITS } from '../location/tracking';

export function useForegroundTaxiMeter() {
  const [meter, dispatch] = useReducer(meterReducer, undefined, () => createMeterState({}, 'log'));
  const [gpsMessage, setGpsMessage] = useState('시작하면 위치 접근 권한을 요청합니다.');
  const [speed, setSpeed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [tripElapsedSeconds, setTripElapsedSeconds] = useState(0);
  const [completedTrip, setCompletedTrip] = useState<TripRecord | null>(null);
  const tripIdentity = useRef<{ id: string; startedAt: string } | null>(null);
  const tripClock = useRef(createTripClock());
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const generation = useRef(0);
  const starting = useRef(false);
  const active = useRef(false);
  const tracking = useRef(createTrackingState());
  const lastFix = useRef(0);

  const stop = () => {
    const now = performance.now();
    tripClock.current = pauseTripClock(tripClock.current, now);
    setTripElapsedSeconds(getTripElapsedSeconds(tripClock.current, now));
    generation.current++;
    active.current = false;
    watcher.current?.remove();
    watcher.current = null;
    tracking.current = createTrackingState();
    setSpeed(null);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if ((state === 'background' && (active.current || starting.current))
        || (state === 'inactive' && active.current)) {
        stop();
        dispatch({ type: 'pause' });
        setGpsMessage('앱을 벗어나 측정을 멈췄습니다. 다시 시작해 주세요.');
      }
    });
    const timer = setInterval(() => {
      if (active.current && Date.now() - lastFix.current > TRACKING_LIMITS.speedExpiryMs) {
        setSpeed(null);
        tracking.current = createTrackingState();
        setGpsMessage('GPS 신호를 기다립니다. 미수신 구간은 계산하지 않습니다.');
      }
    }, 1000);
    const clockTimer = setInterval(() => {
      if (active.current) {
        setTripElapsedSeconds(getTripElapsedSeconds(tripClock.current, performance.now()));
      }
    }, 1000);
    return () => { subscription.remove(); clearInterval(timer); clearInterval(clockTimer); stop(); };
  }, []);

  const begin = async (mode: TripMode = 'log') => {
    if (starting.current || active.current || !['idle', 'paused'].includes(meter.status)) return;
    starting.current = true;
    setBusy(true);
    const ticket = ++generation.current;
    const tripMode = meter.status === 'paused' ? meter.mode : mode;
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
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        location => {
          if (ticket !== generation.current || !active.current) return;
          const result = processLocation(tracking.current, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracyMeters: location.coords.accuracy ?? Infinity,
            timestampMs: location.timestamp,
            speedMetersPerSecond: location.coords.speed,
          });
          tracking.current = result.state;
          if (!result.accepted) {
            // A duplicate or delayed callback must not erase the trusted fix.
            if (result.reason === 'out-of-order' || result.reason === 'stale') return;
            tracking.current = createTrackingState();
            setSpeed(null);
            setGpsMessage('GPS 정확도가 낮습니다. 신호가 회복되면 계산합니다.');
            return;
          }
          lastFix.current = location.timestamp;
          setSpeed(result.displaySpeedKmh);
          setGpsMessage(result.speedKmh === null ? (tripMode === 'taxi'
            ? '속도 확인 중 · 불확실한 구간의 시간 요금은 제외합니다.' : 'GPS 연결됨 · 속도 확인 중')
            : result.reason === 'gap' ? 'GPS 재연결 · 누락 구간은 제외했습니다.' : 'GPS 연결됨 · 휴대폰에서만 측정 중');
          dispatch({ type: 'tick', elapsedSeconds: result.elapsedSeconds, distanceMeters: result.distanceMeters,
            speedKmh: result.speedKmh ?? undefined, speedKnown: result.speedKmh !== null });
        },
        () => {
          if (ticket !== generation.current) return;
          stop(); dispatch({ type: 'pause' });
          setGpsMessage('GPS 측정이 중단됐습니다. 다시 시작해 주세요.');
        },
      );
      if (ticket !== generation.current) { subscription.remove(); return; }
      if (meter.status === 'idle') {
        tripIdentity.current = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, startedAt: new Date().toISOString() };
      }
      watcher.current = subscription;
      active.current = true;
      tripClock.current = resumeTripClock(tripClock.current, performance.now());
      dispatch(meter.status === 'paused' ? { type: 'resume' } : { type: 'start', mode: tripMode });
    } catch {
      if (ticket === generation.current) {
        stop(); dispatch({ type: 'pause' });
        setGpsMessage('위치를 가져오지 못했습니다. 위치 설정을 확인하고 다시 시작해 주세요.');
      }
    } finally { starting.current = false; setBusy(false); }
  };

  return {
    meter, mode: meter.mode, speed, gpsMessage, busy, begin, tripElapsedSeconds, completedTrip,
    pause: () => { stop(); dispatch({ type: 'pause' }); setGpsMessage('일시정지 · 측정을 멈췄습니다.'); },
    finish: () => {
      if (!['running', 'paused'].includes(meter.status) || !tripIdentity.current) return;
      stop();
      const identity = tripIdentity.current;
      tripIdentity.current = null;
      setCompletedTrip(createTripRecord({
        ...identity, endedAt: new Date(Math.max(Date.now(), Date.parse(identity.startedAt))).toISOString(),
        durationSeconds: getTripElapsedSeconds(tripClock.current, performance.now()),
        distanceMeters: meter.totalDistanceMeters, fare: meter.fare, mode: meter.mode,
      }));
      dispatch({ type: 'finish' }); setGpsMessage('이번 주행을 마쳤습니다.');
    },
    reset: () => {
      stop();
      tripIdentity.current = null;
      setCompletedTrip(null);
      tripClock.current = createTripClock();
      setTripElapsedSeconds(0);
      dispatch({ type: 'reset', mode: 'log' });
      setGpsMessage('새로운 주행을 시작해 보세요.');
    },
  };
}
