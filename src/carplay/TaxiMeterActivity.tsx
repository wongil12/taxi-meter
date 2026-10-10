import { Text, VStack } from '@expo/ui/swift-ui';
import { font, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';
import type { MeterActivityProps } from './controller';

// Factory creation is lazy: importing this module never starts an activity.
export function createTaxiMeterActivity() {
  return createLiveActivity<MeterActivityProps>('TaxiMeterActivity', props => {
    'widget';
    return {
      banner: (
        <VStack modifiers={[padding({ all: 16 })]}>
          <Text modifiers={[font({ size: 14 })]}>{props.status}</Text>
          <Text modifiers={[font({ size: 32, weight: 'bold' })]}>{props.fare}</Text>
          <Text>{props.distance} · {props.duration}</Text>
          <Text modifiers={[font({ size: 12 })]}>안전 운전 하세요</Text>
        </VStack>
      ),
      bannerSmall: (
        <VStack modifiers={[padding({ all: 8 })]}>
          <Text modifiers={[font({ size: 13 })]}>{props.status}</Text>
          <Text modifiers={[font({ size: 24, weight: 'bold' })]}>{props.fare}</Text>
        </VStack>
      ),
      compactLeading: <Text>운행</Text>,
      compactTrailing: <Text>{props.fare}</Text>,
      minimal: <Text>운행</Text>,
      expandedLeading: <Text>{props.status}</Text>,
      expandedTrailing: <Text>{props.fare}</Text>,
      expandedBottom: <Text>{props.distance} · {props.duration}</Text>,
    };
  });
}
