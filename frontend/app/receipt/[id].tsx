import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/payments/${id}`).then((r) => setP(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /></SafeAreaView>;
  }
  if (!p) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.primary} /></TouchableOpacity>
        </View>
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 60 }]}>Receipt not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="receipt-back"><Ionicons name="chevron-back" size={26} color={colors.primary} /></TouchableOpacity>
        <Text style={styles.h1}>Receipt</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} testID="receipt-screen">
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <Text style={styles.brand}>PRAGATI PATH</Text>
              <Text style={styles.tagline}>Designed for Winners</Text>
            </View>
            <View style={[styles.statusPill, statusBg(p.status)]}>
              <Text style={styles.statusTxt}>{(p.status || '').toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Row label="Receipt #" value={(p.id || '').slice(0, 8).toUpperCase()} />
          <Row label="Date" value={new Date(p.created_at).toLocaleString()} />
          <Row label="Parent" value={p.user_name || p.user_email} />
          {p.child_name ? <Row label="For child" value={p.child_name} /> : null}
          {p.utr ? <Row label="UTR" value={p.utr} /> : null}

          <View style={styles.divider} />

          <Text style={styles.section}>Items</Text>
          {(p.items || []).map((it: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemSub}>₹{it.price} × {it.qty}</Text>
              </View>
              <Text style={styles.itemTotal}>₹{it.line_total}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmt}>₹{p.amount}</Text>
          </View>

          {p.admin_note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteLabel}>Admin Note</Text>
              <Text style={styles.noteText}>{p.admin_note}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.thank}>Thank you for choosing Pragati Path 🏆</Text>
            <Text style={styles.muted}>This is a system-generated receipt.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

function statusBg(s: string) {
  if (s === 'approved') return { backgroundColor: colors.success };
  if (s === 'rejected') return { backgroundColor: colors.error };
  return { backgroundColor: colors.warning };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.primary },
  muted: { color: colors.textSecondary },
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: 24, ...shadow },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLeft: { flex: 1 },
  brand: { fontSize: 22, fontWeight: '900', color: colors.primary, letterSpacing: 1.5 },
  tagline: { color: colors.secondary, fontWeight: '700', marginTop: 2, fontSize: 12 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  statusTxt: { color: '#fff', fontWeight: '800', fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  kvLabel: { color: colors.textSecondary, fontSize: 13 },
  kvValue: { color: colors.textPrimary, fontWeight: '700', fontSize: 13, maxWidth: '60%', textAlign: 'right' },
  section: { color: colors.primary, fontWeight: '800', fontSize: 14, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { color: colors.textPrimary, fontWeight: '600' },
  itemSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  itemTotal: { color: colors.primary, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '800', letterSpacing: 1 },
  totalAmt: { fontSize: 28, fontWeight: '800', color: colors.primary },
  noteBox: { marginTop: 18, padding: 12, backgroundColor: '#FFF7E6', borderRadius: 10 },
  noteLabel: { fontSize: 11, color: '#92400E', fontWeight: '800', textTransform: 'uppercase' },
  noteText: { color: '#92400E', marginTop: 4 },
  footer: { marginTop: 24, alignItems: 'center', gap: 4 },
  thank: { color: colors.primary, fontWeight: '700' },
});
