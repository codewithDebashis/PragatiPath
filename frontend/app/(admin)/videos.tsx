import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { ClassPicker } from '../../src/ClassPicker';
import { colors, radii, shadow } from '../../src/theme';

type Video = { id: string; title: string; youtube_url: string; description?: string; child_class?: string | null; active: boolean };

export default function AdminVideos() {
  const router = useRouter();
  const [items, setItems] = useState<Video[]>([]);
  const [editing, setEditing] = useState<Partial<Video> | null>(null);

  const load = async () => { try { const r = await api.get('/admin/videos'); setItems(r.data); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  const remove = (id: string) => Alert.alert('Delete?', '', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/admin/videos/${id}`); load(); } catch (e: any) { Alert.alert('Error', e.message); } } },
  ]);
  const toggle = async (v: Video) => { try { await api.put(`/admin/videos/${v.id}`, { ...v, active: !v.active }); load(); } catch (e: any) { Alert.alert('Error', e.message); } };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="videos-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>YouTube Classes</Text>
          <Text style={styles.sub}>Add or edit class videos</Text>
        </View>
        <TouchableOpacity testID="new-video-btn" style={styles.addBtn} onPress={() => setEditing({ active: true })}>
          <Ionicons name="add" color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-videos-list">
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="logo-youtube" size={48} color="#9CA3AF" />
            <Text style={styles.muted}>No videos yet. Tap + to add.</Text>
          </View>
        )}
        {items.map((v) => (
          <View key={v.id} style={styles.card} testID={`video-row-${v.id}`}>
            <View style={styles.row}>
              <View style={styles.iconBox}><Ionicons name="logo-youtube" color={colors.error} size={28} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{v.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>{v.youtube_url}</Text>
                <Text style={styles.cls}>{v.child_class ? `Class ${v.child_class}` : 'All classes'}</Text>
              </View>
            </View>
            {v.description ? <Text style={styles.desc}>{v.description}</Text> : null}
            <View style={styles.actions}>
              <View style={styles.activeRow}>
                <Text style={styles.muted}>{v.active ? 'Active' : 'Hidden'}</Text>
                <Switch value={v.active} onValueChange={() => toggle(v)} trackColor={{ true: colors.success, false: '#1a2a44' }} testID={`toggle-vid-${v.id}`} />
              </View>
              <TouchableOpacity testID={`edit-vid-${v.id}`} onPress={() => setEditing(v)}><Ionicons name="create" size={20} color="#fff" /></TouchableOpacity>
              <TouchableOpacity testID={`delete-vid-${v.id}`} onPress={() => remove(v.id)}><Ionicons name="trash" size={20} color={colors.error} /></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <VideoEditor video={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
    </SafeAreaView>
  );
}

function VideoEditor({ video, onClose, onSaved }: any) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [cls, setCls] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!video) return;
    setTitle(video.title || ''); setUrl(video.youtube_url || ''); setDesc(video.description || '');
    setCls(video.child_class || ''); setActive(video.active ?? true);
  }, [video]));
  if (!video) return null;
  const editingExisting = !!video.id;

  const save = async () => {
    if (!title.trim() || !url.trim()) { Alert.alert('Title and URL are required'); return; }
    setBusy(true);
    try {
      const payload = { title, youtube_url: url, description: desc, child_class: cls || null, active };
      if (editingExisting) await api.put(`/admin/videos/${video.id}`, payload);
      else await api.post('/admin/videos', payload);
      onSaved();
    } catch (e: any) { Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={[styles.h1, { color: colors.primary }]}>{editingExisting ? 'Edit Video' : 'New Video'}</Text>
            <TouchableOpacity onPress={onClose} testID="close-vid-editor"><Ionicons name="close" size={28} color={colors.primary} /></TouchableOpacity>
          </View>
          <Text style={styles.label}>Title *</Text>
          <TextInput testID="vid-title" style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Maths Class 5 — Fractions" placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>YouTube URL *</Text>
          <TextInput testID="vid-url" style={styles.input} value={url} onChangeText={setUrl} placeholder="https://www.youtube.com/watch?v=..." placeholderTextColor="#9CA3AF" autoCapitalize="none" />
          <Text style={styles.label}>Description</Text>
          <TextInput testID="vid-desc" style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} multiline placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>Class (leave empty = all classes)</Text>
          <ClassPicker value={cls} onChange={setCls} testID="vid-class" />
          {cls ? <TouchableOpacity onPress={() => setCls('')}><Text style={{ color: colors.error, marginTop: 6 }}>Clear class</Text></TouchableOpacity> : null}
          <View style={[styles.activeRow, { marginTop: 16 }]}>
            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Visible to parents</Text>
            <Switch testID="vid-active" value={active} onValueChange={setActive} trackColor={{ true: colors.success, false: colors.border }} />
          </View>
          <TouchableOpacity testID="save-vid" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
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
  card: { backgroundColor: '#0E2A4F', padding: 14, borderRadius: 12, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12 },
  iconBox: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#1a2a44', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontWeight: '800', fontSize: 14 },
  meta: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  cls: { color: colors.secondary, fontSize: 11, fontWeight: '700', marginTop: 4 },
  desc: { color: '#9CA3AF', fontSize: 12, marginTop: 8, lineHeight: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a2a44', justifyContent: 'flex-end' },
  activeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-start' },
  muted: { color: '#9CA3AF', fontSize: 12 },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 24 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
