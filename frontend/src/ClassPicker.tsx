import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii } from './theme';

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export function ClassPicker({ value, onChange, testID }: { value: string; onChange: (v: string) => void; testID?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity testID={testID} style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.text, !value && { color: '#9CA3AF' }]}>
          {value ? `Class ${value}` : 'Select class'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.bg} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.title}>Select Class</Text>
            <FlatList
              data={CLASSES}
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`class-option-${item}`}
                  style={[styles.row, value === item && styles.rowActive]}
                  onPress={() => { onChange(item); setOpen(false); }}
                >
                  <Text style={[styles.rowText, value === item && { color: colors.secondary, fontWeight: '800' }]}>Class {item}</Text>
                  {value === item && <Ionicons name="checkmark" color={colors.secondary} size={20} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff',
  },
  text: { fontSize: 16, color: colors.textPrimary },
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 40, maxHeight: '70%' },
  handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: 12, paddingHorizontal: 8 },
  row: { padding: 16, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowActive: { backgroundColor: '#FEF3C7' },
  rowText: { fontSize: 16, color: colors.textPrimary },
});
