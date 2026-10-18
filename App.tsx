import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, Animated, AppState, BackHandler, Easing, Linking, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { tripEntry } from './src/domain/navigation';
import { formatDuration, formatFare } from './src/domain/meter';
import { useTaxiMeter } from './src/hooks/useTaxiMeter';
import { useCarPlayActivity } from './src/hooks/useCarPlayActivity';
import { useReceiptSettings } from './src/hooks/useReceiptSettings';
import { SettingsScreen } from './src/components/SettingsScreen';
import { useTripHistory } from './src/hooks/useTripHistory';
import { TripRecord, type TripModeFilter } from './src/domain/tripHistory';
import { ReceiptScreen, TripHistoryScreen } from './src/components/TripHistoryScreen';
import { DriveHome } from './src/components/DriveHome';
import { MainTabs, NavigationHeader } from './src/components/AppNavigation';
import { RideMotion, useReducedMotion } from './src/components/RideMotion';
import { importNativeTrips } from './src/carplay/nativeMeter';

import { themes } from './src/theme';

const labels = { idle: '출발 준비', running: '주행 중', paused: '일시정지', finished: '주행 완료' };

export default function App() {
  const theme = themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const history = useTripHistory();
  const receiptSettings = useReceiptSettings();
  const [screen, setScreen] = useState<'home' | 'drive' | 'meter' | 'history' | 'receipt' | 'settings'>('home');
  const [historyFilter, setHistoryFilter] = useState<TripModeFilter>('all');
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);
  const [receiptOrigin, setReceiptOrigin] = useState<'home' | 'drive' | 'history'>('home');
  const [sharingReceipt, setSharingReceipt] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [requestedMode, setRequestedMode] = useState<'log' | 'taxi'>('log');
  const { nativeHistory, mode, meter, completedTrip, tripElapsedSeconds, speed, gpsMessage, busy, begin, pause, finish, reset,
    carPlayConnected, pendingTrips, acknowledgeCompletedTrips } = useTaxiMeter();
  const carPlay = useCarPlayActivity({ mode, status: meter.status, fare: meter.fare, distanceMeters: meter.totalDistanceMeters, elapsedSeconds: tripElapsedSeconds }, true, carPlayConnected);
  const text = { color: theme.text };
  const { save } = history;
  const pendingTripIds = pendingTrips[0]?.id;
  const importingTrips = useRef(new Set<string>());
  useEffect(() => {
    const importNext = () => {
      const trip = pendingTrips[0];
      if (!trip || importingTrips.current.has(trip.id)) return;
      importingTrips.current.add(trip.id);
      void importNativeTrips([trip], async record => {
        const ok = await save(record);
        if (record.id === completedTrip?.id) setSaveStatus(ok ? 'saved' : 'error');
        return ok;
      }, acknowledgeCompletedTrips)
        .catch(() => {}) // Native outbox retains the receipt if the bridge is interrupted.
        .finally(() => importingTrips.current.delete(trip.id));
    };
    importNext();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') importNext(); });
    return () => subscription.remove();
  }, [pendingTripIds, save, acknowledgeCompletedTrips]);
  useEffect(() => {
    if (!completedTrip) { setSaveStatus('idle'); return; }
    if (nativeHistory) {
      setSaveStatus(pendingTrips.some(trip => trip.id === completedTrip.id) ? 'saving' : 'saved');
      return;
    }
    let live = true;
    setSaveStatus('saving');
    void save(completedTrip).then(ok => { if (live) setSaveStatus(ok ? 'saved' : 'error'); });
    return () => { live = false; };
  }, [completedTrip?.id, save, nativeHistory, pendingTripIds]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sharingReceipt) return true;
      if (screen === 'receipt') { setScreen(receiptOrigin); return true; }
      if (screen !== 'home') { setScreen('home'); return true; }
      return false;
    });
    return () => listener.remove();
  }, [screen, receiptOrigin, sharingReceipt]);
  const showReceipt = (trip: TripRecord, origin: 'home' | 'drive' | 'history') => {
    setSelectedTrip(trip); setReceiptOrigin(origin); setScreen('receipt');
  };
  const prepareNext = () => {
    if (saveStatus === 'saving') return;
    if (saveStatus === 'error') {
      Alert.alert('아직 저장되지 않은 기록이 있어요', '새 주행을 준비하면 이 기록이 사라집니다. 먼저 영수증을 공유할 수 있습니다.', [
        { text: '돌아가기', style: 'cancel' }, { text: '저장하지 않고 진행', style: 'destructive', onPress: () => { reset(); setScreen('home'); } },
      ]);
    } else { reset(); setScreen('home'); }
  };
  const openMode = async (next: 'log' | 'taxi') => {
    const entry = tripEntry(meter.status, mode, next, saveStatus === 'saved');
    if (entry === 'blocked') {
      Alert.alert('진행 중인 운행이 있습니다', '현재 운행을 종료한 뒤 다른 기능을 시작할 수 있습니다.');
      return;
    }
    if (entry === 'unsaved') {
      Alert.alert('운행 기록 저장을 확인해 주세요', '완료 화면에서 기록 저장을 마친 뒤 새 운행을 시작할 수 있습니다.');
      setScreen('drive'); return;
    }
    if (entry === 'reset' && await reset() === false) return;
    setRequestedMode(next); setScreen('drive');
  };
  const displayMode = meter.status === 'idle' ? requestedMode : mode;
  const isLog = displayMode === 'log';
  const inTrip = meter.status !== 'idle';
  const pinnedControls = meter.status === 'running' || meter.status === 'paused';
  const reducedMotion = useReducedMotion();
  const transition = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const scrollPositions = useRef({ history: 0 });
  useEffect(() => {
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: screen === 'history' ? scrollPositions.current.history : 0, animated: false }));
    transition.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(transition, {
      toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => { cancelAnimationFrame(frame); animation.stop(); };
  }, [inTrip, screen, selectedTrip?.id, reducedMotion, transition]);
  const button = (label: string, action: () => void, primary = false) => (
    <Pressable accessibilityRole="button" disabled={busy || sharingReceipt} onPress={action}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? theme.accent : 'transparent', borderColor: theme.line, borderWidth: primary ? 0 : 1, opacity: busy || sharingReceipt ? 0.5 : pressed ? 0.7 : 1 }]}>
      <Text style={[styles.buttonText, { color: primary ? theme.onAccent : theme.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]}>
        <StatusBar style="auto" />
        <NavigationHeader title={screen === 'settings' ? '설정' : screen === 'history' ? '주행 기록' : screen === 'receipt' ? (selectedTrip?.mode === 'log' ? '운행 상세' : '영수증') : screen === 'drive' ? (isLog ? '운행 기록' : '택시 미터기') : '운행노트'}
          backLabel={receiptOrigin === 'history' ? '주행 기록' : receiptOrigin === 'home' ? '운행' : '주행 완료'}
          onBack={screen === 'receipt' ? () => setScreen(receiptOrigin) : undefined}
          disabled={sharingReceipt} theme={theme} />
        <ScrollView ref={scroll} style={[styles.scroller, { backgroundColor: theme.background }]} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets scrollEventThrottle={100}
          onScroll={event => { if (screen === 'history') scrollPositions.current.history = event.nativeEvent.contentOffset.y; }}>
          <Animated.View style={[styles.content, { opacity: transition, transform: [{ translateX: transition.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]} >
          {screen === 'home' ? <>
            {inTrip && button(meter.status === 'finished' ? '완료한 운행 확인' : '진행 중인 운행 보기', () => setScreen('drive'), true)}
            <DriveHome records={history.records} loading={history.loading} error={history.error} theme={theme}
              disabled={busy || sharingReceipt} onStartLog={() => openMode('log')} onOpenTaxi={() => openMode('taxi')}
              onOpenHistory={() => setScreen('history')} onOpenTrip={trip => showReceipt(trip, 'home')} />
          </> : screen === 'settings' ? <SettingsScreen settings={receiptSettings} theme={theme} />
          : screen === 'history' ? <TripHistoryScreen {...history} remove={async id => {
            try {
              // Remove the native retry copy before deleting the durable history entry.
              if (nativeHistory) await acknowledgeCompletedTrips([id]);
              await history.remove(id);
            } catch { Alert.alert('기록을 삭제하지 못했습니다', '기록 동기화가 완료된 뒤 다시 시도해 주세요.'); }
          }} filter={historyFilter} setFilter={value => { setHistoryFilter(value); scrollPositions.current.history = 0; scroll.current?.scrollTo({ y: 0, animated: false }); }} theme={theme} onSelect={trip => showReceipt(trip, 'history')} />
          : screen === 'receipt' && selectedTrip?.mode !== 'log' && receiptSettings.loading ? <ActivityIndicator color={theme.accent} />
          : screen === 'receipt' && selectedTrip?.mode !== 'log' && receiptSettings.error ? <><Text style={{ color: theme.text }}>{receiptSettings.error}</Text>{button('설정 열기', () => setScreen('settings'))}</>
          : screen === 'receipt' && selectedTrip ? <ReceiptScreen key={selectedTrip.id} companyKeyword={receiptSettings.keyword} trip={selectedTrip} theme={theme} onSharingChange={setSharingReceipt} />
          : <>
          <View style={styles.header}>
            <Text style={[styles.state, { color: theme.muted }]}>{labels[meter.status]}</Text>
          </View>
          {!inTrip ? (
            <View style={styles.welcome}>
              {!isLog && <RideMotion running={false} color={theme.accent} surface={theme.background} line={theme.line} />}
              <Text accessibilityRole="header" style={[styles.title, text]}>{isLog ? '오늘의 운행을 기록하세요' : '택시 미터기'}</Text>
              <Text style={[styles.notice, { color: theme.muted }]}>{isLog ? 'GPS로 거리와 시간을 측정하고 운행 기록으로 저장합니다. 요금은 계산하지 않습니다.' : '선택한 주행에만 거리와 저속 시간을 합산해 요금을 계산합니다.'}</Text>
              <Text style={[styles.notice, { color: theme.muted }]}>안전 운전 하세요</Text>
            </View>
          ) : <>
          {!isLog && <RideMotion running={meter.status === 'running'} color={theme.accent} surface={theme.background} line={theme.line} />}
          {!isLog && <View style={[styles.meter, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.label, { color: theme.muted }]}>{meter.status === 'finished' ? '이번 주행의 요금' : '요금'}</Text>
            <Text accessibilityLabel={`요금 ${meter.fare}원`} style={[styles.fare, text]}>{formatFare(meter.fare)}<Text style={styles.currency}> 원</Text></Text>
            <Text style={[styles.notice, { color: theme.muted }]}>안전 운전 하세요</Text>
          </View>}
          <View style={[styles.readings, { borderColor: theme.line, backgroundColor: theme.surface }]}>
            {[
              ['이동 거리', `${(meter.totalDistanceMeters / 1000).toFixed(2)} km`],
              ['측정 시간', formatDuration(tripElapsedSeconds)],
              ['현재 속도', speed === null ? '— km/h' : `${Math.round(speed)} km/h`],
            ].map(([label, value]) => (
              <View key={label} style={styles.reading}>
                <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
                <Text style={[styles.value, text]}>{value}</Text>
              </View>
            ))}
          </View>
          </>}
          <View style={[styles.gps, { backgroundColor: theme.panel }]}>
            {busy && <ActivityIndicator color={theme.accent} />}
            <Text style={[styles.notice, { color: theme.muted, flex: 1 }]}>{gpsMessage}</Text>
          </View>
          {!inTrip && isLog && <Text style={[styles.notice, { color: theme.muted }]}>운행 기록은 이 기기에 저장됩니다. CarPlay 연결 없이 앱을 벗어나면 측정을 일시정지합니다. GPS 신호가 불확실한 구간의 거리는 제외합니다.</Text>}
          {carPlay.errorMessage && <Text accessibilityRole="alert" style={[styles.notice, { color: theme.muted }]}>{carPlay.errorMessage}</Text>}
          <View style={styles.actions}>
            {meter.status === 'idle' && button(isLog ? '운행 기록 시작' : '미터기 시작', () => { void begin(displayMode); }, true)}
            {meter.status === 'finished' && completedTrip && <>
              {button(isLog ? '운행 기록 보기 및 공유' : '영수증 보기 및 공유', () => showReceipt(completedTrip, 'drive'), true)}
              <Text style={[styles.notice, { color: theme.muted }]}>{saveStatus === 'saving' ? '주행 기록 저장 중…' : saveStatus === 'saved' ? '주행 기록에 저장했습니다.' : '주행 기록을 저장하지 못했습니다.'}</Text>
              {saveStatus === 'error' && button('기록 저장 다시 시도', () => {
                setSaveStatus('saving'); void save(completedTrip).then(ok => setSaveStatus(ok ? 'saved' : 'error'));
              })}
              {saveStatus !== 'saving' && button('새 주행 준비', prepareNext)}
            </>}
          </View>
          {!inTrip && !isLog && <View style={[styles.rules, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.ruleTitle, text]}>요금 안내</Text>
            <Text style={[styles.notice, { color: theme.muted }]}>기본 1.6 km까지 4,800원. 이후 이동 거리 131 m마다 100원, 15 km/h 이하에서는 30초마다 100원이 추가됩니다.</Text>
            <Text style={[styles.notice, { color: theme.muted }]}>{carPlayConnected ? 'CarPlay 연결 중에는 화면을 잠가도 측정합니다. 연결이 끊긴 상태에서 앱을 벗어나면 측정을 멈춥니다.' : '앱을 벗어나면 측정을 멈춥니다.'} 기본거리 안에서는 대기 요금이 없습니다. GPS가 불확실한 구간은 요금 계산에서 제외하며, 완료한 주행 기록은 이 휴대폰에 저장됩니다.</Text>
            <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings().catch(() => {}); }} style={styles.settings}>
              <Text style={[styles.settingsText, text]}>위치 권한 설정 열기</Text>
            </Pressable>
          </View>}
          </>}
          </Animated.View>
        </ScrollView>
        {pinnedControls && <View style={[styles.pinnedControls, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={styles.controlSlot}>{button(meter.status === 'running' ? '일시정지' : '다시 시작', meter.status === 'running' ? pause : () => { void begin(); }, true)}</View>
          <View style={styles.controlSlot}>{button('주행 종료', () => { finish(); setScreen('drive'); })}</View>
        </View>}
        <MainTabs active={screen === 'drive' ? (isLog ? 'home' : 'meter') : screen === 'receipt' ? (receiptOrigin === 'drive' ? (isLog ? 'home' : 'meter') : receiptOrigin) : screen} onSelect={tab => tab === 'meter' ? openMode('taxi') : setScreen(tab)}
          theme={theme} disabled={busy || sharingReceipt} running={meter.status === 'running'} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroller: { flex: 1 },
  scroll: { flexGrow: 1 },
  pinnedControls: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, width: '100%', maxWidth: 640, alignSelf: 'center', flexShrink: 0 },
  controlSlot: { flex: 1 },
  welcome: { gap: 24, paddingVertical: 12 },
  content: { flexGrow: 1, padding: 24, gap: 28, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  state: { fontSize: 16 },
  meter: { padding: 20, gap: 12, borderRadius: 16, borderWidth: 1 },
  label: { fontSize: 15 },
  fare: { fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'] },
  currency: { fontSize: 24, fontWeight: '500' },
  notice: { fontSize: 15, lineHeight: 23 },
  readings: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 20 },
  reading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  value: { fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'] },
  gps: { padding: 16, borderRadius: 12, flexDirection: 'row', gap: 12, minHeight: 48, flexShrink: 1 },
  actions: { gap: 12 },
  button: { minHeight: 56, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14 },
  buttonText: { fontSize: 18, fontWeight: '600' },
  rules: { gap: 12, padding: 20, borderRadius: 16, borderWidth: 1 },
  ruleTitle: { fontSize: 17, fontWeight: '600' },
  settings: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  settingsText: { fontSize: 15, textDecorationLine: 'underline' },
});
