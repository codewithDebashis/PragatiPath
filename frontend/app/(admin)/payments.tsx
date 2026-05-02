import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Payment = {
  id: string; user_email: string; user_name?: string; child_name?: string; amount: number;
  utr?: string; screenshot_base64?: string; status: string; note?: string; admin_note?: string; created_at: string;
};

export default function AdminPayments() {
  const [items, setItems] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Payment | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await api.get('/admin/payments', { params: filter !== 'all' ? { status: filter } : {} });
      setItems(r.data);
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, [filter]));

  const decide = async (p: Payment, decision: 'approve' | 'reject', note?: string) => {
    setBusyId(p.id);
    try {
      await api.post(`/admin/payments/${p.id}/decide`, { decision, admin_note: note });
      await load();
      Alert.alert('Done', decision === 'approve' ? 'Payment approved. Parent has been notified with credentials.' : 'Payment rejected.');
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusyId(null); setRejectFor(null); setAdminNote(''); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Payments</Text>
        <Text style={styles.sub}>Verify UPI payments from parents</Text>
        <View style={styles.filters}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              testID={`filter-${f}`}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipTxt, filter === f && styles.chipTxtActive]}>{f.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-payments-list">
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle" size={48} color={colors.textSecondary} />
            <Text style={styles.muted}>No {filter !== 'all' ? filter : ''} payments</Text>
          </View>
        )}
        {items.map((p) => (
          <View key={p.id} style={styles.card} testID={`payment-card-${p.id}`}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.amount}>₹{p.amount}</Text>
                <Text style={styles.userText}>{p.user_name || p.user_email}</Text>
                <Text style={styles.muted}>Child: {p.child_name || '-'}</Text>
                <Text style={styles.muted}>{new Date(p.created_at).toLocaleString()}</Text>
                {p.utr ? <Text style={styles.utr}>UTR: {p.utr}</Text> : null}
              </View>
              <View style={[styles.badge, badgeStyle(p.status)]}>
                <Text style={styles.badgeTxt}>{p.status.toUpperCase()}</Text>
              </View>
            </View>
            {p.screenshot_base64 ? (
              <TouchableOpacity onPress={() => setZoom(p.screenshot_base64!)} testID={`view-shot-${p.id}`}>
                <Image source={{ uri: `data:image/jpeg;base64,${p.screenshot_base64}` }} style={styles.shot} />
              </TouchableOpacity>
            ) : null}
            {p.admin_note ? <Text style={styles.adminNote}>Admin note: {p.admin_note}</Text> : null}
            {p.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  testID={`approve-${p.id}`}
                  style={[styles.actBtn, { backgroundColor: colors.success }]}
                  disabled={busyId === p.id}
                  onPress={() => decide(p, 'approve')}
                >
                  {busyId === p.id ? <ActivityIndicator color="#fff" /> : (
                    <><Ionicons name="checkmark" color="#fff" size={18} /><Text style={styles.actTxt}>Approve & Enroll</Text></>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`reject-${p.id}`}
                  style={[styles.actBtn, { backgroundColor: colors.error }]}
                  onPress={() => setRejectFor(p)}
                >
                  <Ionicons name="close" color="#fff" size={18} />
                  <Text style={styles.actTxt}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!rejectFor} transparent animationType="slide" onRequestClose={() => setRejectFor(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Payment</Text>
            <Text style={styles.muted}>Add a note for the parent (optional):</Text>
            <TextInput
              testID="reject-note"
              style={styles.modalInput}
              value={adminNote}
              onChangeText={setAdminNote}
              placeholder="e.g. Payment not received"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: colors.border, flex: 1 }]} onPress={() => setRejectFor(null)}>
                <Text style={[styles.actTxt, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirm-reject"
                style={[styles.actBtn, { backgroundColor: colors.error, flex: 1 }]}
                onPress={() => rejectFor && decide(rejectFor, 'reject', adminNote || undefined)}
              >
                <Text style={styles.actTxt}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!zoom} transparent onRequestClose={() => setZoom(null)}>
        <TouchableOpacity style={styles.zoomBg} onPress={() => setZoom(null)} activeOpacity={1}>
          {zoom && <Image source={{ uri: `data:image/jpeg;base64,${zoom}` }} style={styles.zoomImg} />}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function badgeStyle(s: string) {
  if (s === 'approved') return { backgroundColor: colors.success };
  if (s === 'rejected') return { backgroundColor: colors.error };
  return { backgroundColor: colors.warning };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 8 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 2 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.textSecondary, fontWeight: '700', fontSize: 11 },
  chipTxtActive: { color: '#fff' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radii.card, marginBottom: 12, ...shadow },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  amount: { fontSize: 24, fontWeight: '800', color: colors.primary },
  userText: { color: colors.textPrimary, fontWeight: '600', marginTop: 4 },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  utr: { color: colors.primary, fontSize: 13, marginTop: 4, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#fff', fontWeight: '800', fontSize: 11 },
  shot: { width: '100%', height: 180, borderRadius: 10, marginTop: 12, backgroundColor: '#F3F4F6' },
  adminNote: { color: colors.textSecondary, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  actTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 10, minHeight: 80, color: colors.textPrimary, textAlignVertical: 'top' },
  zoomBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  zoomImg: { width: '95%', height: '80%', resizeMode: 'contain' },
});
