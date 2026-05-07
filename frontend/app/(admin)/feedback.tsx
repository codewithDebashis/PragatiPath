import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Feedback = {
  id: string;
  type: 'rating' | 'suggestion';
  rating?: number;
  message?: string;
  user_name?: string;
  user_email?: string;
  created_at: string;
  admin_reply?: string;
  admin_reply_at?: string;
};

export default function AdminFeedback() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'rating' | 'suggestion'>('all');
  const [items, setItems] = useState<Feedback[]>([]);
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = filter === 'all' ? {} : { type: filter };
      const r = await api.get('/admin/feedback', { params });
      setItems(r.data?.items || []);
      setAvg(r.data?.avg_rating ?? null);
      setCount(r.data?.rating_count ?? 0);
    } catch {}
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]));

  const openReply = (it: Feedback) => {
    setReplyTarget(it);
    setReplyText(it.admin_reply || '');
  };

  const sendReply = async () => {
    if (!replyTarget) return;
    if (!replyText.trim()) { Alert.alert('Please write a reply'); return; }
    setSending(true);
    try {
      await api.post(`/admin/feedback/${replyTarget.id}/reply`, { admin_reply: replyText.trim() });
      setReplyTarget(null);
      setReplyText('');
      await load();
      Alert.alert('Reply sent', 'The user will receive a notification.');
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message || 'Could not reply');
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="feedback-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>User Feedback</Text>
          <Text style={styles.sub}>Ratings & suggestions from parents</Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>AVERAGE RATING</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.statVal}>{avg !== null ? avg.toFixed(1) : '—'}</Text>
          </View>
          <Text style={styles.statSub}>{count} {count === 1 ? 'rating' : 'ratings'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL FEEDBACK</Text>
          <Text style={styles.statVal}>{items.length}</Text>
          <Text style={styles.statSub}>{filter === 'all' ? 'All entries' : filter}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(['all', 'rating', 'suggestion'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            testID={`tab-${k}`}
            style={[styles.tab, filter === k && styles.tabActive]}
            onPress={() => setFilter(k)}
          >
            <Text style={[styles.tabTxt, filter === k && { color: '#fff' }]}>{k === 'all' ? 'All' : k === 'rating' ? 'Ratings' : 'Suggestions'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-feedback-list">
        {loading ? (
          <View style={styles.empty}><ActivityIndicator color="#fff" /></View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={42} color="#9CA3AF" />
            <Text style={styles.muted}>No {filter === 'all' ? 'feedback' : filter} yet</Text>
          </View>
        ) : items.map((it) => (
          <View key={it.id} style={styles.card} testID={`fb-row-${it.id}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {it.type === 'rating' ? (
                <View style={{ flexDirection: 'row' }}>
                  {[1,2,3,4,5].map(n => <Ionicons key={n} name={n <= (it.rating || 0) ? 'star' : 'star-outline'} size={16} color="#F59E0B" />)}
                </View>
              ) : (
                <View style={styles.tag}><Text style={styles.tagTxt}>SUGGESTION</Text></View>
              )}
              <Text style={styles.date}>{new Date(it.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.user}>{it.user_name || 'Parent'} <Text style={styles.muted}>· {it.user_email}</Text></Text>
            {it.message ? <Text style={styles.msg}>{it.message}</Text> : null}

            {it.admin_reply ? (
              <View style={styles.replyBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.replyHead}>Your reply</Text>
                  {it.admin_reply_at ? <Text style={styles.replyDate}>· {new Date(it.admin_reply_at).toLocaleString()}</Text> : null}
                </View>
                <Text style={styles.replyTxt}>{it.admin_reply}</Text>
              </View>
            ) : null}

            <TouchableOpacity testID={`reply-${it.id}`} style={styles.replyBtn} onPress={() => openReply(it)}>
              <Ionicons name={it.admin_reply ? 'create' : 'arrow-undo'} size={14} color="#fff" />
              <Text style={styles.replyBtnTxt}>{it.admin_reply ? 'Edit reply' : 'Reply'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!replyTarget} transparent animationType="slide" onRequestClose={() => setReplyTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.modalTitle}>Reply to {replyTarget?.user_name || 'parent'}</Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)} testID="reply-close"><Ionicons name="close" size={24} color={colors.primary} /></TouchableOpacity>
            </View>
            {replyTarget?.message ? (
              <View style={styles.quote}>
                <Text style={styles.quoteText}>{replyTarget.message}</Text>
              </View>
            ) : null}
            <TextInput
              testID="reply-input"
              style={styles.input}
              placeholder="Type your reply…"
              placeholderTextColor="#9CA3AF"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity testID="reply-submit" style={[styles.sendBtn, (!replyText.trim() || sending) && { opacity: 0.5 }]} onPress={sendReply} disabled={!replyText.trim() || sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnTxt}>Send Reply</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#0E2A4F', borderRadius: 12, padding: 14 },
  statLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statVal: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  statSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: '#1a2a44', backgroundColor: '#0E2A4F' },
  tabActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  tabTxt: { color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: 14, marginBottom: 10, ...shadow },
  user: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  msg: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  date: { color: colors.textSecondary, fontSize: 11 },
  muted: { color: colors.textSecondary, fontSize: 11, fontWeight: '500' },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  tag: { backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  tagTxt: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  replyBox: { marginTop: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.success, backgroundColor: '#F0FDF4', borderRadius: 6 },
  replyHead: { color: colors.success, fontWeight: '800', fontSize: 11, letterSpacing: 0.4 },
  replyDate: { color: colors.textSecondary, fontSize: 10, marginLeft: 4 },
  replyTxt: { color: colors.textPrimary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100 },
  replyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.primary },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 10 },
  quoteText: { color: colors.textSecondary, fontSize: 13, fontStyle: 'italic' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 12, fontSize: 14, color: colors.textPrimary, minHeight: 110, textAlignVertical: 'top' },
  sendBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: radii.button, alignItems: 'center' },
  sendBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
