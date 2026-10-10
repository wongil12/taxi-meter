import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { receiptCompanyName } from '../domain/receiptSettings';
import type { useReceiptSettings } from '../hooks/useReceiptSettings';
import type { ScreenTheme } from './TripHistoryScreen';

export function SettingsScreen({ settings, theme }: { settings: ReturnType<typeof useReceiptSettings>; theme: ScreenTheme }) {
  const [draft, setDraft] = useState(settings.keyword);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(settings.keyword); }, [settings.keyword]);
  const disabled = settings.loading || settings.saving;
  const submit = async () => {
    Keyboard.dismiss();
    if (await settings.save(draft)) { setDraft(draft.trim()); setSaved(true); }
  };
  return <>
    <Text style={[styles.title, { color: theme.text }]}>택시 미터기 영수증 이름</Text>
    <Text style={[styles.body, { color: theme.muted }]}>택시 미터기 영수증에만 적용합니다. 키워드 뒤에 ‘운수’가 붙어요. 예: 우정 → 우정운수</Text>
    {settings.loading ? <ActivityIndicator color={theme.accent} /> : <>
      <View style={[styles.inputRow, { borderColor: theme.line, backgroundColor: theme.surface }]}>
        <TextInput accessibilityLabel="운수 이름 키워드" value={draft} onChangeText={value => { setDraft(value); setSaved(false); }}
          editable={!disabled} maxLength={12} placeholder="예: 우정" placeholderTextColor={theme.muted}
          autoCorrect={false} returnKeyType="done" onSubmitEditing={() => { void submit(); }}
          style={[styles.input, { color: theme.text }]} />
        <Text style={[styles.suffix, { color: theme.muted }]}>운수</Text>
      </View>
      <Text style={[styles.body, { color: theme.muted }]}>1~12자 · 저장하면 기존 기록의 영수증에도 적용됩니다.</Text>
      <View style={[styles.preview, { borderColor: theme.line, backgroundColor: theme.panel }]}>
        <Text style={[styles.body, { color: theme.muted }]}>영수증 하단 미리보기</Text>
        <Text style={[styles.name, { color: theme.text }]}>{draft.trim() ? `${draft.trim()}운수` : receiptCompanyName()}</Text>
      </View>
    </>}
    {settings.error && <Text accessibilityRole="alert" style={[styles.body, { color: theme.text }]}>{settings.error}</Text>}
    {saved && !settings.error && <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.accent }]}>저장했습니다.</Text>}
    <Pressable accessibilityRole="button" disabled={disabled || !draft.trim()} onPress={() => { void submit(); }}
      style={[styles.save, { backgroundColor: theme.accent, opacity: disabled || !draft.trim() ? 0.5 : 1 }]}>
      <Text style={[styles.saveText, { color: theme.onAccent }]}>{settings.saving ? '저장 중…' : '이름 저장'}</Text>
    </Pressable>
    {settings.error && <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { setSaved(false); void settings.reload(); }} style={styles.retry}>
      <Text style={[styles.body, { color: theme.text }]}>설정 다시 불러오기</Text>
    </Pressable>}
  </>;
}
const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600' }, body: { fontSize: 15, lineHeight: 23 },
  inputRow: { borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input: { flex: 1, minHeight: 56, fontSize: 20, paddingVertical: 12 }, suffix: { fontSize: 20 },
  preview: { borderRadius: 16, paddingVertical: 24, alignItems: 'center', gap: 16 },
  name: { fontSize: 24, fontWeight: '600' },
  save: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, padding: 16 },
  saveText: { fontSize: 18, fontWeight: '600' }, retry: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
});
