import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { api } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Ad = { id: string; title: string; body?: string; image_base64?: string };

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [ads, setAds] = useState<Ad[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [a, n] = await Promise.all([api.get('/ads'), api.get('/notifications/me')]);
      setAds(a.data);
      setUnread((n.data as any[]).filter((x) => !x.read).length);
    } catch {}
  };

  useFocusEffect(useCallback(() => { load(); refresh(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); await refresh(); setRefreshing(false); };

  const enrolled = user?.enrollment_status === 'enrolled';

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

        {/* Status card */}
        <View style={[styles.statusCard, enrolled ? styles.enrolled : styles.pending]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Enrollment Status</Text>
            <Text style={styles.statusValue}>{enrolled ? 'ENROLLED ✨' : 'PENDING'}</Text>
            <Text style={styles.childRow}>Child: {user?.child_name || '-'}</Text>
            <Text style={styles.childRow}>User ID: {user?.user_id_code || '-'}</Text>
          </View>
          <Ionicons name={enrolled ? 'trophy' : 'hourglass'} size={48} color={enrolled ? colors.secondary : '#fff'} />
        </View>

        {!enrolled && (
          <TouchableOpacity testID="pay-cta" style={styles.payCta} onPress={() => router.push('/(parent)/payment')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payTitle}>Pay Fees & Enroll</Text>
              <Text style={styles.paySub}>Complete payment to activate your child's account</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={36} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Announcements */}
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

        {/* Quick links */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <Quick icon="qr-code" label="Pay Fees" onPress={() => router.push('/(parent)/payment')} testID="quick-pay" />
          <Quick icon="mail" label="Inbox" onPress={() => router.push('/(parent)/inbox')} testID="quick-inbox" />
          <Quick icon="person" label="Profile" onPress={() => router.push('/(parent)/profile')} testID="quick-profile" />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greet: { fontSize: 14, color: colors.textSecondary },
  brand: { fontSize: 22, fontWeight: '800', color: colors.primary, letterSpacing: 1.5 },
  bell: { backgroundColor: '#fff', padding: 12, borderRadius: 100, ...shadow },
  dot: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.error, borderRadius: 10, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  dotTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  statusCard: { borderRadius: radii.card, padding: 22, flexDirection: 'row', alignItems: 'center', ...shadow },
  pending: { backgroundColor: colors.primary },
  enrolled: { backgroundColor: '#0E2A4F' },
  statusLabel: { color: colors.secondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  statusValue: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  childRow: { color: '#D1D5DB', fontSize: 13, marginTop: 4 },
  payCta: { backgroundColor: colors.secondary, marginTop: 16, padding: 20, borderRadius: radii.card, flexDirection: 'row', alignItems: 'center', ...shadow },
  payTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  paySub: { color: '#fff', fontSize: 13, marginTop: 2, opacity: 0.95 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 26, marginBottom: 12 },
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
