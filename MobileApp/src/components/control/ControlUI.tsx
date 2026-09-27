import { useState, type PropsWithChildren, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '@/types/auth';

export type LoadState = { error: string; isLoading: boolean; isRefreshing: boolean; isUpdating: boolean; refresh: () => void };
export const controlColors = { background: '#f5fafb', ink: '#17323b', teal: '#1f7a8c', muted: '#607080', border: '#dbe4eb' };

export function ControlHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={s.heading}><Text style={s.eyebrow}>TRAVELHUB CONTROL</Text><Text accessibilityRole="header" style={s.title}>{title}</Text><Text style={s.muted}>{subtitle}</Text></View>;
}

export function ControlButton({ label, onPress, disabled = false, busy = false, tone = 'secondary' }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: 'primary' | 'secondary' | 'danger';
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [s.button, tone === 'primary' && s.primaryButton, tone === 'danger' && s.dangerButton, (pressed || disabled || busy) && s.dim]}>
    {busy ? <ActivityIndicator color={tone === 'primary' ? '#ffffff' : controlColors.teal} /> : null}
    <Text style={[s.buttonText, tone === 'primary' && s.primaryText, tone === 'danger' && s.dangerText]}>{label}</Text>
  </Pressable>;
}

export function FeedNotice({ feed, success }: { feed: LoadState; success?: string }) {
  return <>
    {success ? <View style={s.success}><Text accessibilityLiveRegion="polite" style={s.successText}>{success}</Text></View> : null}
    {feed.error ? <View style={s.notice}><Text accessibilityRole="alert" style={s.noticeText}>{feed.error}</Text><ControlButton label="Retry" onPress={feed.refresh} disabled={feed.isUpdating || feed.isRefreshing} /></View> : null}
    {feed.isLoading ? <View style={s.loading}><ActivityIndicator accessibilityLabel="Loading details" color={controlColors.teal} /><Text style={s.muted}>Loading details…</Text></View> : null}
  </>;
}

export function EmptyCard({ title, message }: { title: string; message: string }) {
  return <View style={s.card}><Text accessibilityRole="header" style={s.cardTitle}>{title}</Text><Text style={s.muted}>{message}</Text></View>;
}

export function SearchField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
    editable={!disabled} onChangeText={onChange} placeholder="Search…" placeholderTextColor={controlColors.muted} style={s.input} value={value} /></View>;
}

export function Choices<T extends string>({ values, selected, onChange, disabled = false }: { values: readonly T[]; selected: T; onChange: (value: T) => void; disabled?: boolean }) {
  return <View style={s.choices}>{values.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === selected, disabled }}
    disabled={disabled} onPress={() => onChange(value)} style={[s.chip, value === selected && s.selectedChip, disabled && s.dim]}><Text style={[s.chipText, value === selected && s.primaryText]}>{value}</Text></Pressable>)}</View>;
}

export function Person({ user, children }: PropsWithChildren<{ user: AuthUser }>) {
  return <View style={s.person}><View style={s.row}><View style={s.avatar}><Text style={s.avatarText}>{user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text></View>
    <View style={s.grow}><Text style={s.cardTitle}>{user.name}</Text><Text style={s.label}>{user.role}</Text></View>
    {user.isBlocked ? <Text style={s.blocked}>Blocked</Text> : null}</View>
    <Text selectable style={s.muted}>{user.email}</Text><Text selectable style={s.muted}>{user.phoneNumber || 'Phone not provided'}</Text>{children}</View>;
}

export function CallButton({ name, phone }: { name: string; phone?: string | null }) {
  const [error, setError] = useState('');
  const number = phone?.replace(/[^\d+]/g, '') ?? '';
  async function call() {
    setError('');
    try { await Linking.openURL(`tel:${number}`); }
    catch { setError('Unable to open the phone app. Use the number shown above.'); }
  }
  return <View style={s.field}><Text selectable style={s.muted}>{phone || 'Phone not provided'}</Text>
    {number ? <ControlButton label={`Call ${name}`} onPress={() => void call()} /> : null}
    {error ? <Text accessibilityRole="alert" style={s.noticeText}>{error}</Text> : null}</View>;
}

export function ControlScreen({ children, feed }: PropsWithChildren<{ feed?: LoadState }>) {
  return <SafeAreaView edges={['left', 'right']} style={s.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}
    refreshControl={feed ? <RefreshControl refreshing={feed.isRefreshing} onRefresh={feed.refresh} enabled={!feed.isUpdating} tintColor={controlColors.teal} /> : undefined}>{children}</ScrollView></SafeAreaView>;
}

export function ControlList<T>({ data, header, renderItem, keyFor, empty, feed }: {
  data: T[]; header: ReactElement; renderItem: (item: T) => ReactElement; keyFor: (item: T) => string; empty?: ReactElement; feed: LoadState;
}) {
  return <SafeAreaView edges={['left', 'right']} style={s.safe}><FlatList data={data} keyExtractor={keyFor} keyboardShouldPersistTaps="handled"
    contentContainerStyle={s.content} ListHeaderComponent={header} ListEmptyComponent={empty} renderItem={({ item }) => renderItem(item)}
    refreshControl={<RefreshControl refreshing={feed.isRefreshing} onRefresh={feed.refresh} enabled={!feed.isUpdating} tintColor={controlColors.teal} />} /></SafeAreaView>;
}

export function ControlModal({ title, busy, onClose, children }: PropsWithChildren<{ title: string; busy: boolean; onClose: () => void }>) {
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={s.modalBackdrop}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalKeyboard}>
      <View accessibilityViewIsModal onAccessibilityEscape={() => { if (!busy) onClose(); }} style={s.modalCard}>
        <View style={s.modalHeader}><Text accessibilityRole="header" style={[s.cardTitle, s.grow]}>{title}</Text><ControlButton label="Cancel" disabled={busy} onPress={onClose} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalContent}>{children}</ScrollView>
      </View>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

export const s = StyleSheet.create({
  safe: { backgroundColor: controlColors.background, flex: 1 },
  content: { flexGrow: 1, padding: 20, paddingBottom: 32, gap: 16 },
  heading: { gap: 9, paddingTop: 8, marginBottom: 8 },
  eyebrow: { color: controlColors.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: controlColors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  muted: { color: controlColors.muted, fontSize: 14, lineHeight: 22, flexShrink: 1 },
  label: { color: controlColors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  field: { gap: 7 },
  input: { backgroundColor: '#ffffff', borderColor: '#c6dbe2', borderWidth: 1, borderRadius: 12, color: controlColors.ink, minHeight: 48, fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  card: { backgroundColor: '#ffffff', borderColor: controlColors.border, borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  cardTitle: { color: controlColors.ink, fontSize: 18, fontWeight: '800', lineHeight: 25, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  grow: { flex: 1, minWidth: 80, gap: 4 },
  group: { gap: 16 },
  button: { minHeight: 48, borderRadius: 12, borderColor: '#c6dfe4', borderWidth: 1, backgroundColor: '#eff7f8', paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: controlColors.teal, fontSize: 14, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  primaryButton: { backgroundColor: controlColors.teal, borderColor: controlColors.teal },
  primaryText: { color: '#ffffff' },
  dangerButton: { backgroundColor: '#fff6f5', borderColor: '#e5c7c4' },
  dangerText: { color: '#a53e36' },
  dim: { opacity: 0.5 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderColor: '#d2e3e8', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#ffffff' },
  chipText: { color: '#42616e', fontSize: 12, fontWeight: '700' },
  selectedChip: { backgroundColor: controlColors.teal, borderColor: controlColors.teal },
  loading: { alignItems: 'center', gap: 12, padding: 28 },
  notice: { backgroundColor: '#fff8ee', borderColor: '#eadcc8', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  noticeText: { color: '#825125', fontSize: 14, lineHeight: 22 },
  success: { borderRadius: 14, backgroundColor: '#edf7f1', padding: 14 },
  successText: { color: '#27764e', fontSize: 14, lineHeight: 22 },
  person: { gap: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e4f2f4', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: controlColors.teal, fontSize: 15, fontWeight: '800' },
  blocked: { color: '#a53e36', fontSize: 11, fontWeight: '700', backgroundColor: '#fff0ee', padding: 7, borderRadius: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9, 35, 44, 0.5)' },
  modalKeyboard: { flex: 1, padding: 12, justifyContent: 'center', alignItems: 'center' },
  modalCard: { flex: 1, maxHeight: '94%', width: '100%', maxWidth: 640, backgroundColor: controlColors.background, borderRadius: 22, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomColor: controlColors.border, borderBottomWidth: 1 },
  modalContent: { padding: 18, gap: 16, paddingBottom: 30 },
});
