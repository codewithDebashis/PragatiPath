import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type U = { id: string; email: string; name?: string; phone?: string; child_name?: string; child_age?: number; child_class?: string; user_id_code?: string; enrollment_status?: string; created_at?: string };

export default function AdminUsers() {
  const [items, setItems] = useState<U[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [resetFor, setResetFor] = useState<U | null>(null);
  const [resetOutcome, setResetOutcome] = useState<{ user: U; password: string } | null>(null);

  const load = async () => {
    try { const r = await api.get('/admin/users'); setItems(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const enrolled = items.filter((u) => u.enrollment_status === 'enrolled').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Users</Text>
        <Text style={styles.sub}>{items.length} parents · {enrolled} enrolled</Text>
      </View>
      <FlatList
        testID="admin-users-list"
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>No users yet</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`user-${item.id}`}>
            <View style={styles.row}>
              <View style={styles.avatar}><Ionicons name="person" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.muted}>{item.email}</Text>
                {item.phone ? <Text style={styles.muted}>{item.phone}</Text> : null}
              </View>
              <View style={[styles.badge, item.enrollment_status === 'enrolled' ? { backgroundColor: colors.success } : { backgroundColor: colors.warning }]}>
                <Text style={styles.badgeTxt}>{(item.enrollment_status || 'pending').toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Detail label="Child" value={item.child_name || '-'} />
              <Detail label="Age" value={item.child_age ? String(item.child_age) : '-'} />
              <Detail label="Class" value={item.child_class || '-'} />
            </View>
            <View style={styles.bottomRow}>
              <Text style={styles.code}>USER ID: {item.user_id_code}</Text>
              <TouchableOpacity testID={`reset-${item.id}`} style={styles.resetBtn} onPress={() => setResetFor(item)}>
                <Ionicons name="key" size={14} color="#fff" />
                <Text style={styles.resetBtnTxt}>Reset Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <ResetModal
        user={resetFor}
        onClose={() => setResetFor(null)}
        onDone={(r) => { setResetFor(null); setResetOutcome(r); }}
      />

      <Modal visible={!!resetOutcome} transparent animationType="fade" onRequestClose={() => setResetOutcome(null)}>
        <View style={styles.okBg}>
          <View style={styles.okCard}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} style={{ alignSelf: 'center' }} />
            <Text style={styles.okTitle}>Password Reset</Text>
            <Text style={styles.okSub}>Share these new credentials with the parent. The same has been delivered to their inbox.</Text>
            <View style={styles.okField}>
              <Text style={styles.okLabel}>Parent</Text>
              <Text style={styles.okVal}>{resetOutcome?.user.name || resetOutcome?.user.email}</Text>
            </View>
            <View style={styles.okField}>
              <Text style={styles.okLabel}>User ID</Text>
              <Text style={styles.okVal}>{resetOutcome?.user.user_id_code}</Text>
            </View>
            <View style={styles.okField}>
              <Text style={styles.okLabel}>New Password</Text>
              <Text style={styles.okVal}>{resetOutcome?.password}</Text>
            </View>
            <TouchableOpacity
              testID="copy-new-password"
              style={styles.copyBtn}
              onPress={async () => {
                if (!resetOutcome) return;
                const text = `Pragati Path\nUser ID: ${resetOutcome.user.user_id_code}\nEmail: ${resetOutcome.user.email}\nNew Password: ${resetOutcome.password}`;
                await Clipboard.setStringAsync(text);
                Alert.alert('Copied', 'Credentials copied');
              }}
            >
              <Ionicons name="copy" size={18} color={colors.primary} />
              <Text style={styles.copyTxt}>Copy credentials</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="close-reset-outcome" style={styles.okDoneBtn} onPress={() => setResetOutcome(null)}>
              <Text style={styles.okDoneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ResetModal({ user, onClose, onDone }: { user: U | null; onClose: () => void; onDone: (r: { user: U; password: string }) => void }) {
  const [mode, setMode] = useState<'random' | 'custom'>('random');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const confirm = () => {
    if (mode === 'custom' && custom.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }
    Alert.alert(
      'Reset password?',
      `${user.name || user.email}'s password will be changed. They will be notified in their inbox.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: doReset },
      ]
    );
  };

  const doReset = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/admin/users/${user.id}/reset-password`, {
        new_password: mode === 'custom' ? custom : undefined,
      });
      onDone({ user, password: r.data.new_password });
      setCustom(''); setMode('random');
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reset password</Text>
          <Text style={styles.muted}>for {user.name || user.email}</Text>

          <View style={styles.segment}>
            <TouchableOpacity
              testID="reset-mode-random"
              style={[styles.segBtn, mode === 'random' && styles.segActive]}
              onPress={() => setMode('random')}
            >
              <Text style={[styles.segTxt, mode === 'random' && { color: '#fff' }]}>Auto-generate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="reset-mode-custom"
              style={[styles.segBtn, mode === 'custom' && styles.segActive]}
              onPress={() => setMode('custom')}
            >
              <Text style={[styles.segTxt, mode === 'custom' && { color: '#fff' }]}>Set custom</Text>
            </TouchableOpacity>
          </View>

          {mode === 'custom' ? (
            <>
              <Text style={styles.label}>New Password (min 6 chars)</Text>
              <TextInput
                testID="reset-custom-input"
                style={styles.input}
                value={custom}
                onChangeText={setCustom}
                placeholder="e.g. Pragati@2026"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={false}
                autoCapitalize="none"
              />
            </>
          ) : (
            <View style={styles.noteBox}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={styles.noteTxt}>A secure random password will be generated and shown to you.</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={onClose}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="confirm-reset"
              style={[styles.confirmBtn, { flex: 1 }, busy && { opacity: 0.6 }]}
              onPress={confirm}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmTxt}>Reset</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.dLabel}>{label}</Text>
      <Text style={styles.dValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 8 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 2 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radii.card, marginBottom: 12, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  detailRow: { flexDirection: 'row', gap: 12 },
  dLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  dValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  code: { fontSize: 11, color: colors.secondary, fontWeight: '800', letterSpacing: 1 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100 },
  resetBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', padding: 40 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.primary },
  segment: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginTop: 16 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segActive: { backgroundColor: colors.primary },
  segTxt: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary },
  noteBox: { flexDirection: 'row', gap: 8, marginTop: 14, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 10, alignItems: 'flex-start' },
  noteTxt: { flex: 1, color: colors.primary, fontSize: 13, lineHeight: 18 },
  cancelBtn: { backgroundColor: '#F3F4F6', padding: 14, borderRadius: radii.button, alignItems: 'center' },
  cancelTxt: { color: colors.primary, fontWeight: '700' },
  confirmBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radii.button, alignItems: 'center' },
  confirmTxt: { color: '#fff', fontWeight: '800' },

  okBg: { flex: 1, backgroundColor: 'rgba(10,25,47,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  okCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 24, ...shadow },
  okTitle: { fontSize: 22, fontWeight: '800', color: colors.primary, textAlign: 'center', marginTop: 8 },
  okSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 18 },
  okField: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 8 },
  okLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  okVal: { fontSize: 15, color: colors.primary, fontWeight: '700', marginTop: 4 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  copyTxt: { color: colors.primary, fontWeight: '700' },
  okDoneBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radii.button, alignItems: 'center', marginTop: 10 },
  okDoneTxt: { color: '#fff', fontWeight: '800' },
});
