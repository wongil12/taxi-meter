import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { formatDuration, formatFare } from './src/domain/meter';
import { useTaxiMeter } from './src/hooks/useTaxiMeter';

const themes = {
  dark: { background: '#121612', text: '#F5F5E9', muted: '#B7C0B6', line: '#384238', accent: '#E4F28B', onAccent: '#19210D' },
  light: { background: '#F8F9F2', text: '#192119', muted: '#52604F', line: '#CDD4C7', accent: '#344E25', onAccent: '#FFFFFF' },
};
const labels = { idle: '출발 준비', running: '주행 중', paused: '일시정지', finished: '주행 완료' };

export default function App() {
  const theme = themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { meter, speed, gpsMessage, busy, begin, pause, finish, reset } = useTaxiMeter();
  const text = { color: theme.text };
  const button = (label: string, action: () => void, primary = false) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={action}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? theme.accent : 'transparent', borderColor: theme.line, borderWidth: primary ? 0 : 1, opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}>
      <Text style={[styles.buttonText, { color: primary ? theme.onAccent : theme.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <StatusBar style="auto" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, text]}>택시 놀이</Text>
            <Text style={[styles.state, { color: theme.muted }]}>{labels[meter.status]}</Text>
          </View>
          <View style={styles.meter}>
            <Text style={[styles.label, { color: theme.muted }]}>{meter.status === 'finished' ? '이번 주행의 가상 요금' : '가상 요금'}</Text>
            <Text accessibilityLabel={`가상 요금 ${meter.fare}원`} style={[styles.fare, text]}>{formatFare(meter.fare)}<Text style={styles.currency}> 원</Text></Text>
            <Text style={[styles.notice, { color: theme.muted }]}>재미로만 즐겨요. 실제 택시 요금이 아닙니다.</Text>
          </View>
          <View style={[styles.readings, { borderColor: theme.line }]}>
            {[
              ['이동 거리', `${(meter.totalDistanceMeters / 1000).toFixed(2)} km`],
              ['측정 시간', formatDuration(meter.elapsedSeconds)],
              ['현재 속도', `${Math.round(speed)} km/h`],
            ].map(([label, value]) => (
              <View key={label} style={styles.reading}>
                <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
                <Text style={[styles.value, text]}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.gps}>
            {busy && <ActivityIndicator color={theme.accent} />}
            <Text style={[styles.notice, { color: theme.muted, flex: 1 }]}>{gpsMessage}</Text>
          </View>
          <View style={styles.actions}>
            {(meter.status === 'idle' || meter.status === 'paused') && button(meter.status === 'paused' ? '다시 시작' : '주행 시작', () => { void begin(); }, true)}
            {meter.status === 'running' && button('일시정지', pause, true)}
            {(meter.status === 'running' || meter.status === 'paused') && button('주행 종료', finish)}
            {meter.status === 'finished' && button('새 주행 준비', reset, true)}
          </View>
          <View style={styles.rules}>
            <Text style={[styles.ruleTitle, text]}>오늘의 놀이 요금표</Text>
            <Text style={[styles.notice, { color: theme.muted }]}>기본 1.6 km까지 4,800원. 이후 15 km/h 초과 시 131 m마다 100원, 저속에서는 30초마다 100원씩 올라갑니다.</Text>
            <Text style={[styles.notice, { color: theme.muted }]}>기본거리 안에서는 대기 요금이 없습니다. 화면을 벗어나거나 GPS가 끊긴 동안은 계산하지 않습니다. 주행 기록은 저장되지 않습니다.</Text>
            <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings().catch(() => {}); }} style={styles.settings}>
              <Text style={[styles.settingsText, text]}>위치 권한 설정 열기</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, padding: 24, gap: 28, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  state: { fontSize: 16 },
  meter: { paddingVertical: 24, gap: 12 },
  label: { fontSize: 15 },
  fare: { fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'] },
  currency: { fontSize: 24, fontWeight: '500' },
  notice: { fontSize: 15, lineHeight: 23 },
  readings: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 20, gap: 18 },
  reading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  value: { fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] },
  gps: { flexDirection: 'row', gap: 12, minHeight: 48, flexShrink: 1 },
  actions: { gap: 12 },
  button: { minHeight: 56, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14 },
  buttonText: { fontSize: 18, fontWeight: '600' },
  rules: { gap: 12, paddingTop: 8 },
  ruleTitle: { fontSize: 17, fontWeight: '600' },
  settings: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  settingsText: { fontSize: 15, textDecorationLine: 'underline' },
});
