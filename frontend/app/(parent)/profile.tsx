import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { colors, radii, shadow } from '../../src/theme';

function Link({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} style={styles.linkRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} testID="profile-screen">
        <View style={styles.heroCard}>
          <View style={styles.avatar}><Ionicons name="person" size={42} color="#fff" /></View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.idBadge}>
            <Text style={styles.idTxt}>USER ID: {user?.user_id_code}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Child Information</Text>
          <Row label="Name" value={user?.child_name || '-'} />
          <Row label="Age" value={user?.child_age ? String(user.child_age) : '-'} />
          <Row label="Class" value={user?.child_class || '-'} />
          <Row
            label="Status"
            value={user?.enrollment_status === 'enrolled' ? 'Enrolled ✨' : 'Pending Approval'}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Manage</Text>
          <Link icon="people" label="My Children" onPress={() => router.push('/children')} testID="link-children" />
          <Link icon="calendar" label="Attendance" onPress={() => router.push('/attendance')} testID="link-attendance" />
          <Link icon="receipt" label="Receipts" onPress={() => router.push('/(parent)/payment')} testID="link-receipts" />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Account</Text>
          <Row label="Phone" value={user?.phone || '-'} />
          <Row label="Joined" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'} />
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out" size={20} color={colors.error} />
          <Text style={styles.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  heroCard: { backgroundColor: colors.primary, padding: 24, borderRadius: radii.card, alignItems: 'center', ...shadow },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  email: { color: '#D1D5DB', fontSize: 13, marginTop: 4 },
  idBadge: { backgroundColor: colors.secondary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, marginTop: 12 },
  idTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: radii.card, marginTop: 16, ...shadow },
  section: { fontSize: 16, fontWeight: '800', color: colors.primary, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, padding: 16, borderRadius: radii.button, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.error },
  logoutTxt: { color: colors.error, fontWeight: '700', fontSize: 15 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkLabel: { flex: 1, color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
});
