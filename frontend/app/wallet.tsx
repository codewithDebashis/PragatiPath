import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { api, formatApiError } from '../src/api';
import { useAuth } from '../src/auth';
import { colors, radii, shadow } from '../src/theme';

type Txn = { id: string; type: string; amount: number; note?: string; created_at: string; ref_user_name?: string; item_name?: string };
type Withdrawal = { id: string; amount: number; status: string; admin_note?: string; created_at: string; upi_id?: string };

export default function Wallet() {
  const router = useRouter();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [refCount, setRefCount] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = async () => {
    try {
      const [w, ws] = await Promise.all([api.get('/wallet/me'), api.get('/wallet/withdrawals/me')]);
      setBalance(w.data.balance); setTxns(w.data.transactions); setRefCount(w.data.referral_count); setBonus(w.data.registration_bonus);
      setWithdrawals(ws.data);
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const code = user?.user_id_code || '';
  const baseUrl = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
  const referLink = code ? `${baseUrl}/register?ref=${code}` : '';
  const copyCode = async () => { await Clipboard.setStringAsync(code); Alert.alert('Copied', 'Referral code copied'); };
  const copyLink = async () => { await Clipboard.setStringAsync(referLink); Alert.alert('Copied', 'Referral link copied'); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} testID="wallet-screen">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="wallet-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
          <Text style={styles.h1}>Wallet</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balLabel}>Available Balance</Text>
          <Text style={styles.balValue}>₹{balance.toFixed(0)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statN}>{refCount}</Text><Text style={styles.statL}>Referrals</Text></View>
            <View style={styles.statSep} />
            <View style={styles.stat}><Text style={styles.statN}>₹{bonus.toFixed(0)}</Text><Text style={styles.statL}>Sign-up Bonus</Text></View>
          </View>
          <TouchableOpacity testID="open-withdraw" style={styles.withdrawBtn} onPress={() => setShowWithdraw(true)}>
            <Ionicons name="cash" size={18} color={colors.primary} />
            <Text style={styles.withdrawTxt}>Request Withdrawal</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refer & Earn</Text>
          <View style={styles.referCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.muted}>Your code</Text>
              <Text style={styles.code}>{code}</Text>
              <Text style={styles.referHint}>Share this code with parents. You earn ₹{bonus.toFixed(0)} on sign-up + commission on every course they buy.</Text>
            </View>
            <TouchableOpacity testID="show-qr" style={styles.qrBtn} onPress={() => setShowQR(true)}>
              <Ionicons name="qr-code" size={28} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.referActions}>
            <TouchableOpacity testID="copy-code" style={styles.actionBtn} onPress={copyCode}>
              <Ionicons name="copy" size={18} color={colors.primary} />
              <Text style={styles.actionTxt}>Copy code</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="copy-link" style={styles.actionBtn} onPress={copyLink}>
              <Ionicons name="link" size={18} color={colors.primary} />
              <Text style={styles.actionTxt}>Copy link</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Requests</Text>
          {withdrawals.length === 0 ? <Text style={styles.muted}>No withdrawal requests yet.</Text> : (
            withdrawals.map((w) => (
              <View key={w.id} style={styles.txnRow} testID={`wd-${w.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>₹{w.amount.toFixed(0)} {w.upi_id ? `→ ${w.upi_id}` : ''}</Text>
                  <Text style={styles.muted}>{new Date(w.created_at).toLocaleString()}</Text>
                  {w.admin_note ? <Text style={styles.muted}>Note: {w.admin_note}</Text> : null}
                </View>
                <View style={[styles.badge, wdColor(w.status)]}><Text style={styles.badgeTxt}>{w.status.toUpperCase()}</Text></View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {txns.length === 0 ? <Text style={styles.muted}>No transactions yet.</Text> : (
            txns.map((t) => (
              <View key={t.id} style={styles.txnRow} testID={`txn-${t.id}`}>
                <View style={[styles.txnIcon, t.amount >= 0 ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name={t.amount >= 0 ? 'arrow-down' : 'arrow-up'} color={t.amount >= 0 ? colors.success : colors.error} size={16} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>{t.note || labelOf(t.type)}</Text>
                  <Text style={styles.muted}>{new Date(t.created_at).toLocaleString()}</Text>
                </View>
                <Text style={[styles.txnAmt, { color: t.amount >= 0 ? colors.success : colors.error }]}>
                  {t.amount >= 0 ? '+' : ''}₹{Math.abs(t.amount).toFixed(0)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowQR(false)}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Your Referral QR</Text>
            <Text style={styles.muted}>Scanning opens the sign-up page with your code pre-filled.</Text>
            <View style={styles.qrBox}>
              {referLink ? <QRCode value={referLink} size={220} /> : null}
            </View>
            <Text style={styles.qrCode}>{code}</Text>
            <Text style={styles.qrLink} numberOfLines={2}>{referLink}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity testID="qr-copy-link" style={[styles.actionBtn, { flex: 1 }]} onPress={copyLink}>
                <Ionicons name="link" size={18} color={colors.primary} />
                <Text style={styles.actionTxt}>Copy link</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="qr-share" style={[styles.actionBtn, { flex: 1 }]} onPress={async () => {
                try {
                  const Share = await import('react-native').then(m => m.Share);
                  await Share.share({ message: `Join Pragati Path using my referral! ${referLink}` });
                } catch {}
              }}>
                <Ionicons name="share-social" size={18} color={colors.primary} />
                <Text style={styles.actionTxt}>Share</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowQR(false)}>
              <Text style={styles.closeBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <WithdrawModal visible={showWithdraw} balance={balance} onClose={() => setShowWithdraw(false)} onDone={() => { setShowWithdraw(false); load(); }} />
    </SafeAreaView>
  );
}

function WithdrawModal({ visible, balance, onClose, onDone }: any) {
  const [amount, setAmount] = useState('');
  const [upi, setUpi] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { Alert.alert('Enter valid amount'); return; }
    if (amt > balance) { Alert.alert('Insufficient balance', `You have ₹${balance.toFixed(0)}`); return; }
    setBusy(true);
    try {
      await api.post('/wallet/withdraw', { amount: amt, upi_id: upi || undefined, note: note || undefined });
      Alert.alert('Submitted', 'Withdrawal request sent. Admin will process it.');
      setAmount(''); setUpi(''); setNote('');
      onDone();
    } catch (e: any) { Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <Text style={styles.qrTitle}>Request Withdrawal</Text>
          <Text style={styles.muted}>Available: ₹{balance.toFixed(0)}</Text>
          <Text style={styles.label}>Amount (₹) *</Text>
          <TextInput testID="wd-amount" style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="500" placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>Your UPI ID (where to pay)</Text>
          <TextInput testID="wd-upi" style={styles.input} value={upi} onChangeText={setUpi} placeholder="yourname@upi" placeholderTextColor="#9CA3AF" autoCapitalize="none" />
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput testID="wd-note" style={styles.input} value={note} onChangeText={setNote} placeholder="" placeholderTextColor="#9CA3AF" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={onClose}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity testID="submit-wd" style={[styles.confirmBtn, { flex: 1 }, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmTxt}>Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function wdColor(s: string) {
  if (s === 'paid') return { backgroundColor: colors.success };
  if (s === 'rejected') return { backgroundColor: colors.error };
  if (s === 'approved') return { backgroundColor: '#3B82F6' };
  return { backgroundColor: colors.warning };
}
function labelOf(t: string) {
  return ({ register_bonus: 'Sign-up bonus', item_commission: 'Course commission', withdrawal_paid: 'Withdrawal' } as any)[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  balanceCard: { margin: 16, marginTop: 0, padding: 24, backgroundColor: '#0E2A4F', borderRadius: 20 },
  balLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  balValue: { color: '#fff', fontSize: 44, fontWeight: '800', marginTop: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  stat: { flex: 1 },
  statN: { color: colors.secondary, fontSize: 18, fontWeight: '800' },
  statL: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statSep: { width: 1, backgroundColor: '#1a2a44', marginHorizontal: 16, alignSelf: 'stretch' },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: colors.secondary },
  withdrawTxt: { color: colors.primary, fontWeight: '800' },
  section: { backgroundColor: '#fff', marginTop: 12, padding: 20, borderRadius: 16, marginHorizontal: 16, ...shadow },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.primary, marginBottom: 12 },
  referCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#F8F9FA', borderRadius: 12 },
  muted: { color: colors.textSecondary, fontSize: 12 },
  code: { color: colors.primary, fontSize: 22, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  referHint: { color: colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 16 },
  qrBtn: { padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  referActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  actionTxt: { color: colors.primary, fontWeight: '700' },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  txnIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txnTitle: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
  txnAmt: { fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#fff', fontWeight: '800', fontSize: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(10,25,47,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  qrCard: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center' },
  qrTitle: { fontSize: 20, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  qrBox: { padding: 16, marginTop: 14, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  qrCode: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: 3, marginTop: 12 },
  qrLink: { fontSize: 11, color: colors.textSecondary, marginTop: 6, textAlign: 'center', maxWidth: 280 },
  closeBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginTop: 16 },
  closeBtnTxt: { color: '#fff', fontWeight: '800' },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary },
  cancelBtn: { backgroundColor: '#F3F4F6', padding: 14, borderRadius: radii.button, alignItems: 'center' },
  cancelTxt: { color: colors.primary, fontWeight: '700' },
  confirmBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radii.button, alignItems: 'center' },
  confirmTxt: { color: '#fff', fontWeight: '800' },
});
