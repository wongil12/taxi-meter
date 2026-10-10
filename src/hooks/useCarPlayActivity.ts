import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { createActivityController, type ActivityResult, type MeterActivityInput } from '../carplay/controller';

export type CarPlayAvailability = 'available' | 'unsupported' | 'development-build-required';
export interface CarPlayActivityState extends ActivityResult { availability: CarPlayAvailability }

function availability(): CarPlayAvailability {
  if (Platform.OS !== 'ios' || Number.parseInt(String(Platform.Version), 10) < 26) return 'unsupported';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'development-build-required';
  return 'available';
}

/** Opt-in, read-only CarPlay Dashboard Live Activity; not a standalone CarPlay app. */
export function useCarPlayActivity(input: MeterActivityInput, enabled: boolean, carPlayConnected = false): CarPlayActivityState {
  const [state, setState] = useState<CarPlayActivityState>(() => ({ availability: availability(), status: 'inactive' }));
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const controller = useRef<ReturnType<typeof createActivityController> | null>(null);
  const latest = useRef({ input, enabled, carPlayConnected });
  latest.current = { input, enabled, carPlayConnected };

  useEffect(() => {
    let mounted = true;
    if (availability() === 'available') {
      try {
        // Do not evaluate expo-widgets/@expo/ui native modules in Expo Go or Android.
        const { createTaxiMeterActivity } = require('../carplay/TaxiMeterActivity') as typeof import('../carplay/TaxiMeterActivity');
        controller.current = createActivityController(createTaxiMeterActivity(), result => {
          if (mounted) setState({ availability: 'available', ...result });
        });
      } catch {
        setState({ availability: 'development-build-required', status: 'error', errorMessage: 'CarPlay 실시간 현황이 포함된 iOS 개발 빌드가 필요해요.' });
      }
    }
    const subscription = AppState.addEventListener('change', next => {
      const active = next === 'active';
      setForeground(active);
      // Publish the paused state immediately, before React rerenders during backgrounding.
      void controller.current?.sync(latest.current.input, latest.current.enabled, active, latest.current.carPlayConnected);
    });
    return () => {
      mounted = false;
      subscription.remove();
      const old = controller.current;
      controller.current = null;
      void old?.dispose();
    };
  }, []);

  useEffect(() => {
    void controller.current?.sync(input, enabled, foreground, carPlayConnected);
  }, [input.mode, input.status, input.fare, input.distanceMeters, input.elapsedSeconds, enabled, foreground, carPlayConnected]);

  return state;
}
