import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ScreenTheme } from './TripHistoryScreen';

export function NavigationHeader({ title, backLabel, onBack, theme, disabled }: {
  title: string; backLabel?: string; onBack?: () => void; theme: ScreenTheme; disabled: boolean;
}) {
  return <View style={[styles.header, { borderColor: theme.line, backgroundColor: theme.surface }]}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel={`${backLabel}으로 돌아가기`} disabled={disabled} onPress={onBack} style={styles.back}>
      <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}><Path d="m15 5-7 7 7 7" fill="none" stroke={theme.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      <Text style={[styles.backText, { color: theme.accent }]}>{backLabel}</Text>
    </Pressable>}
    <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
  </View>;
}
export type MainTab = 'home' | 'history' | 'meter' | 'settings';
const tabLabels: Record<MainTab, string> = { home: '운행', history: '기록', meter: '미터기', settings: '설정' };
const tabIcons: Record<MainTab, string> = {
  home: 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
  history: 'M7 3h10v18l-3-2-2 2-2-2-3 2V3Zm3 5h4m-4 4h4',
  meter: 'M4 18a9 9 0 1 1 16 0H4Zm8-5 4-5M6 13H4m16 0h-2M12 4v2',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-8 0v6',
};
export function MainTabs({ active, onSelect, theme, disabled, running }: {
  active: MainTab; onSelect: (tab: MainTab) => void;
  theme: ScreenTheme; disabled: boolean; running: boolean;
}) {
  return <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: theme.line, backgroundColor: theme.surface }]}>
    {(['home', 'history', 'meter', 'settings'] as const).map(tab => {
      const selected = active === tab;
      const color = selected ? theme.onAccent : theme.muted;
      return <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected, disabled }}
        accessibilityLabel={`${tabLabels[tab]}${tab === active && (tab === 'home' || tab === 'meter') && running ? ', 운행 중' : ''}`}
        disabled={disabled} onPress={() => onSelect(tab)}
        style={({ pressed }) => [styles.tab, { backgroundColor: selected ? theme.accent : 'transparent', borderRadius: 12, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
        <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
          <Path d={tabIcons[tab]}
            fill="none" stroke={color} strokeWidth={selected ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[styles.tabLabel, { color, fontWeight: selected ? '700' : '500' }]}>{tabLabels[tab]}</Text>
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12, borderBottomWidth: 1, gap: 4 },
  title: { fontSize: 26, fontWeight: '700' },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 16 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: 16, gap: 4, paddingTop: 8, paddingBottom: 4, flexShrink: 0 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, gap: 4, paddingHorizontal: 4 },
  tabLabel: { fontSize: 13, textAlign: 'center' },
});
