import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Ref = { id: string; name: string; email: string; user_id_code: string; child_name?: string; referrer_code: string; enrollment_status?: string; created_at: string };

export default function ReferralsAdmin() {
  const router = useRouter();
  const [bonus, setBonus] = useState('');
  const [refs, setRefs] = useState<Ref[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, r] = await Promise.all([api.get('/admin/referral-settings'), api.get('/admin/referrals')]);
      setBonus(String(s.data.registration_bonus || 0)); setRefs(r.data);
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/referral-settings', { registration_bonus: Number(bonus || 0) });
      Alert.alert('Saved', 'Sign-up bonus updated');
    } catch (e: any) { Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="ref-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Referrals</Text>
          <Text style={styles.sub}>Bonus + relationships</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-referrals">
        <View style={styles.card}>
          <Text style={styles.section}>Sign-up Bonus</Text>
          <Text style={styles.muted}>Amount credited to a referrer when a new parent registers via their code. Per-item commission is set inside Items.</Text>
          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput testID="ref-bonus" style={styles.input} value={bonus} onChangeText={setBonus} keyboardType="numeric" placeholder="200" placeholderTextColor="#9CA3AF" />
          <TouchableOpacity testID="save-ref-bonus" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Referral Tree</Text>
          {refs.length === 0 ? <Text style={styles.muted}>No referrals yet.</Text> : refs.map((r) => (
            <View key={r.id} style={styles.refRow} testID={`ref-${r.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.refName}>{r.name}</Text>
                <Text style={styles.muted}>{r.email}</Text>
                <Text style={styles.refMeta}>Joined via <Text style={styles.refCode}>{r.referrer_code}</Text></Text>
              </View>
              <View style={[styles.pill, r.enrollment_status === 'enrolled' ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.pillTxt, { color: r.enrollment_status === 'enrolled' ? '#065F46' : '#92400E' }]}>{(r.enrollment_status || 'pending').toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 12, ...shadow },
  section: { color: colors.primary, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  muted: { color: colors.textSecondary, fontSize: 12 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary },
  saveBtn: { backgroundColor: colors.secondary, padding: 14, borderRadius: radii.button, alignItems: 'center', marginTop: 14 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  refRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  refName: { color: colors.primary, fontWeight: '800' },
  refMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  refCode: { color: colors.secondary, fontWeight: '800' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillTxt: { fontSize: 10, fontWeight: '800' },
});
