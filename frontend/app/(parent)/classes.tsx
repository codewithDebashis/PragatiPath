import { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { colors, radii, shadow } from '../../src/theme';

type Video = { id: string; title: string; youtube_url: string; description?: string; child_class?: string | null };

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?#]+)/,
    /\/embed\/([^?#]+)/,
    /\/shorts\/([^?#]+)/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

export default function Classes() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const load = async () => {
    try { const r = await api.get('/videos'); setVideos(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const list = useMemo(() => {
    if (filter === 'mine' && user?.child_class) {
      return videos.filter((v) => !v.child_class || v.child_class === user.child_class);
    }
    return videos;
  }, [videos, filter, user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Classes</Text>
        <Text style={styles.sub}>Watch your video lessons on YouTube</Text>
        <View style={styles.tabs}>
          <TouchableOpacity testID="filter-all" style={[styles.tab, filter === 'all' && styles.tabActive]} onPress={() => setFilter('all')}>
            <Text style={[styles.tabTxt, filter === 'all' && { color: '#fff' }]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="filter-mine" style={[styles.tab, filter === 'mine' && styles.tabActive]} onPress={() => setFilter('mine')}>
            <Text style={[styles.tabTxt, filter === 'mine' && { color: '#fff' }]}>My Class</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="classes-list"
      >
        {list.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="videocam-off" size={48} color={colors.textSecondary} />
            <Text style={styles.muted}>No videos yet. Check back soon.</Text>
          </View>
        )}
        {list.map((v) => {
          const yid = getYoutubeId(v.youtube_url);
          const thumb = yid ? `https://i.ytimg.com/vi/${yid}/hqdefault.jpg` : null;
          return (
            <TouchableOpacity
              key={v.id}
              testID={`video-${v.id}`}
              style={styles.card}
              onPress={() => Linking.openURL(v.youtube_url)}
            >
              {thumb ? (
                <View>
                  <Image source={{ uri: thumb }} style={styles.thumb} />
                  <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={56} color="#fff" />
                  </View>
                </View>
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="logo-youtube" size={56} color={colors.error} />
                </View>
              )}
              <View style={styles.cardBody}>
                {v.child_class ? (
                  <View style={styles.classBadge}><Text style={styles.classBadgeTxt}>CLASS {v.child_class}</Text></View>
                ) : (
                  <View style={[styles.classBadge, { backgroundColor: '#3B82F6' }]}><Text style={styles.classBadgeTxt}>ALL CLASSES</Text></View>
                )}
                <Text style={styles.title}>{v.title}</Text>
                {v.description ? <Text style={styles.desc}>{v.description}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 8 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabTxt: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: radii.card, marginBottom: 14, overflow: 'hidden', ...shadow },
  thumb: { width: '100%', height: 200 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  cardBody: { padding: 14 },
  classBadge: { alignSelf: 'flex-start', backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  classBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 8 },
  desc: { color: colors.textSecondary, marginTop: 4, lineHeight: 18, fontSize: 13 },
  empty: { alignItems: 'center', padding: 60, gap: 10 },
  muted: { color: colors.textSecondary },
});
