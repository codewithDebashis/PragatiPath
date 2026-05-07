import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../src/api';
import { colors, radii, shadow } from '../src/theme';

type Feedback = { id: string; type: 'rating' | 'suggestion'; rating?: number; message?: string; created_at: string };

export default function SuggestionsScreen() {
  const router = useRouter();
  const [list, setList] = useState<Feedback[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const r = await api.get('/feedback/me'); setList(r.data || []); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const submit = async () => {
    if (!msg.trim()) { Alert.alert('Please write your suggestion'); return; }
    setBusy(true);
    try {
      await api.post('/feedback', { type: 'suggestion', message: msg.trim() });
      setMsg('');
      await load();
      Alert.alert('Thank you!', 'Your suggestion has been sent to the admin team.');
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message || 'Could not submit');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="sugg-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Suggestions & Feedback</Text>
          <Text style={styles.sub}>Tell us how we can serve you better</Text>
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={styles.card}>
            <Text style={styles.label}>Your Suggestion</Text>
            <TextInput
              testID="suggestion-input"
              style={styles.input}
              placeholder="Share your idea, request, or any concern..."
              placeholderTextColor="#9CA3AF"
              value={msg}
              onChangeText={setMsg}
              multiline
              maxLength={1000}
            />
            <Text style={styles.charCount}>{msg.length}/1000</Text>
            <TouchableOpacity testID="suggestion-submit" style={[styles.btn, (busy || !msg.trim()) && { opacity: 0.5 }]} onPress={submit} disabled={busy || !msg.trim()}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Send Suggestion</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.section}>Your Past Feedback</Text>
          {list.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={42} color="#9CA3AF" />
              <Text style={styles.muted}>No suggestions yet</Text>
            </View>
          ) : list.map((it) => (
            <View key={it.id} style={styles.histCard} testID={`fb-${it.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {it.type === 'rating' ? (
                  <View style={{ flexDirection: 'row' }}>
                    {[1,2,3,4,5].map(n => <Ionicons key={n} name={n <= (it.rating || 0) ? 'star' : 'star-outline'} size={14} color="#F59E0B" />)}
                  </View>
                ) : (
                  <View style={styles.tag}><Text style={styles.tagTxt}>SUGGESTION</Text></View>
                )}
                <Text style={styles.dateTxt}>{new Date(it.created_at).toLocaleString()}</Text>
              </View>
              {it.message ? <Text style={styles.histTxt}>{it.message}</Text> : null}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radii.card, ...shadow },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 15, color: colors.textPrimary, minHeight: 110, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  btn: { backgroundColor: colors.secondary, padding: 14, borderRadius: radii.button, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  section: { marginTop: 22, marginBottom: 10, color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 30, gap: 8, backgroundColor: '#fff', borderRadius: radii.card },
  muted: { color: colors.textSecondary, fontSize: 13 },
  histCard: { backgroundColor: '#fff', borderRadius: radii.card, padding: 14, marginBottom: 8 },
  histTxt: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  dateTxt: { color: colors.textSecondary, fontSize: 11, marginLeft: 4 },
  tag: { backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagTxt: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
});
