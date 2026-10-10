import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatDuration } from '../domain/meter';
import type { TripRecord } from '../domain/tripHistory';
import type { ScreenTheme } from './TripHistoryScreen';

export type DriveHomeProps = {
  records: readonly TripRecord[];
  loading: boolean;
  error: string | null;
  onStartLog: () => void;
  onOpenTaxi: () => void;
  onOpenHistory: () => void;
  onOpenTrip: (record: TripRecord) => void;
  theme: ScreenTheme;
  disabled: boolean;
};

const distance = (meters: number) => `${(meters / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })} km`;
const tripDate = (value: string) => new Date(value).toLocaleString('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});

export function DriveHome({ records, loading, error, onStartLog, onOpenTaxi, onOpenHistory, onOpenTrip, theme, disabled }: DriveHomeProps) {
  const now = new Date();
  const monthly = records.filter(record => {
    const ended = new Date(record.endedAt);
    return ended.getFullYear() === now.getFullYear() && ended.getMonth() === now.getMonth();
  });
  const recent = [...records].sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt)).slice(0, 3);
  const totalDistance = monthly.reduce((total, record) => total + record.distanceMeters, 0);
  const totalSeconds = monthly.reduce((total, record) => total + record.durationSeconds, 0);

  return <View style={styles.home}>
    <View style={styles.intro}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>오늘의 이동을 기록하세요</Text>
      <Text style={[styles.body, { color: theme.muted }]}>주행 거리와 시간을 측정하고, 운행이 끝나면 기록으로 남겨요.</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onStartLog}
        style={({ pressed }) => [styles.start, { backgroundColor: theme.accent, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
        <Text style={[styles.startLabel, { color: theme.onAccent }]}>운행 기록 시작</Text>
        <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
          <Path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke={theme.onAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>

    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{now.getMonth() + 1}월 운행</Text>
      {loading ? <View style={styles.loading}><ActivityIndicator color={theme.accent} /><Text style={[styles.body, { color: theme.muted, flex: 1 }]}>운행 기록을 불러오는 중이에요.</Text></View>
        : error ? <View style={styles.error}>
          <Text accessibilityRole="alert" style={[styles.body, { color: theme.text }]}>{error}</Text>
          <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onOpenHistory} style={styles.textAction}>
            <Text style={[styles.link, { color: theme.accent, opacity: disabled ? 0.5 : 1 }]}>기록에서 다시 불러오기</Text>
          </Pressable>
        </View> : <>
          <View style={[styles.summary, { borderColor: theme.line, backgroundColor: theme.panel }]}>
            {[
              ['운행 횟수', `${monthly.length}회`],
              ['이동 거리', distance(totalDistance)],
              ['운행 시간', formatDuration(totalSeconds)],
            ].map(([label, value]) => <View key={label} style={styles.summaryRow}>
              <Text style={[styles.body, { color: theme.muted }]}>{label}</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{value}</Text>
            </View>)}
          </View>
          <Text style={[styles.caption, { color: theme.muted }]}>이 휴대폰에 저장된 기록 · 운행 완료일 기준</Text>
        </>}
    </View>

    {!loading && !error && <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>최근 운행</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="모든 운행 기록 보기" accessibilityState={{ disabled }} disabled={disabled} onPress={onOpenHistory} style={styles.textAction}>
          <Text style={[styles.link, { color: theme.accent, opacity: disabled ? 0.5 : 1 }]}>전체 보기</Text>
        </Pressable>
      </View>
      {recent.length === 0 ? <Text style={[styles.body, { color: theme.muted }]}>아직 저장된 운행이 없어요. 첫 운행을 시작해 보세요.</Text>
        : recent.map(record => <Pressable key={record.id} accessibilityRole="button" disabled={disabled}
          accessibilityState={{ disabled }} accessibilityLabel={`${tripDate(record.endedAt)}, ${distance(record.distanceMeters)}, ${formatDuration(record.durationSeconds)} 운행 기록 보기`}
          onPress={() => onOpenTrip(record)} style={({ pressed }) => [styles.record, { borderColor: theme.line, backgroundColor: theme.surface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
          <View style={styles.recordContent}>
            <Text style={[styles.body, { color: theme.muted }]}>{tripDate(record.endedAt)}</Text>
            <Text style={[styles.recordMetrics, { color: theme.text }]}>{distance(record.distanceMeters)} · {formatDuration(record.durationSeconds)}</Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
            <Path d="m9 5 7 7-7 7" fill="none" stroke={theme.muted} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>)}
    </View>}

    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onOpenTaxi}
      style={({ pressed }) => [styles.taxi, { borderColor: theme.line, backgroundColor: theme.surface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
      <View style={styles.recordContent}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>택시 미터기</Text>
        <Text style={[styles.body, { color: theme.muted }]}>거리와 저속 시간으로 요금도 계산해요.</Text>
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24" accessible={false}>
        <Path d="m9 5 7 7-7 7" fill="none" stroke={theme.accent} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  home: { gap: 28 }, intro: { gap: 12 }, heading: { fontSize: 27, fontWeight: '700', lineHeight: 36 },
  body: { fontSize: 15, lineHeight: 23 }, caption: { fontSize: 13, lineHeight: 20 },
  start: { minHeight: 56, padding: 16, marginTop: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  startLabel: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  section: { gap: 12 }, sectionTitle: { fontSize: 19, fontWeight: '600', flexShrink: 1 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  summary: { borderRadius: 16, padding: 20, gap: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  summaryValue: { fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, error: { gap: 8 },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { fontSize: 15, fontWeight: '600' },
  record: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderWidth: 1, borderRadius: 14, minHeight: 76 },
  recordContent: { flex: 1, gap: 4 }, recordMetrics: { fontSize: 19, fontWeight: '600', lineHeight: 27, fontVariant: ['tabular-nums'] },
  taxi: { borderWidth: 1, borderRadius: 14, padding: 20, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
