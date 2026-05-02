import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, Modal, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Ad = { id: string; title: string; body?: string; image_base64?: string; active: boolean; created_at?: string };

export default function AdminAds() {
  const [items, setItems] = useState<Ad[]>([]);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const r = await api.get('/admin/ads'); setItems(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const remove = async (id: string) => {
    Alert.alert('Delete ad?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/admin/ads/${id}`); load(); } catch (e: any) { Alert.alert('Error', e.message); }
      } },
    ]);
  };

  const toggle = async (a: Ad) => {
    try {
      await api.put(`/admin/ads/${a.id}`, { ...a, active: !a.active });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Advertisements</Text>
          <Text style={styles.sub}>Manage announcements shown to parents</Text>
        </View>
        <TouchableOpacity testID="new-ad-btn" style={styles.addBtn} onPress={() => setEditing({ id: '', title: '', body: '', image_base64: '', active: true })}>
          <Ionicons name="add" color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-ads-list">
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.muted}>No ads yet. Tap + to add one.</Text>
          </View>
        )}
        {items.map((a) => (
          <View key={a.id} style={styles.card} testID={`ad-row-${a.id}`}>
            {a.image_base64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${a.image_base64}` }} style={styles.adImg} />
            ) : null}
            <View style={styles.cardBody}>
              <Text style={styles.adTitle}>{a.title}</Text>
              {a.body ? <Text style={styles.adBody}>{a.body}</Text> : null}
              <View style={styles.actions}>
                <View style={styles.activeRow}>
                  <Text style={styles.muted}>{a.active ? 'Active' : 'Hidden'}</Text>
                  <Switch testID={`toggle-${a.id}`} value={a.active} onValueChange={() => toggle(a)} trackColor={{ true: colors.success, false: colors.border }} />
                </View>
                <TouchableOpacity testID={`edit-${a.id}`} onPress={() => setEditing(a)}>
                  <Ionicons name="create" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity testID={`delete-${a.id}`} onPress={() => remove(a.id)}>
                  <Ionicons name="trash" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <AdEditor
        ad={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </SafeAreaView>
  );
}

function AdEditor({ ad, onClose, onSaved }: { ad: Ad | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [img, setImg] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (ad) {
      setTitle(ad.title || ''); setBody(ad.body || ''); setImg(ad.image_base64 || ''); setActive(ad.active);
    }
  }, [ad]));

  if (!ad) return null;

  const pick = async () => {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.5 });
    if (!res.canceled && res.assets?.[0]?.base64) setImg(res.assets[0].base64);
  };

  const save = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    setBusy(true);
    try {
      const payload = { title, body, image_base64: img, active };
      if (ad.id) await api.put(`/admin/ads/${ad.id}`, payload);
      else await api.post('/admin/ads', payload);
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
            <Text style={styles.h1}>{ad.id ? 'Edit Ad' : 'New Ad'}</Text>
            <TouchableOpacity onPress={onClose} testID="close-editor"><Ionicons name="close" size={28} color={colors.primary} /></TouchableOpacity>
          </View>
          <Text style={styles.label}>Title *</Text>
          <TextInput testID="ad-title" style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. New Math Batch" placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>Body</Text>
          <TextInput testID="ad-body" style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} value={body} onChangeText={setBody} multiline placeholder="Description" placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>Image</Text>
          <TouchableOpacity testID="ad-image" style={styles.pickBtn} onPress={pick}>
            <Ionicons name="image" size={20} color={colors.primary} />
            <Text style={styles.pickTxt}>{img ? 'Change image' : 'Pick image (optional)'}</Text>
          </TouchableOpacity>
          {img ? <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={styles.preview} /> : null}
          <View style={[styles.activeRow, { marginTop: 16 }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Visible to parents</Text>
            <Switch testID="ad-active" value={active} onValueChange={setActive} trackColor={{ true: colors.success, false: colors.border }} />
          </View>
          <TouchableOpacity testID="save-ad" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' },
  h1: { fontSize: 26, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 2 },
  addBtn: { backgroundColor: colors.secondary, padding: 12, borderRadius: 100, ...shadow },
  card: { backgroundColor: '#fff', borderRadius: radii.card, marginBottom: 12, overflow: 'hidden', ...shadow },
  cardBody: { padding: 16 },
  adImg: { width: '100%', height: 140 },
  adTitle: { fontSize: 16, fontWeight: '800', color: colors.primary },
  adBody: { color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, justifyContent: 'flex-end' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start' },
  muted: { color: colors.textSecondary, fontSize: 12 },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary, backgroundColor: '#fff' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  pickTxt: { color: colors.primary, fontWeight: '600' },
  preview: { width: '100%', height: 160, borderRadius: 12, marginTop: 12 },
  saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 24 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
