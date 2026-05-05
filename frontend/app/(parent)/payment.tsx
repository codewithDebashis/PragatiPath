import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, ActivityIndicator,
  Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Item = { id: string; name: string; description?: string; price: number; item_type: string; image_base64?: string; sample_url?: string; sample_image_base64?: string };
type Upi = { upi_id: string; qr_image_base64?: string; instructions?: string };
type Child = { id: string; name: string; child_class?: string; enrollment_status?: string };
type Payment = { id: string; amount: number; status: string; utr?: string; created_at: string; items?: any[]; child_name?: string };

const TYPE_LABELS: Record<string, string> = {
  course: 'Courses', material: 'Study Materials', merch: 'Merchandise', other: 'Other',
};
const TYPE_COLORS: Record<string, string> = {
  course: '#0A192F', material: '#1E40AF', merch: '#7C2D12', other: '#374151',
};

export default function ShopPay() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');

  const load = async () => {
    try {
      const [it, ch, pay] = await Promise.all([
        api.get('/items'),
        api.get('/children/me'),
        api.get('/payments/me'),
      ]);
      setItems(it.data); setChildren(ch.data); setPayments(pay.data);
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const sub = (id: string) => setCart((c) => {
    const next = { ...c };
    if ((next[id] || 0) <= 1) delete next[id]; else next[id] = next[id] - 1;
    return next;
  });

  const cartLines = Object.entries(cart).map(([id, qty]) => {
    const it = items.find((x) => x.id === id);
    return it ? { ...it, qty } : null;
  }).filter(Boolean) as (Item & { qty: number })[];
  const total = cartLines.reduce((s, l) => s + l.price * l.qty, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const hasCourse = cartLines.some((l) => l.item_type === 'course');

  const grouped: Record<string, Item[]> = {};
  for (const it of items) {
    const g = it.item_type || 'other';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(it);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: cartCount ? 120 : 40 }]} testID="shop-screen">
        <Text style={styles.h1}>Shop & Pay</Text>
        <Text style={styles.sub}>Select courses or items, then check out</Text>

        {Object.entries(grouped).map(([type, list]) => (
          <View key={type} style={{ marginTop: 18 }}>
            <View style={styles.sectionHead}>
              <View style={[styles.typeDot, { backgroundColor: TYPE_COLORS[type] || '#374151' }]} />
              <Text style={styles.section}>{TYPE_LABELS[type] || type}</Text>
            </View>
            {list.map((it) => (
              <View key={it.id} style={styles.itemCard} testID={`item-${it.id}`}>
                {it.image_base64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${it.image_base64}` }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name={it.item_type === 'course' ? 'book' : it.item_type === 'merch' ? 'shirt' : 'document-text'} size={28} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  {it.description ? <Text style={styles.itemDesc}>{it.description}</Text> : null}
                  <Text style={styles.itemPrice}>₹{it.price}</Text>
                  {(it.sample_url || it.sample_image_base64) ? (
                    <TouchableOpacity
                      testID={`sample-${it.id}`}
                      style={styles.sampleBtn}
                      onPress={() => {
                        if (it.sample_url) { Linking.openURL(it.sample_url); return; }
                        if (it.sample_image_base64) { setPreviewImg(it.sample_image_base64); setPreviewTitle(it.name); }
                      }}
                    >
                      <Ionicons name="eye" size={14} color={colors.primary} />
                      <Text style={styles.sampleTxt}>View Sample</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {cart[it.id] ? (
                  <View style={styles.qty}>
                    <TouchableOpacity testID={`sub-${it.id}`} onPress={() => sub(it.id)} style={styles.qtyBtn}><Ionicons name="remove" size={18} color="#fff" /></TouchableOpacity>
                    <Text style={styles.qtyN}>{cart[it.id]}</Text>
                    <TouchableOpacity testID={`add-${it.id}`} onPress={() => add(it.id)} style={styles.qtyBtn}><Ionicons name="add" size={18} color="#fff" /></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity testID={`addto-${it.id}`} style={styles.addBtn} onPress={() => add(it.id)}>
                    <Text style={styles.addBtnTxt}>ADD</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ))}

        {payments.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={styles.section}>My Receipts</Text>
            {payments.map((p) => (
              <TouchableOpacity
                key={p.id}
                testID={`receipt-${p.id}`}
                style={styles.histRow}
                onPress={() => router.push(`/receipt/${p.id}` as any)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.histAmt}>₹{p.amount}</Text>
                  <Text style={styles.histDate}>{new Date(p.created_at).toLocaleString()}</Text>
                  {p.child_name ? <Text style={styles.histDate}>For: {p.child_name}</Text> : null}
                </View>
                <View style={[styles.badge, badgeStyle(p.status)]}>
                  <Text style={styles.badgeTxt}>{p.status.toUpperCase()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {cartCount > 0 && (
        <TouchableOpacity testID="open-checkout" style={styles.cartBar} onPress={() => setShowCheckout(true)}>
          <View>
            <Text style={styles.cartCount}>{cartCount} item{cartCount > 1 ? 's' : ''}</Text>
            <Text style={styles.cartTotal}>₹{total.toFixed(0)}</Text>
          </View>
          <View style={styles.cartCta}>
            <Text style={styles.cartCtaTxt}>Checkout</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      <CheckoutModal
        visible={showCheckout}
        onClose={() => setShowCheckout(false)}
        cartLines={cartLines}
        total={total}
        hasCourse={hasCourse}
        children={children}
        onSuccess={() => { setCart({}); setShowCheckout(false); load(); }}
      />

      <Modal visible={!!previewImg} transparent animationType="fade" onRequestClose={() => setPreviewImg(null)}>
        <TouchableOpacity style={styles.previewBg} activeOpacity={1} onPress={() => setPreviewImg(null)}>
          <View style={styles.previewBox} onStartShouldSetResponder={() => true}>
            <View style={styles.previewHead}>
              <Text style={styles.previewTitle} numberOfLines={1}>{previewTitle}</Text>
              <TouchableOpacity testID="close-preview" onPress={() => setPreviewImg(null)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
            {previewImg ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${previewImg}` }}
                style={styles.previewImg}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function CheckoutModal({ visible, onClose, cartLines, total, hasCourse, children, onSuccess }: any) {
  const [upi, setUpi] = useState<Upi | null>(null);
  const [childId, setChildId] = useState<string>('');
  const [utr, setUtr] = useState('');
  const [shot, setShot] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useFocusEffect(useCallback(() => {
    if (!visible) return;
    api.get('/upi-settings').then((r) => setUpi(r.data)).catch(() => {});
    if (children?.length === 1) setChildId(children[0].id);
  }, [visible, children]));

  const pickShot = async () => {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6 });
    if (!res.canceled && res.assets?.[0]?.base64) setShot(res.assets[0].base64);
  };

  const copyUpi = async () => {
    if (upi?.upi_id) { await Clipboard.setStringAsync(upi.upi_id); Alert.alert('Copied', 'UPI ID copied'); }
  };

  const submit = async () => {
    setErr('');
    if (hasCourse && !childId) { setErr('Please select which child this course is for'); return; }
    if (!utr && !shot) { setErr('Please provide UTR or upload payment screenshot'); return; }
    setBusy(true);
    try {
      await api.post('/payments', {
        items: cartLines.map((l: any) => ({ item_id: l.id, qty: l.qty })),
        child_id: childId || undefined,
        utr: utr || undefined,
        screenshot_base64: shot || undefined,
      });
      Alert.alert('Submitted', 'Your payment is pending admin confirmation.');
      onSuccess();
    } catch (e: any) {
      setErr(formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={styles.h1}>Checkout</Text>
            <TouchableOpacity onPress={onClose} testID="close-checkout"><Ionicons name="close" size={28} color={colors.primary} /></TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Order Summary</Text>
            {cartLines.map((l: any) => (
              <View key={l.id} style={styles.summaryRow}>
                <Text style={styles.summaryName}>{l.name}  <Text style={styles.muted}>× {l.qty}</Text></Text>
                <Text style={styles.summaryAmt}>₹{(l.price * l.qty).toFixed(0)}</Text>
              </View>
            ))}
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8 }]}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalAmt}>₹{total.toFixed(0)}</Text>
            </View>
          </View>

          {hasCourse && (
            <View style={styles.card}>
              <Text style={styles.section}>For which child?</Text>
              {children?.length === 0 ? (
                <Text style={styles.muted}>Add a child first from Profile → Children.</Text>
              ) : (
                children?.map((c: Child) => (
                  <TouchableOpacity
                    key={c.id}
                    testID={`pick-child-${c.id}`}
                    style={[styles.childPick, childId === c.id && { borderColor: colors.secondary, backgroundColor: '#FFFBEB' }]}
                    onPress={() => setChildId(c.id)}
                  >
                    <Ionicons name={childId === c.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={childId === c.id ? colors.secondary : colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.childName}>{c.name}</Text>
                      <Text style={styles.muted}>Class {c.child_class || '-'} · {c.enrollment_status}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.section}>Pay via UPI</Text>
            {upi?.qr_image_base64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${upi.qr_image_base64}` }} style={styles.qr} testID="checkout-qr" />
            ) : (
              <View style={[styles.qr, { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="qr-code" size={64} color={colors.primary} />
                <Text style={styles.muted}>QR not yet set by admin</Text>
              </View>
            )}
            <TouchableOpacity style={styles.upiRow} onPress={copyUpi} testID="copy-upi">
              <Text style={styles.upiId}>{upi?.upi_id || '—'}</Text>
              <Ionicons name="copy" size={18} color={colors.primary} />
            </TouchableOpacity>
            {upi?.instructions ? <Text style={styles.muted}>{upi.instructions}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>I have paid</Text>
            <Text style={styles.label}>UTR / Transaction ID</Text>
            <TextInput testID="checkout-utr" style={styles.input} value={utr} onChangeText={setUtr} placeholder="123456789012" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity testID="checkout-pick" style={styles.pickBtn} onPress={pickShot}>
              <Ionicons name="image" size={20} color={colors.primary} />
              <Text style={styles.pickTxt}>{shot ? 'Screenshot attached ✓' : 'Upload screenshot'}</Text>
            </TouchableOpacity>
            {shot ? <Image source={{ uri: `data:image/jpeg;base64,${shot}` }} style={styles.preview} /> : null}
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <TouchableOpacity testID="submit-checkout" style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Submit for Approval</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function badgeStyle(s: string) {
  if (s === 'approved') return { backgroundColor: colors.success };
  if (s === 'rejected') return { backgroundColor: colors.error };
  return { backgroundColor: colors.warning };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  section: { fontSize: 16, fontWeight: '800', color: colors.primary },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 12, borderRadius: radii.card, marginBottom: 10, ...shadow },
  itemImg: { width: 64, height: 64, borderRadius: 10 },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.primary },
  itemDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 16, color: colors.primary, fontWeight: '800', marginTop: 6 },
  addBtn: { backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 100, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  qtyN: { color: colors.primary, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  cartBar: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: colors.primary, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow },
  cartCount: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cartTotal: { color: '#fff', fontSize: 22, fontWeight: '800' },
  cartCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.secondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  cartCtaTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: radii.card, marginBottom: 16, ...shadow },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryName: { color: colors.textPrimary, fontWeight: '500', flex: 1 },
  summaryAmt: { color: colors.primary, fontWeight: '700' },
  muted: { color: colors.textSecondary, fontSize: 13 },
  totalLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '800', letterSpacing: 1 },
  totalAmt: { fontSize: 22, fontWeight: '800', color: colors.primary },
  childPick: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginTop: 8 },
  childName: { fontWeight: '700', color: colors.primary },
  qr: { width: '100%', aspectRatio: 1, borderRadius: 12, marginTop: 6, backgroundColor: '#F3F4F6' },
  upiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', padding: 14, borderRadius: 10, marginTop: 12 },
  upiId: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, backgroundColor: '#F3F4F6', marginTop: 12 },
  pickTxt: { color: colors.primary, fontWeight: '600' },
  preview: { width: 100, height: 100, borderRadius: 8, marginTop: 10 },
  err: { color: colors.error, marginTop: 8 },
  btn: { backgroundColor: colors.secondary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 16 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#fff', borderRadius: 12, marginTop: 8, ...shadow },
  histAmt: { fontSize: 15, fontWeight: '800', color: colors.primary },
  histDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  sampleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, backgroundColor: '#EFF6FF', marginTop: 8 },
  sampleTxt: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  previewBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  previewBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  previewHead: { position: 'absolute', top: 40, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 },
  previewTitle: { color: '#fff', fontWeight: '800', fontSize: 16, flex: 1, marginRight: 12 },
  previewImg: { width: '95%', height: '85%' },
});
