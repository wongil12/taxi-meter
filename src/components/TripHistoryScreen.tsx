import { receiptCompanyName } from '../domain/receiptSettings';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { formatDuration, formatFare } from '../domain/meter';
import { filterTripHistory, monthlyTripSummary, formatTripReceipt, TripRecord, type TripModeFilter } from '../domain/tripHistory';

export type ScreenTheme = { background: string; surface: string; panel: string; text: string; muted: string; line: string; accent: string; onAccent: string };
const date = (iso: string) => new Date(iso).toLocaleString('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function TripHistoryScreen({ records, loading, error, reload, remove, theme, onSelect, filter, setFilter }: {
  filter: TripModeFilter; setFilter: (filter: TripModeFilter) => void;
  records: TripRecord[]; loading: boolean; error: string | null; reload: () => Promise<void>;
  remove: (id: string) => Promise<void>; theme: ScreenTheme; onSelect: (trip: TripRecord) => void;
}) {
  const visible = filterTripHistory(records, filter);
  const month = new Date();
  const summary = monthlyTripSummary(records, month, filter);
  return <>
    <View style={styles.filters}>
      {([['all', '전체'], ['log', '운행 기록'], ['taxi', '택시 미터']] as const).map(([value, label]) =>
        <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)}
          style={[styles.filter, { backgroundColor: filter === value ? theme.accent : 'transparent', borderColor: theme.line }]}>
          <Text style={[styles.body, { color: filter === value ? theme.onAccent : theme.text }]}>{label}</Text>
        </Pressable>)}
    </View>
    {!loading && !error && <View style={[styles.summary, { backgroundColor: theme.panel }]}>
      <Text style={[styles.actionText, { color: theme.text }]}>{month.getFullYear()}년 {month.getMonth() + 1}월 · {summary.count}건</Text>
      <Text style={[styles.body, { color: theme.text }]}>{(summary.distanceMeters / 1000).toFixed(1)} km · {formatDuration(summary.durationSeconds)}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>선택한 종류의 저장된 기록 기준입니다.</Text>
    </View>}
    <Text style={[styles.body, { color: theme.muted }]}>최근 100건을 이 휴대폰에 보관합니다.</Text>
    {loading ? <ActivityIndicator color={theme.accent} /> : null}
    {error && <><Text accessibilityRole="alert" style={[styles.body, { color: theme.text }]}>{error}</Text><Action label="다시 불러오기" onPress={() => { void reload(); }} theme={theme} /></>}
    {!loading && !error && visible.length === 0 && <Text style={[styles.body, { color: theme.muted }]}>표시할 운행 기록이 없어요. 운행을 종료하면 여기에 남습니다.</Text>}
    {visible.map(record => <View key={record.id} style={[styles.row, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${date(record.endedAt)}, ${record.mode === 'log' ? '운행 기록 보기' : `${formatFare(record.fare)}원 영수증 보기`}`} onPress={() => onSelect(record)} style={styles.record}>
        <Text style={[styles.body, { color: theme.muted }]}>{date(record.endedAt)}</Text>
        <Text style={[styles.total, { color: theme.text }]}>{record.mode === 'log' ? '운행 기록' : `${formatFare(record.fare)}원`}</Text>
        <Text style={[styles.body, { color: theme.muted }]}>{(record.distanceMeters / 1000).toFixed(2)} km · {formatDuration(record.durationSeconds)}</Text>
        <Text style={[styles.body, { color: theme.accent }]}>{record.mode === 'log' ? '기록 보기' : '영수증 보기'}</Text>
      </Pressable>
      <Action label="기록 삭제" onPress={() => Alert.alert('이 주행 기록을 삭제할까요?', '삭제한 기록은 복구할 수 없습니다.', [
        { text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => { void remove(record.id); } },
      ])} theme={theme} />
    </View>)}
  </>;
}

export function ReceiptScreen({ trip, theme, companyKeyword, onSharingChange }: { trip: TripRecord; theme: ScreenTheme; companyKeyword: string; onSharingChange: (sharing: boolean) => void }) {
  const isLog = trip.mode === 'log';
  const documentTitle = isLog ? '운행 기록' : '주행 영수증';
  const receipt = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  useEffect(() => { onSharingChange(sharing); return () => onSharingChange(false); }, [sharing, onSharingChange]);
  const [error, setError] = useState<string | null>(null);
  const shareImage = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true; setSharing(true); setError(null);
    let uri: string | undefined;
    let handedOff = false;
    try {
      if (!await Sharing.isAvailableAsync()) { setError('이 기기에서는 이미지 공유를 사용할 수 없습니다. 텍스트로 공유해 주세요.'); return; }
      uri = await captureRef(receipt, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `${documentTitle} 공유` });
      // Android recipients can read the URI after the chooser returns. Keep the
      // temporary cache file alive; view-shot cleans temporary captures on restart.
      handedOff = true;
    } catch { setError('이미지를 공유하지 못했습니다. 다시 시도하거나 텍스트로 공유해 주세요.'); }
    finally { if (uri && !handedOff) releaseCapture(uri); sharingRef.current = false; setSharing(false); }
  };
  const shareText = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true; setSharing(true); setError(null);
    try { await Share.share({ title: documentTitle, message: formatTripReceipt(trip, companyKeyword) }); }
    catch { setError('공유 창을 열지 못했습니다. 다시 시도해 주세요.'); }
    finally { sharingRef.current = false; setSharing(false); }
  };
  return <>
    <View ref={receipt} collapsable={false} style={styles.receipt}>
      <Text style={styles.receiptBrand}>{isLog ? '운행 기록' : '택시 미터'}</Text>
      <Text style={styles.receiptTitle}>{isLog ? '거리와 시간' : documentTitle}</Text>
      <View style={styles.receiptDivider} />
      {[
        ['출발', date(trip.startedAt)], ['도착', date(trip.endedAt)],
        ['이동 거리', `${(trip.distanceMeters / 1000).toFixed(2)} km`],
        ['측정 시간', formatDuration(trip.durationSeconds)],
      ].map(([label, value]) => <View style={styles.receiptRow} key={label}>
        <Text style={styles.receiptLabel}>{label}</Text><Text style={styles.receiptValue}>{value}</Text>
      </View>)}
      <View style={styles.receiptDivider} />
      {!isLog && <>
      <Text style={styles.receiptLabel}>요금</Text>
      <Text style={styles.receiptFare}>{formatFare(trip.fare)}원</Text>
      <View style={styles.receiptDivider} />
      <Text style={styles.receiptFooter}>{receiptCompanyName(companyKeyword)}</Text>
      </>}
    </View>
    {error && <Text accessibilityRole="alert" style={[styles.body, { color: theme.text }]}>{error}</Text>}
    <Action label={sharing ? '공유 준비 중…' : `${documentTitle} 이미지 공유`} onPress={() => { void shareImage(); }} theme={theme} primary disabled={sharing} />
    <Action label="텍스트로 공유" onPress={() => { void shareText(); }} theme={theme} disabled={sharing} />
  </>;
}
function Action({ label, onPress, theme, primary = false, disabled = false }: {
  label: string; onPress: () => void; theme: ScreenTheme; primary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [styles.action, { backgroundColor: primary ? theme.accent : 'transparent', opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
    <Text style={[styles.actionText, { color: primary ? theme.onAccent : theme.text }]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, borderWidth: 1 },
  summary: { gap: 8, padding: 20, borderRadius: 16 },
  heading: { fontSize: 28, fontWeight: '700' }, body: { fontSize: 15, lineHeight: 23 },
  row: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 8 }, record: { gap: 8, paddingVertical: 8 },
  total: { fontSize: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  action: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 14 },
  actionText: { fontSize: 17, fontWeight: '600' },
  receipt: { backgroundColor: '#FFFEF8', padding: 24, gap: 16 },
  receiptBrand: { fontSize: 18, fontWeight: '700', color: '#192119', textAlign: 'center' },
  receiptTitle: { fontSize: 14, color: '#52604F', textAlign: 'center' },
  receiptDivider: { borderTopWidth: 1, borderColor: '#CDD4C7', borderStyle: 'dashed', marginVertical: 4 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  receiptLabel: { fontSize: 15, color: '#52604F' },
  receiptValue: { fontSize: 15, color: '#192119', fontVariant: ['tabular-nums'] },
  receiptFare: { fontSize: 40, fontWeight: '700', color: '#192119', fontVariant: ['tabular-nums'] },
  receiptFooter: { fontSize: 15, color: '#52604F', textAlign: 'center' },
});
