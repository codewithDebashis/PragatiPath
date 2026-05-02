import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Ad = { id: string; title: string; body?: string; image_base64?: string };
type Child = { id: string; name: string; child_class?: string; enrollment_status?: string; child_id_code?: string };

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [ads, setAds] = useState<Ad[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [a, c, n] = await Promise.all([
        api.get('/ads'),
        api.get('/children/me'),
        api.get('/notifications/me'),
      ]);
      setAds(a.data); setChildren(c.data);
      setUnread((n.data as any[]).filter((x) => !x.read).length);
    } catch {}
  };

  useFocusEffect(useCallback(() => { load(); refresh(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); await refresh(); setRefreshing(false); };

  const enrolledCount = children.filter((c) => c.enrollment_status === 'enrolled').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="parent-dashboard"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>Hi, {user?.name?.split(' ')[0] || 'Parent'} 👋</Text>
            <Text style={styles.brand}>PRAGATI PATH</Text>
          </View>
          <TouchableOpacity testID="bell-button" style={styles.bell} onPress={() => router.push('/(parent)/inbox')}>
            <Ionicons name="notifications" size={22} color={colors.primary} />
            {unread > 0 && <View style={styles.dot}><Text style={styles.dotTxt}>{unread}</Text></View>}
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Children</Text>
            <Text style={styles.summaryValue}>{children.length}</Text>
            <Text style={styles.summaryHint}>{enrolledCount} enrolled · {children.length - enrolledCount} pending</Text>
          </View>
          <Ionicons name="trophy" size={48} color={colors.secondary} />
        </View>

        <View style={[styles.sectionRow, { marginTop: 22 }]}>
          <Text style={styles.sectionTitle}>My Children</Text>
          <TouchableOpacity testID="manage-children" onPress={() => router.push('/children')}>
            <Text style={styles.linkTxt}>Manage</Text>
          </TouchableOpacity>
        </View>
        {children.length === 0 ? (
          <TouchableOpacity testID="add-first-child" style={styles.emptyCard} onPress={() => router.push('/children')}>
            <Ionicons name="person-add" color={colors.primary} size={24} />
            <Text style={styles.emptyTxt}>Add your first child</Text>
          </TouchableOpacity>
        ) : (
          children.map((c) => (
            <View key={c.id} style={styles.childCard} testID={`child-${c.id}`}>
              <View style={styles.childIcon}><Ionicons name="happy" color="#fff" size={22} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{c.name}</Text>
                <Text style={styles.childMeta}>Class {c.child_class || '-'} · {c.child_id_code}</Text>
              </View>
              <View style={[styles.statusPill, c.enrollment_status === 'enrolled' ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.statusTxt, { color: c.enrollment_status === 'enrolled' ? '#065F46' : '#92400E' }]}>
                  {c.enrollment_status === 'enrolled' ? 'ENROLLED' : 'PENDING'}
                </Text>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity testID="pay-cta" style={styles.payCta} onPress={() => router.push('/(parent)/payment')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payTitle}>Browse Courses & Pay</Text>
            <Text style={styles.paySub}>Courses, study materials, and more</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={36} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Announcements</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
          {ads.length === 0 && (
            <View style={styles.adEmpty}><Text style={styles.muted}>No announcements yet.</Text></View>
          )}
          {ads.map((a) => (
            <View key={a.id} style={styles.adCard} testID={`ad-${a.id}`}>
              {a.image_base64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${a.image_base64}` }} style={styles.adImg} />
              ) : (
                <View style={[styles.adImg, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="megaphone" size={36} color={colors.secondary} />
                </View>
              )}
              <Text style={styles.adTitle}>{a.title}</Text>
              {a.body ? <Text style={styles.adBody} numberOfLines={3}>{a.body}</Text> : null}
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <Quick icon="cart" label="Shop" onPress={() => router.push('/(parent)/payment')} testID="quick-shop" />
          <Quick icon="calendar" label="Attendance" onPress={() => router.push('/attendance')} testID="quick-attendance" />
          <Quick icon="mail" label="Inbox" onPress={() => router.push('/(parent)/inbox')} testID="quick-inbox" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Quick({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.quick} onPress={onPress}>
      <Ionicons name={icon} size={26} color={colors.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  greet: { fontSize: 14, color: colors.textSecondary },
  brand: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: 1.5 },
  bell: { backgroundColor: '#fff', padding: 12, borderRadius: 100, ...shadow },
  dot: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.error, borderRadius: 10, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  dotTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  summaryCard: { backgroundColor: colors.primary, padding: 22, borderRadius: radii.card, flexDirection: 'row', alignItems: 'center', ...shadow },
  summaryLabel: { color: colors.secondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
  summaryValue: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  summaryHint: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 22, marginBottom: 12 },
  linkTxt: { color: colors.secondary, fontWeight: '700' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12 },
  emptyTxt: { color: colors.primary, fontWeight: '700' },
  childCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, ...shadow },
  childIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  childName: { color: colors.primary, fontWeight: '700' },
  childMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusTxt: { fontSize: 10, fontWeight: '800' },
  payCta: { backgroundColor: colors.secondary, marginTop: 18, padding: 20, borderRadius: radii.card, flexDirection: 'row', alignItems: 'center', ...shadow },
  payTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  paySub: { color: '#fff', fontSize: 13, marginTop: 2, opacity: 0.95 },
  adCard: { width: 240, marginRight: 12, backgroundColor: '#fff', borderRadius: radii.card, overflow: 'hidden', ...shadow },
  adImg: { width: '100%', height: 110 },
  adTitle: { fontSize: 15, fontWeight: '700', color: colors.primary, paddingHorizontal: 14, paddingTop: 10 },
  adBody: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: 14, paddingVertical: 8 },
  adEmpty: { width: 240, height: 130, borderRadius: radii.card, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textSecondary },
  quickRow: { flexDirection: 'row', gap: 12 },
  quick: { flex: 1, backgroundColor: '#fff', padding: 18, borderRadius: radii.card, alignItems: 'center', ...shadow },
  quickLabel: { marginTop: 8, color: colors.primary, fontWeight: '700', fontSize: 13 },
});
