import { requireOptionalNativeModule, type NativeModule } from 'expo';

export type TaxiCarPlaySnapshot = Record<string, unknown>;
type TaxiCarPlayEvents = { onStateChange: (snapshot: TaxiCarPlaySnapshot) => void };
export interface TaxiCarPlayModule extends NativeModule<TaxiCarPlayEvents> {
  getSnapshot(): Promise<TaxiCarPlaySnapshot>;
  begin(): Promise<TaxiCarPlaySnapshot>;
  pause(): Promise<TaxiCarPlaySnapshot>;
  finish(): Promise<TaxiCarPlaySnapshot>;
  reset(): Promise<TaxiCarPlaySnapshot>;
  acknowledgeTrips(ids: string[]): Promise<TaxiCarPlaySnapshot>;
}

export default requireOptionalNativeModule<TaxiCarPlayModule>('TaxiCarPlay');
