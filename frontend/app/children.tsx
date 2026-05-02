import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { colors, radii, shadow } from '../src/theme';
import { ClassPicker } from '../src/ClassPicker';

type Child = { id: string; name: string; age?: number; child_class?: string; child_id_code?: string; enrollment_status?: string };

export default function Children() {
  const router = useRouter();
  const [items, setItems] = useState<Child[]>([]);
  const [editing, setEditing] = useState<Partial<Child> | null>(null);

  const load = async () => {
    try { const r = await api.get('/children/me'); setItems(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const remove = (c: Child) => {
    Alert.alert('Remove child?', `${c.name} will be removed (existing records preserved).`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await api.delete(`/children/${c.id}`); load(); } catch (e: any) { Alert.alert('Error', e.message); }
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="children-back"><Ionicons name="chevron-back" size={26} color={colors.primary} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>My Children</Text>
          <Text style={styles.sub}>{items.length} added</Text>
        </View>
        <TouchableOpacity testID="add-child-btn" style={styles.addBtn} onPress={() => setEditing({})}>
          <Ionicons name="add" color="#fff" size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} testID="children-list">
        {items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.muted}>No children yet. Tap + to add.</Text>
          </View>
        )}
        {items.map((c) => (
          <View key={c.id} style={styles.card} testID={`child-row-${c.id}`}>
            <View style={styles.row}>
              <View style={styles.avatar}><Ionicons name="happy" color="#fff" size={22} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>Class {c.child_class || '-'} · Age {c.age ?? '-'}</Text>
                <Text style={styles.code}>{c.child_id_code}</Text>
              </View>
              <View style={[styles.pill, c.enrollment_status === 'enrolled' ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.pillTxt, { color: c.enrollment_status === 'enrolled' ? '#065F46' : '#92400E' }]}>
                  {c.enrollment_status === 'enrolled' ? 'ENROLLED' : 'PENDING'}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity testID={`view-attendance-${c.id}`} onPress={() => router.push({ pathname: '/attendance', params: { child_id: c.id } } as any)}>
                <Text style={styles.actLink}>Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`edit-child-${c.id}`} onPress={() => setEditing(c)}>
                <Text style={styles.actLink}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`remove-child-${c.id}`} onPress={() => remove(c)}>
                <Text style={[styles.actLink, { color: colors.error }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <ChildEditor
        child={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </SafeAreaView>
  );
}

function ChildEditor({ child, onClose, onSaved }: any) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [cls, setCls] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!child) return;
    setName(child.name || ''); setAge(child.age ? String(child.age) : ''); setCls(child.child_class || '');
  }, [child]));

  if (!child) return null;
  const editingExisting = !!child.id;

  const save = async () => {
    if (!name.trim() || !cls) { Alert.alert('Name and class are required'); return; }
    setBusy(true);
    try {
      const payload = { name, age: age ? Number(age) : undefined, child_class: cls };
      if (editingExisting) await api.put(`/children/${child.id}`, payload);
      else await api.post('/children', payload);
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={styles.h1}>{editingExisting ? 'Edit Child' : 'Add Child'}</Text>
            <TouchableOpacity onPress={onClose} testID="close-child-editor"><Ionicons name="close" size={28} color={colors.primary} /></TouchableOpacity>
          </View>
          <Text style={styles.label}>Child's Name *</Text>
          <TextInput testID="child-name" style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>Age</Text>
          <TextInput testID="child-age" style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" placeholderTextColor="#9CA3AF" />
          <Text style={styles.label}>Class *</Text>
          <ClassPicker value={cls} onChange={setCls} testID="child-class" />
          <TouchableOpacity testID="save-child" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { fontSize: 24, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, fontSize: 13 },
  addBtn: { backgroundColor: colors.secondary, padding: 12, borderRadius: 100, ...shadow },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radii.card, marginBottom: 12, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.primary, fontWeight: '800' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  code: { color: colors.secondary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillTxt: { fontSize: 10, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  actLink: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  muted: { color: colors.textSecondary },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 24 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
