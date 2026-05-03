import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii } from '../../src/theme';

type W = { id: string; user_name?: string; user_email: string; amount: number; status: string; upi_id?: string; note?: string; admin_note?: string; created_at: string };

export default function AdminWithdrawals() {
  const router = useRouter();
  const [items, setItems] = useState<W[]>([]);
  const [filter, setFilter] = useState<'requested' | 'approved' | 'paid' | 'rejected' | 'all'>('requested');
  const [decideFor, setDecideFor] = useState<{ w: W; decision: 'approve' | 'paid' | 'reject' } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const r = await api.get('/admin/withdrawals', { params: filter !== 'all' ? { status: filter } : {} }); setItems(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, [filter]));

  const decide = async () => {
    if (!decideFor) return;
    setBusy(true);
    try {
      await api.post(`/admin/withdrawals/${decideFor.w.id}/decide`, { decision: decideFor.decision, admin_note: adminNote || undefined });
      setDecideFor(null); setAdminNote('');
      await load();
    } catch (e: any) { Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="wd-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Withdrawals</Text>
          <Text style={styles.sub}>Process payout requests</Text>
        </View>
      </View>
      <View style={styles.filters}>
        {(['requested', 'approved', 'paid', 'rejected', 'all'] as const).map((f) => (
          <TouchableOpacity key={f} testID={`wd-filter-${f}`} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.chipTxt, filter === f && { color: '#fff' }]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-withdrawals">
        {items.length === 0 && <View style={styles.empty}><Ionicons name="cash-outline" size={48} color="#9CA3AF" /><Text style={styles.muted}>No {filter !== 'all' ? filter : ''} withdrawals</Text></View>}
        {items.map((w) => (
          <View key={w.id} style={styles.card} testID={`wd-card-${w.id}`}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.amount}>₹{w.amount.toFixed(0)}</Text>
                <Text style={styles.userTxt}>{w.user_name || w.user_email}</Text>
                {w.upi_id ? <Text style={styles.muted}>UPI: {w.upi_id}</Text> : null}
                <Text style={styles.muted}>{new Date(w.created_at).toLocaleString()}</Text>
                {w.note ? <Text style={styles.muted}>Note: {w.note}</Text> : null}
                {w.admin_note ? <Text style={styles.adminNote}>Admin: {w.admin_note}</Text> : null}
              </View>
              <View style={[styles.badge, statusColor(w.status)]}><Text style={styles.badgeTxt}>{w.status.toUpperCase()}</Text></View>
            </View>
            {(w.status === 'requested' || w.status === 'approved') && (
              <View style={styles.actions}>
                {w.status === 'requested' && (
                  <TouchableOpacity testID={`approve-wd-${w.id}`} style={[styles.actBtn, { backgroundColor: '#3B82F6' }]} onPress={() => { setAdminNote(''); setDecideFor({ w, decision: 'approve' }); }}>
                    <Text style={styles.actTxt}>Approve</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity testID={`paid-wd-${w.id}`} style={[styles.actBtn, { backgroundColor: colors.success }]} onPress={() => { setAdminNote(''); setDecideFor({ w, decision: 'paid' }); }}>
                  <Text style={styles.actTxt}>Mark Paid</Text>
                </TouchableOpacity>
                {w.status === 'requested' && (
                  <TouchableOpacity testID={`reject-wd-${w.id}`} style={[styles.actBtn, { backgroundColor: colors.error }]} onPress={() => { setAdminNote(''); setDecideFor({ w, decision: 'reject' }); }}>
                    <Text style={styles.actTxt}>Reject</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!decideFor} transparent animationType="slide" onRequestClose={() => setDecideFor(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{decideFor?.decision === 'paid' ? 'Confirm Paid' : decideFor?.decision === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}</Text>
            <Text style={styles.muted}>
              {decideFor?.decision === 'paid' ? `Marking ₹${decideFor?.w.amount} as paid will deduct from the user's wallet.` : `Optional note for the user:`}
            </Text>
            <TextInput testID="wd-admin-note" style={styles.modalInput} value={adminNote} onChangeText={setAdminNote} placeholder="e.g. Paid via UPI" placeholderTextColor="#9CA3AF" multiline />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.actBtn, { flex: 1, backgroundColor: '#F3F4F6' }]} onPress={() => setDecideFor(null)}><Text style={[styles.actTxt, { color: colors.primary }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity testID="wd-confirm" style={[styles.actBtn, { flex: 1, backgroundColor: colors.primary }, busy && { opacity: 0.6 }]} onPress={decide} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actTxt}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function statusColor(s: string) {
  if (s === 'paid') return { backgroundColor: colors.success };
  if (s === 'approved') return { backgroundColor: '#3B82F6' };
  if (s === 'rejected') return { backgroundColor: colors.error };
  return { backgroundColor: colors.warning };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: '#0E2A4F' },
  chipActive: { backgroundColor: colors.secondary },
  chipTxt: { color: '#9CA3AF', fontWeight: '700', fontSize: 11 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  amount: { fontSize: 22, fontWeight: '800', color: colors.primary },
  userTxt: { color: colors.textPrimary, fontWeight: '700', marginTop: 4 },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  adminNote: { color: colors.primary, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#fff', fontWeight: '800', fontSize: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 10, minHeight: 80, color: colors.textPrimary, textAlignVertical: 'top' },
});
