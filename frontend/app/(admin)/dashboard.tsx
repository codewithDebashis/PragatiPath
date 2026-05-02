import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { colors, radii, shadow } from '../../src/theme';

type Stats = { pending_payments: number; approved_payments: number; total_users: number; total_children?: number; enrolled_children?: number; active_ads: number; active_items?: number };

export default function AdminDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const r = await api.get('/admin/stats'); setStats(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onLogout = async () => { await logout(); router.replace('/login'); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        testID="admin-dashboard"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>ADMIN CONSOLE</Text>
            <Text style={styles.brand}>Pragati Path</Text>
          </View>
          <TouchableOpacity testID="admin-logout" onPress={onLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Pending Payments" value={stats?.pending_payments ?? '-'} icon="time" color={colors.warning} testID="stat-pending" />
          <Stat label="Total Parents" value={stats?.total_users ?? '-'} icon="people" color="#3B82F6" testID="stat-users" />
          <Stat label="Children" value={stats?.total_children ?? '-'} icon="happy" color={colors.secondary} testID="stat-children" />
          <Stat label="Enrolled" value={stats?.enrolled_children ?? '-'} icon="trophy" color={colors.success} testID="stat-enrolled" />
        </View>

        <Text style={styles.sectionTitle}>Manage</Text>
        <Tile title="Payment Requests" sub="Approve or reject pending UPI payments" icon="cash" onPress={() => router.push('/(admin)/payments')} testID="tile-payments" />
        <Tile title="Send Message" sub="Notify all parents or a specific parent" icon="send" onPress={() => router.push('/(admin)/messages')} testID="tile-messages" />
        <Tile title="Items & Rate Chart" sub="Courses, study materials, merchandise" icon="cube" onPress={() => router.push('/(admin)/items')} testID="tile-items" />
        <Tile title="Attendance" sub="Mark daily attendance per child" icon="calendar" onPress={() => router.push('/(admin)/attendance')} testID="tile-attendance" />
        <Tile title="Advertisements" sub="Add, edit, or remove announcements" icon="megaphone" onPress={() => router.push('/(admin)/ads')} testID="tile-ads" />
        <Tile title="UPI / QR Settings" sub="Set UPI ID, QR image, and instructions" icon="qr-code" onPress={() => router.push('/(admin)/upi')} testID="tile-upi" />
        <Tile title="Users Directory" sub="View all registered parents & children" icon="people" onPress={() => router.push('/(admin)/users')} testID="tile-users" />
        <Tile title="Auto-message Template" sub="Edit the welcome message template" icon="text" onPress={() => router.push('/(admin)/template')} testID="tile-template" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, color, testID }: any) {
  return (
    <View style={styles.statCard} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tile({ title, sub, icon, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.tile} onPress={onPress}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={22} color={colors.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  kicker: { color: colors.secondary, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  brand: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 2 },
  logoutBtn: { padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  statCard: { width: '47%', backgroundColor: '#0E2A4F', padding: 16, borderRadius: radii.card },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { color: '#fff', fontSize: 26, fontWeight: '800' },
  statLabel: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: colors.secondary, fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 26, marginBottom: 12 },
  tile: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0E2A4F', padding: 18, borderRadius: radii.card, marginBottom: 10, gap: 14 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,166,35,0.12)', alignItems: 'center', justifyContent: 'center' },
  tileTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  tileSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
});
