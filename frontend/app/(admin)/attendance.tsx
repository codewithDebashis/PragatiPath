import { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

type Child = { id: string; name: string; child_class?: string; child_id_code?: string; parent_id?: string };
type Att = { child_id: string; date: string; status: 'present' | 'absent' | 'leave' };

const STATUS_COLOR: Record<string, string> = { present: '#10B981', absent: '#EF4444', leave: '#F59E0B' };

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export default function AdminAttendance() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [date, setDate] = useState<string>(ymd(new Date()));
  const [today, setToday] = useState<Record<string, Att>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [c, a] = await Promise.all([
        api.get('/admin/children'),
        api.get('/admin/attendance', { params: { date_from: date, date_to: date } }),
      ]);
      setChildren(c.data);
      const m: Record<string, Att> = {};
      for (const r of a.data) m[r.child_id] = r;
      setToday(m);
    } catch {}
  };
  useFocusEffect(useCallback(() => { loadAll(); }, [date]));

  const filterClasses = useMemo(() => {
    const set = new Set(children.map((c) => c.child_class).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [children]);
  const [classFilter, setClassFilter] = useState<string>('');

  const visible = classFilter ? children.filter((c) => c.child_class === classFilter) : children;

  const mark = async (childId: string, status: Att['status']) => {
    setBusyId(childId);
    try {
      await api.post('/admin/attendance', { child_id: childId, date, status });
      setToday((m) => ({ ...m, [childId]: { child_id: childId, date, status } }));
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message);
    } finally { setBusyId(null); }
  };

  const shiftDate = (delta: number) => {
    const d = new Date(date); d.setDate(d.getDate() + delta);
    setDate(ymd(d));
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0, unmarked: 0 };
    for (const ch of visible) {
      const s = today[ch.id]?.status;
      if (s) c[s]++; else c.unmarked++;
    }
    return c;
  }, [today, visible]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="att-back"><Ionicons name="chevron-back" size={26} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Attendance</Text>
          <Text style={styles.sub}>Mark daily attendance per child</Text>
        </View>
      </View>

      <View style={styles.dateBar}>
        <TouchableOpacity testID="date-prev" onPress={() => shiftDate(-1)}><Ionicons name="chevron-back" size={22} color={colors.primary} /></TouchableOpacity>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.dateLabel}>{new Date(date).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          <TouchableOpacity testID="date-today" onPress={() => setDate(ymd(new Date()))}>
            <Text style={styles.todayLink}>Jump to today</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity testID="date-next" onPress={() => shiftDate(1)}><Ionicons name="chevron-forward" size={22} color={colors.primary} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} testID="admin-attendance">
        <View style={styles.statsRow}>
          <Stat label="Present" value={counts.present} color={STATUS_COLOR.present} />
          <Stat label="Absent" value={counts.absent} color={STATUS_COLOR.absent} />
          <Stat label="Leave" value={counts.leave} color={STATUS_COLOR.leave} />
          <Stat label="Unmarked" value={counts.unmarked} color="#9CA3AF" />
        </View>

        {filterClasses.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <TouchableOpacity testID="filter-class-all" style={[styles.classChip, !classFilter && styles.classChipActive]} onPress={() => setClassFilter('')}>
              <Text style={[styles.classChipTxt, !classFilter && { color: '#fff' }]}>All Classes</Text>
            </TouchableOpacity>
            {filterClasses.map((cls) => (
              <TouchableOpacity key={cls} testID={`filter-class-${cls}`} style={[styles.classChip, classFilter === cls && styles.classChipActive]} onPress={() => setClassFilter(cls)}>
                <Text style={[styles.classChipTxt, classFilter === cls && { color: '#fff' }]}>Class {cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {visible.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#9CA3AF" />
            <Text style={styles.muted}>No children to mark</Text>
          </View>
        )}

        {visible.map((c) => {
          const cur = today[c.id]?.status;
          return (
            <View key={c.id} style={styles.row} testID={`mark-row-${c.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>Class {c.child_class || '-'} · {c.child_id_code}</Text>
              </View>
              <View style={styles.btnGroup}>
                {(['present', 'absent', 'leave'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    testID={`mark-${c.id}-${s}`}
                    disabled={busyId === c.id}
                    style={[styles.markBtn, cur === s && { backgroundColor: STATUS_COLOR[s] }]}
                    onPress={() => mark(c.id, s)}
                  >
                    {busyId === c.id && cur !== s ? null : (
                      <Text style={[styles.markTxt, cur === s && { color: '#fff' }]}>{s[0].toUpperCase()}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingTop: 8 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  dateBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14 },
  dateLabel: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  todayLink: { color: colors.secondary, fontWeight: '700', fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#0E2A4F', padding: 10, borderRadius: 10, alignItems: 'center' },
  statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#0E2A4F', marginRight: 8 },
  classChipActive: { backgroundColor: colors.secondary },
  classChipTxt: { color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0E2A4F', padding: 14, borderRadius: 12, marginBottom: 8 },
  name: { color: '#fff', fontWeight: '700' },
  meta: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  btnGroup: { flexDirection: 'row', gap: 6 },
  markBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1a2a44', alignItems: 'center', justifyContent: 'center' },
  markTxt: { color: '#9CA3AF', fontWeight: '800' },
  empty: { alignItems: 'center', padding: 40, gap: 10 },
  muted: { color: '#9CA3AF' },
});
