import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { colors, radii, shadow } from '../../src/theme';

type Upi = { upi_id: string; qr_image_base64?: string; fee_amount?: number; instructions?: string };
type Payment = { id: string; amount: number; status: string; utr?: string; created_at: string; admin_note?: string };

export default function Payment() {
  const { user, refresh } = useAuth();
  const [upi, setUpi] = useState<Upi | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [utr, setUtr] = useState('');
  const [shot, setShot] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const [u, p] = await Promise.all([api.get('/upi-settings'), api.get('/payments/me')]);
      setUpi(u.data); setPayments(p.data);
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); refresh(); }, []));

  const pickShot = async () => {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) { Alert.alert('Permission needed', 'Please allow gallery access to upload screenshot.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]?.base64) setShot(res.assets[0].base64);
  };

  const submit = async () => {
    if (!utr && !shot) { setErr('Please add UTR/Transaction ID or upload a screenshot'); return; }
    setBusy(true); setErr('');
    try {
      await api.post('/payments', {
        amount: upi?.fee_amount || 0,
        utr: utr || undefined,
        screenshot_base64: shot || undefined,
      });
      setUtr(''); setShot('');
      await load();
      Alert.alert('Submitted', 'Your payment is pending admin confirmation. You will receive a message once approved.');
    } catch (e: any) { setErr(formatApiError(e?.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const copyUpi = async () => {
    if (upi?.upi_id) {
      await Clipboard.setStringAsync(upi.upi_id);
      Alert.alert('Copied', 'UPI ID copied to clipboard');
    }
  };

  const enrolled = user?.enrollment_status === 'enrolled';
  const pending = payments.find((p) => p.status === 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} testID="payment-screen">
        <Text style={styles.h1}>Pay Fees</Text>
        <Text style={styles.sub}>Scan the QR / use UPI ID, then upload screenshot or UTR</Text>

        {enrolled && (
          <View style={[styles.banner, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" color={colors.success} size={24} />
            <Text style={[styles.bannerText, { color: '#065F46' }]}>Your child is enrolled. Future fees can still be paid here.</Text>
          </View>
        )}

        {pending && (
          <View style={[styles.banner, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="time" color={colors.warning} size={24} />
            <Text style={[styles.bannerText, { color: '#92400E' }]}>A payment of ₹{pending.amount} is pending admin confirmation.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.amount}>₹{upi?.fee_amount?.toFixed(0) || '0'}</Text>

          <Text style={styles.label}>UPI QR Code</Text>
          {upi?.qr_image_base64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${upi.qr_image_base64}` }} style={styles.qr} testID="upi-qr" />
          ) : (
            <View style={[styles.qr, styles.qrPlaceholder]}>
              <Ionicons name="qr-code" size={80} color={colors.primary} />
              <Text style={styles.muted}>QR not set by admin yet</Text>
            </View>
          )}

          <Text style={styles.label}>UPI ID</Text>
          <TouchableOpacity testID="copy-upi" style={styles.upiRow} onPress={copyUpi}>
            <Text style={styles.upiId}>{upi?.upi_id || '—'}</Text>
            <Ionicons name="copy" size={18} color={colors.primary} />
          </TouchableOpacity>

          {upi?.instructions ? (
            <Text style={styles.instructions}>{upi.instructions}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>I have paid</Text>
          <Text style={styles.label}>UTR / Transaction ID (optional)</Text>
          <TextInput
            testID="utr-input"
            style={styles.input}
            value={utr}
            onChangeText={setUtr}
            placeholder="e.g. 123456789012"
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity testID="pick-screenshot" style={styles.pickBtn} onPress={pickShot}>
            <Ionicons name="image" size={20} color={colors.primary} />
            <Text style={styles.pickText}>{shot ? 'Screenshot attached ✓' : 'Upload payment screenshot'}</Text>
          </TouchableOpacity>

          {shot ? (
            <Image source={{ uri: `data:image/jpeg;base64,${shot}` }} style={styles.preview} />
          ) : null}

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <TouchableOpacity testID="submit-payment" style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit for Approval</Text>}
          </TouchableOpacity>
        </View>

        {payments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.section}>Payment History</Text>
            {payments.map((p) => (
              <View key={p.id} style={styles.histRow} testID={`payment-${p.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histAmt}>₹{p.amount}</Text>
                  <Text style={styles.histDate}>{new Date(p.created_at).toLocaleString()}</Text>
                  {p.utr ? <Text style={styles.histDate}>UTR: {p.utr}</Text> : null}
                </View>
                <View style={[styles.badge, badgeStyle(p.status)]}>
                  <Text style={styles.badgeTxt}>{p.status.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  scroll: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: radii.card, marginBottom: 16, ...shadow },
  section: { fontSize: 16, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  amount: { fontSize: 36, fontWeight: '800', color: colors.primary },
  qr: { width: '100%', aspectRatio: 1, borderRadius: 12, marginTop: 6, backgroundColor: '#F3F4F6' },
  qrPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  muted: { color: colors.textSecondary, marginTop: 8 },
  upiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', padding: 14, borderRadius: 10 },
  upiId: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  instructions: { color: colors.textSecondary, marginTop: 12, lineHeight: 18, fontSize: 13 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, backgroundColor: '#F3F4F6', marginTop: 12 },
  pickText: { color: colors.primary, fontWeight: '700' },
  preview: { width: 100, height: 100, borderRadius: 8, marginTop: 10 },
  btn: { backgroundColor: colors.secondary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  err: { color: colors.error, marginTop: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, marginBottom: 12 },
  bannerText: { fontWeight: '600', flex: 1 },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  histAmt: { fontSize: 16, fontWeight: '700', color: colors.primary },
  histDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
