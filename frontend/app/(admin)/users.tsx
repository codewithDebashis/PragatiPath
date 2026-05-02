import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type U = { id: string; email: string; name?: string; phone?: string; child_name?: string; child_age?: number; child_class?: string; user_id_code?: string; enrollment_status?: string; created_at?: string };

export default function AdminUsers() {
  const [items, setItems] = useState<U[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const r = await api.get('/admin/users'); setItems(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const enrolled = items.filter((u) => u.enrollment_status === 'enrolled').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Users</Text>
        <Text style={styles.sub}>{items.length} parents · {enrolled} enrolled</Text>
      </View>
      <FlatList
        testID="admin-users-list"
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>No users yet</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card} testID={`user-${item.id}`}>
            <View style={styles.row}>
              <View style={styles.avatar}><Ionicons name="person" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.muted}>{item.email}</Text>
                {item.phone ? <Text style={styles.muted}>{item.phone}</Text> : null}
              </View>
              <View style={[styles.badge, item.enrollment_status === 'enrolled' ? { backgroundColor: colors.success } : { backgroundColor: colors.warning }]}>
                <Text style={styles.badgeTxt}>{(item.enrollment_status || 'pending').toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Detail label="Child" value={item.child_name || '-'} />
              <Detail label="Age" value={item.child_age ? String(item.child_age) : '-'} />
              <Detail label="Class" value={item.child_class || '-'} />
            </View>
            <Text style={styles.code}>USER ID: {item.user_id_code}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.dLabel}>{label}</Text>
      <Text style={styles.dValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 8 },
  h1: { fontSize: 26, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 2 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radii.card, marginBottom: 12, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  muted: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  detailRow: { flexDirection: 'row', gap: 12 },
  dLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  dValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  code: { marginTop: 10, fontSize: 11, color: colors.secondary, fontWeight: '800', letterSpacing: 1 },
  empty: { alignItems: 'center', padding: 40 },
});
