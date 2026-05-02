import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

export default function AdminTemplate() {
  const [tpl, setTpl] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const r = await api.get('/admin/template'); setTpl(r.data.template); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/template', { template: tpl });
      Alert.alert('Saved', 'Auto-message template updated');
    } catch (e: any) { Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  const preview = tpl
    .replace('{user_id}', 'PP1A2B3C')
    .replace('{password}', 'abcd1234');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} testID="admin-template">
        <Text style={styles.h1}>Auto-message Template</Text>
        <Text style={styles.sub}>Sent automatically to parents when a payment is approved</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Template</Text>
          <Text style={styles.muted}>Use {'{user_id}'} and {'{password}'} placeholders.</Text>
          <TextInput
            testID="template-input"
            style={styles.input}
            value={tpl}
            onChangeText={setTpl}
            multiline
          />

          <Text style={styles.label}>Preview</Text>
          <View style={styles.previewBox}>
            <Ionicons name="trophy" color={colors.secondary} size={22} />
            <Text style={styles.previewText}>{preview}</Text>
          </View>

          <TouchableOpacity testID="save-template" style={[styles.btn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Save Template</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  h1: { fontSize: 26, fontWeight: '800', color: colors.primary },
  sub: { color: colors.textSecondary, marginTop: 2, marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: radii.card, ...shadow },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 4, textTransform: 'uppercase' },
  muted: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 14, color: colors.textPrimary, minHeight: 140, textAlignVertical: 'top', lineHeight: 20 },
  previewBox: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'flex-start' },
  previewText: { color: '#fff', flex: 1, lineHeight: 20, fontSize: 14 },
  btn: { backgroundColor: colors.secondary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 20 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
