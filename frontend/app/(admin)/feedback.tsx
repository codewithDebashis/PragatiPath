import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Feedback = { id: string; type: 'rating' | 'suggestion'; rating?: number; message?: string; user_name?: string; user_email?: string; created_at: string };

export default function AdminFeedback() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'rating' | 'suggestion'>('all');
  const [items, setItems] = useState<Feedback[]>([]);
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

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
          </View>
        ))}
      </ScrollView>
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
});
