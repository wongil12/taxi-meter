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
          <Text modifiers={[font({ size: 32, weight: 'bold' })]}>{props.distance}</Text>
          <Text>{props.duration}</Text>
        </VStack>
      ),
      bannerSmall: (
        <VStack modifiers={[padding({ all: 8 })]}>
          <Text modifiers={[font({ size: 13 })]}>{props.status}</Text>
          <Text modifiers={[font({ size: 24, weight: 'bold' })]}>{props.distance}</Text>
          <Text modifiers={[font({ size: 16 })]}>{props.duration}</Text>
        </VStack>
      ),
      compactLeading: <Text>{props.duration}</Text>,
      compactTrailing: <Text>{props.distance}</Text>,
      minimal: <Text>{props.duration}</Text>,
      expandedLeading: <Text>{props.status}</Text>,
      expandedTrailing: <Text>{props.distance}</Text>,
      expandedBottom: <Text>{props.duration}</Text>,
    };
  });
}
