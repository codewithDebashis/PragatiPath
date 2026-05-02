import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Notif = { id: string; title: string; body: string; type: string; read: boolean; created_at: string };

export default function Inbox() {
  const [items, setItems] = useState<Notif[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const r = await api.get('/notifications/me'); setItems(r.data); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markRead = async (id: string) => {
    try { await api.post(`/notifications/${id}/read`); load(); } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Inbox</Text>
        <Text style={styles.sub}>Messages from Pragati Path</Text>
      </View>
      <FlatList
        testID="inbox-list"
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="mail-open" size={48} color={colors.textSecondary} />
            <Text style={styles.muted}>No messages yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`notif-${item.id}`}
            style={[styles.card, !item.read && styles.unread]}
            onPress={() => markRead(item.id)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconWrap, item.type === 'enrollment' ? styles.iconGold : styles.iconBlue]}>
                <Ionicons
                  name={item.type === 'enrollment' ? 'trophy' : item.type === 'payment' ? 'card' : 'information-circle'}
                  size={20} color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              {!item.read && <View style={styles.dot} />}
            </View>
            <Text style={styles.body}>{item.body}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 8 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: radii.card, marginBottom: 12, ...shadow },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.secondary },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconBlue: { backgroundColor: colors.primary },
  iconGold: { backgroundColor: colors.secondary },
  title: { fontSize: 15, fontWeight: '800', color: colors.primary },
  date: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  body: { color: colors.textPrimary, marginTop: 10, lineHeight: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  muted: { color: colors.textSecondary },
});
