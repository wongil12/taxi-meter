import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function useReducedMotion() {
  // Remain still until the system preference has been read.
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; listener.remove(); };
  }, []);
  return reduced;
}

/** A short departure followed by a moving road; never indicates GPS speed. */
export function RideMotion({ running, color, surface, line }: {
  running: boolean; color: string; surface: string; line: string;
}) {
  const reduced = useReducedMotion();
  const departure = useRef(new Animated.Value(0)).current;
  const road = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!running || reduced) {
      departure.stopAnimation(); road.stopAnimation();
      departure.setValue(1); road.setValue(0);
      return;
    }
    departure.setValue(0);
    road.setValue(0);
    const arrival = Animated.timing(departure, {
      toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    const movingRoad = Animated.loop(Animated.timing(road, {
      toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    arrival.start(); movingRoad.start();
    return () => { arrival.stop(); movingRoad.stop(); };
  }, [running, reduced, departure, road]);

  return (
    <View style={styles.scene} accessible accessibilityLabel={running ? '자동차 주행 애니메이션' : '정지한 자동차'}>
      <Animated.View style={{ transform: [{ translateX: departure.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }) }] }}>
        <Svg width={144} height={76} viewBox="0 0 144 76">
          <Rect x="63" y="7" width="23" height="10" rx="3" fill={color} />
          <Path d="M19 43 L31 23 Q34 18 43 18 H87 Q95 18 100 26 L110 40 L127 45 Q134 47 134 54 V61 H10 V52 Q10 44 19 43Z" fill={color} />
          <Path d="M39 25 H61 V40 H29Z M68 25 H87 Q90 25 94 31 L100 40 H68Z" fill={surface} />
          <Rect x="72" y="46" width="12" height="3" rx="1.5" fill={surface} />
          <Circle cx="34" cy="61" r="12" fill={surface} stroke={color} strokeWidth="4" />
          <Circle cx="110" cy="61" r="12" fill={surface} stroke={color} strokeWidth="4" />
          <Circle cx="34" cy="61" r="4" fill={color} />
          <Circle cx="110" cy="61" r="4" fill={color} />
        </Svg>
      </Animated.View>
      <View style={[styles.road, { borderColor: line }]}>
        <Animated.View style={[styles.dashes, { transform: [{ translateX: road.interpolate({ inputRange: [0, 1], outputRange: [0, -48] }) }] }]}>
          {Array.from({ length: 20 }, (_, index) => <View key={index} style={[styles.dash, { backgroundColor: line }]} />)}
        </Animated.View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  scene: { height: 120, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  road: { height: 28, width: '100%', borderTopWidth: 1, marginTop: 5, overflow: 'hidden', justifyContent: 'center' },
  dashes: { flexDirection: 'row', width: 960, gap: 24 },
  dash: { width: 24, height: 2 },
});
