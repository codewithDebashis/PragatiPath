import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, Modal, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Item = { id: string; name: string; description?: string; price: number; item_type: 'course' | 'material' | 'merch' | 'other'; image_base64?: string; active: boolean; coming_soon?: boolean };

const TYPES: Array<{ key: Item['item_type']; label: string }> = [
  { key: 'course', label: 'Course' },
  { key: 'material', label: 'Material' },
  { key: 'merch', label: 'Merch' },
  { key: 'other', label: 'Other' },
];

export default function AdminItems() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);

  const load = async () => {
    try { const r = await api.get('/admin/items'); setItems(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const remove = (id: string) => {
    Alert.alert('Delete item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/admin/items/${id}`); load(); } catch (e: any) { Alert.alert('Error', e.message); }
      } },
    ]);
  };

  const toggle = async (it: Item) => {
    try { await api.put(`/admin/items/${it.id}`, { ...it, active: !it.active }); load(); } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="items-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Items & Rate Chart</Text>
          <Text style={styles.sub}>Courses, materials, merchandise</Text>
        </View>
        <TouchableOpacity testID="new-item-btn" style={styles.addBtn} onPress={() => setEditing({ active: true, item_type: 'course', price: 0 })}>
          <Ionicons name="add" color="#fff" size={22} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-items-list">
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
            <Text style={styles.muted}>No items yet</Text>
          </View>
        )}
        {items.map((it) => (
          <View key={it.id} style={styles.card} testID={`item-row-${it.id}`}>
            {it.image_base64 ? <Image source={{ uri: `data:image/jpeg;base64,${it.image_base64}` }} style={styles.img} /> : null}
            <View style={styles.body}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <View style={styles.typeBadge}><Text style={styles.typeTxt}>{(it.item_type || '').toUpperCase()}</Text></View>
                {it.coming_soon ? <View style={styles.csBadge}><Text style={styles.csTxt}>COMING SOON</Text></View> : null}
              </View>
              <Text style={styles.name}>{it.name}</Text>
              {it.description ? <Text style={styles.desc}>{it.description}</Text> : null}
              <Text style={styles.price}>₹{it.price}</Text>
              <View style={styles.actions}>
                <View style={styles.activeRow}>
                  <Text style={styles.muted}>{it.active ? 'Active' : 'Hidden'}</Text>
                  <Switch testID={`toggle-item-${it.id}`} value={it.active} onValueChange={() => toggle(it)} trackColor={{ true: colors.success, false: colors.border }} />
                </View>
                <TouchableOpacity testID={`edit-item-${it.id}`} onPress={() => setEditing(it)}>
                  <Ionicons name="create" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity testID={`delete-item-${it.id}`} onPress={() => remove(it.id)}>
                  <Ionicons name="trash" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <ItemEditor item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </SafeAreaView>
  );
}

function ItemEditor({ item, onClose, onSaved }: any) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [commission, setCommission] = useState('');
  const [sampleUrl, setSampleUrl] = useState('');
  const [sampleImg, setSampleImg] = useState('');
  const [comingSoon, setComingSoon] = useState(false);
  const [type, setType] = useState<Item['item_type']>('course');
  const [img, setImg] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!item) return;
    setName(item.name || '');
    setDesc(item.description || '');
    setPrice(item.price ? String(item.price) : '');
    setCommission(item.commission ? String(item.commission) : '');
    setSampleUrl(item.sample_url || '');
    setSampleImg(item.sample_image_base64 || '');
    setComingSoon(item.coming_soon ?? false);
    setType(item.item_type || 'course');
    setImg(item.image_base64 || '');
    setActive(item.active ?? true);
  }, [item]));

  if (!item) return null;
  const editingExisting = !!item.id;

  const pick = async () => {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.5 });
    if (!res.canceled && res.assets?.[0]?.base64) setImg(res.assets[0].base64);
  };

  const save = async () => {
    if (!name.trim() || !price) { Alert.alert('Name and price are required'); return; }
    setBusy(true);
    try {
      const payload = { name, description: desc, price: Number(price), item_type: type, image_base64: img, active, commission: Number(commission || 0), sample_url: sampleUrl || undefined, sample_image_base64: sampleImg || undefined, coming_soon: comingSoon };
      if (editingExisting) await api.put(`/admin/items/${item.id}`, payload);
      else await api.post('/admin/items', payload);
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={[styles.h1, { color: colors.primary }]}>{editingExisting ? 'Edit Item' : 'New Item'}</Text>
            <TouchableOpacity onPress={onClose} testID="close-item-editor"><Ionicons name="close" size={28} color={colors.primary} /></TouchableOpacity>
          </View>

          <Text style={styles.label}>Name *</Text>
          <TextInput testID="item-name" style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#9CA3AF" />

          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                testID={`type-${t.key}`}
                style={[styles.typeChip, type === t.key && styles.typeChipActive]}
                onPress={() => setType(t.key)}
              >
                <Text style={[styles.typeChipTxt, type === t.key && { color: '#fff' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Price (INR) *</Text>
          <TextInput testID="item-price" style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor="#9CA3AF" />

          <Text style={styles.label}>Referral Commission (₹ per unit, optional)</Text>
          <TextInput testID="item-commission" style={styles.input} value={commission} onChangeText={setCommission} keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF" />

          <Text style={styles.label}>Sample / Preview URL (optional)</Text>
          <TextInput
            testID="item-sample-url"
            style={styles.input}
            value={sampleUrl}
            onChangeText={setSampleUrl}
            placeholder="https://drive.google.com/... or YouTube link"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Sample Image (optional)</Text>
          <TouchableOpacity
            testID="item-sample-pick"
            style={styles.pickBtn}
            onPress={async () => {
              const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!r.granted) return;
              const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.5 });
              if (!res.canceled && res.assets?.[0]?.base64) setSampleImg(res.assets[0].base64);
            }}
          >
            <Ionicons name="document-text" size={20} color={colors.primary} />
            <Text style={styles.pickTxt}>{sampleImg ? 'Change sample image' : 'Pick sample image'}</Text>
          </TouchableOpacity>
          {sampleImg ? <Image source={{ uri: `data:image/jpeg;base64,${sampleImg}` }} style={styles.preview} /> : null}

          <Text style={styles.label}>Description</Text>
          <TextInput testID="item-desc" style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline placeholderTextColor="#9CA3AF" />

          <Text style={styles.label}>Image</Text>
          <TouchableOpacity testID="item-image" style={styles.pickBtn} onPress={pick}>
            <Ionicons name="image" size={20} color={colors.primary} />
            <Text style={styles.pickTxt}>{img ? 'Change image' : 'Pick image'}</Text>
          </TouchableOpacity>
          {img ? <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={styles.preview} /> : null}

          <View style={[styles.activeRow, { marginTop: 16 }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Visible to parents</Text>
            <Switch testID="item-active" value={active} onValueChange={setActive} trackColor={{ true: colors.success, false: colors.border }} />
          </View>

          <View style={[styles.activeRow, { marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Coming soon</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>Show to parents but disable purchase</Text>
            </View>
            <Switch testID="item-coming-soon" value={comingSoon} onValueChange={setComingSoon} trackColor={{ true: colors.warning || '#F59E0B', false: colors.border }} />
          </View>

          <TouchableOpacity testID="save-item" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: colors.secondary, padding: 12, borderRadius: 100 },
  card: { backgroundColor: '#0E2A4F', borderRadius: radii.card, marginBottom: 12, overflow: 'hidden' },
  img: { width: '100%', height: 140 },
  body: { padding: 14 },
  typeBadge: { alignSelf: 'flex-start', backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeTxt: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 6 },
  desc: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  price: { color: colors.secondary, fontSize: 18, fontWeight: '800', marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a2a44', justifyContent: 'flex-end' },
  activeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-start' },
  muted: { color: '#9CA3AF', fontSize: 12 },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary, backgroundColor: '#fff' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipTxt: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  pickTxt: { color: colors.primary, fontWeight: '600' },
  preview: { width: '100%', height: 160, borderRadius: 12, marginTop: 12 },
  saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 24 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  csBadge: { alignSelf: 'flex-start', backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  csTxt: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
});
