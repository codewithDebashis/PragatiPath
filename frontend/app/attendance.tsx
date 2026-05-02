import { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { colors, radii, shadow } from '../src/theme';

type Child = { id: string; name: string; child_class?: string };
type Att = { id?: string; date: string; status: 'present' | 'absent' | 'leave'; note?: string };

const STATUS_COLOR: Record<string, string> = {
  present: '#10B981', absent: '#EF4444', leave: '#F59E0B',
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ParentAttendance() {
  const params = useLocalSearchParams<{ child_id?: string }>();
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string>('');
  const [records, setRecords] = useState<Att[]>([]);
  const [month, setMonth] = useState<Date>(() => { const d = new Date(); d.setDate(1); return d; });

  useFocusEffect(useCallback(() => {
    api.get('/children/me').then((r) => {
      setChildren(r.data);
      if (!childId) {
        const initial = (params.child_id as string) || r.data[0]?.id || '';
        if (initial) setChildId(initial);
      }
    }).catch(() => {});
  }, []));

  const loadRecords = async () => {
    if (!childId) return;
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    try {
      const r = await api.get('/attendance/me', {
        params: { child_id: childId, date_from: ymd(start), date_to: ymd(end) },
      });
      setRecords(r.data);
    } catch {}
  };
  useFocusEffect(useCallback(() => { loadRecords(); }, [childId, month]));

  const map = useMemo(() => {
    const m: Record<string, Att> = {};
    for (const r of records) m[r.date] = r;
    return m;
  }, [records]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0 };
    for (const r of records) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [records]);

  const days = (() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const padBefore = first.getDay();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < padBefore; i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    return arr;
  })();

  const goPrev = () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const goNext = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="att-back"><Ionicons name="chevron-back" size={26} color={colors.primary} /></TouchableOpacity>
        <Text style={styles.h1}>Attendance</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} testID="parent-attendance">
        <Text style={styles.label}>Child</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {children.map((c) => (
            <TouchableOpacity
              key={c.id}
              testID={`pick-${c.id}`}
              style={[styles.chip, childId === c.id && styles.chipActive]}
              onPress={() => setChildId(c.id)}
            >
              <Text style={[styles.chipTxt, childId === c.id && { color: '#fff' }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
          {children.length === 0 && <Text style={styles.muted}>No children yet</Text>}
        </ScrollView>

        <View style={styles.summaryRow}>
          <Stat label="Present" value={counts.present} color={STATUS_COLOR.present} />
          <Stat label="Absent" value={counts.absent} color={STATUS_COLOR.absent} />
          <Stat label="Leave" value={counts.leave} color={STATUS_COLOR.leave} />
        </View>

        <View style={styles.calCard}>
          <View style={styles.monthRow}>
            <TouchableOpacity testID="month-prev" onPress={goPrev}><Ionicons name="chevron-back" size={22} color={colors.primary} /></TouchableOpacity>
            <Text style={styles.monthLabel}>{month.toLocaleString('en', { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity testID="month-next" onPress={goNext}><Ionicons name="chevron-forward" size={22} color={colors.primary} /></TouchableOpacity>
          </View>
          <View style={styles.weekHead}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={styles.weekDay}>{d}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {days.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const k = ymd(d);
              const att = map[k];
              return (
                <View key={i} style={styles.cell}>
                  <View style={[styles.dayBubble, att && { backgroundColor: STATUS_COLOR[att.status] }]}>
                    <Text style={[styles.dayTxt, att && { color: '#fff', fontWeight: '800' }]}>{d.getDate()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            {(['present', 'absent', 'leave'] as const).map((s) => (
              <View key={s} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[s] }]} />
                <Text style={styles.muted}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
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
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.primary },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  muted: { color: colors.textSecondary },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center', ...shadow },
  statDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  calCard: { backgroundColor: '#fff', borderRadius: radii.card, padding: 16, ...shadow },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: colors.primary },
  weekHead: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayTxt: { color: colors.textPrimary, fontSize: 13 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
