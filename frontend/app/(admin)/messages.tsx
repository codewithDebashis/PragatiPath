import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type User = { id: string; name?: string; email: string; child_name?: string; user_id_code?: string };

export default function AdminMessages() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [img, setImg] = useState('');
  const [recipient, setRecipient] = useState<'all' | 'user'>('all');
  const [target, setTarget] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    api.get('/admin/users').then((r) => setUsers(r.data)).catch(() => {});
  }, []));

  const pickImage = async () => {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.5 });
    if (!res.canceled && res.assets?.[0]?.base64) setImg(res.assets[0].base64);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) { Alert.alert('Title and body are required'); return; }
    if (recipient === 'user' && !target) { Alert.alert('Please pick a parent'); return; }
    setBusy(true);
    try {
      const r = await api.post('/admin/notifications', {
        title, body, image_base64: img || undefined,
        recipient, user_id: recipient === 'user' ? target?.id : undefined,
      });
      Alert.alert('Sent', `Message delivered to ${r.data.sent} parent(s).`);
      setTitle(''); setBody(''); setImg(''); setTarget(null); setRecipient('all');
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="msg-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Send Message</Text>
          <Text style={styles.sub}>To all parents or one parent</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} testID="admin-messages">
        <View style={styles.card}>
          <Text style={styles.label}>Recipient</Text>
          <View style={styles.segment}>
            <TouchableOpacity
              testID="recipient-all"
              style={[styles.segBtn, recipient === 'all' && styles.segActive]}
              onPress={() => setRecipient('all')}
            >
              <Ionicons name="people" size={16} color={recipient === 'all' ? '#fff' : colors.primary} />
              <Text style={[styles.segTxt, recipient === 'all' && { color: '#fff' }]}>All Parents</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="recipient-user"
              style={[styles.segBtn, recipient === 'user' && styles.segActive]}
              onPress={() => setRecipient('user')}
            >
              <Ionicons name="person" size={16} color={recipient === 'user' ? '#fff' : colors.primary} />
              <Text style={[styles.segTxt, recipient === 'user' && { color: '#fff' }]}>Specific Parent</Text>
            </TouchableOpacity>
          </View>

          {recipient === 'user' && (
            <TouchableOpacity testID="pick-recipient" style={styles.pickRow} onPress={() => setPickerOpen(true)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickLabel}>{target ? target.name || target.email : 'Choose a parent'}</Text>
                {target?.child_name ? <Text style={styles.pickHint}>Child: {target.child_name}</Text> : null}
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Title *</Text>
          <TextInput testID="msg-title" style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Holiday next Monday" placeholderTextColor="#9CA3AF" />

          <Text style={styles.label}>Body *</Text>
          <TextInput
            testID="msg-body"
            style={[styles.input, { minHeight: 140, textAlignVertical: 'top' }]}
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Write the message"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Image (optional)</Text>
          <TouchableOpacity testID="msg-pick-image" style={styles.pickBtn} onPress={pickImage}>
            <Ionicons name="image" size={20} color={colors.primary} />
            <Text style={styles.pickTxt}>{img ? 'Change image' : 'Attach image'}</Text>
          </TouchableOpacity>
          {img ? (
            <View style={{ marginTop: 12 }}>
              <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={styles.preview} />
              <TouchableOpacity style={styles.clearImg} onPress={() => setImg('')} testID="msg-clear-image">
                <Ionicons name="close-circle" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity testID="send-msg" style={[styles.sendBtn, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.sendTxt}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Pick Parent</Text>
            <FlatList
              data={users}
              keyExtractor={(u) => u.id}
              ListEmptyComponent={<Text style={styles.muted}>No parents yet</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`recipient-pick-${item.id}`}
                  style={styles.userRow}
                  onPress={() => { setTarget(item); setPickerOpen(false); }}
                >
                  <View style={styles.avatar}><Ionicons name="person" color="#fff" size={18} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uName}>{item.name}</Text>
                    <Text style={styles.muted}>{item.email}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: radii.card, ...shadow },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  segment: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  segActive: { backgroundColor: colors.primary },
  segTxt: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  pickRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginTop: 10 },
  pickLabel: { color: colors.textPrimary, fontWeight: '600' },
  pickHint: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, backgroundColor: '#F3F4F6' },
  pickTxt: { color: colors.primary, fontWeight: '600' },
  preview: { width: '100%', height: 180, borderRadius: 12 },
  clearImg: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 100 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.secondary, padding: 16, borderRadius: radii.button, marginTop: 24 },
  sendTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 40, maxHeight: '70%' },
  handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: 12, paddingHorizontal: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  uName: { fontWeight: '700', color: colors.primary },
  muted: { color: colors.textSecondary, fontSize: 12 },
});
