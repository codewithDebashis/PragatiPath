import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, formatApiError } from '../../src/api';
import { colors, radii, shadow } from '../../src/theme';

export default function AdminUpi() {
  const [upiId, setUpiId] = useState('');
  const [qr, setQr] = useState('');
  const [fee, setFee] = useState('');
  const [instr, setInstr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await api.get('/upi-settings');
      setUpiId(r.data.upi_id || '');
      setQr(r.data.qr_image_base64 || '');
      setFee(r.data.fee_amount ? String(r.data.fee_amount) : '');
      setInstr(r.data.instructions || '');
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const pickQr = async () => {
    const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!r.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6 });
    if (!res.canceled && res.assets?.[0]?.base64) setQr(res.assets[0].base64);
  };

  const save = async () => {
    if (!upiId.trim()) { Alert.alert('UPI ID required'); return; }
    setBusy(true);
    try {
      await api.put('/admin/upi-settings', {
        upi_id: upiId.trim(),
        qr_image_base64: qr,
        fee_amount: fee ? Number(fee) : 0,
        instructions: instr,
      });
      Alert.alert('Saved', 'UPI settings updated successfully');
    } catch (e: any) { Alert.alert('Error', formatApiError(e?.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} testID="admin-upi">
        <Text style={styles.h1}>UPI / QR Settings</Text>
        <Text style={styles.sub}>These details show on the parent payment screen</Text>

        <View style={styles.card}>
          <Text style={styles.label}>UPI ID *</Text>
          <TextInput testID="upi-id-input" style={styles.input} value={upiId} onChangeText={setUpiId} placeholder="example@upi" placeholderTextColor="#9CA3AF" autoCapitalize="none" />

          <Text style={styles.label}>Fee Amount (INR)</Text>
          <TextInput testID="fee-input" style={styles.input} value={fee} onChangeText={setFee} placeholder="5000" placeholderTextColor="#9CA3AF" keyboardType="numeric" />

          <Text style={styles.label}>QR Code Image</Text>
          <TouchableOpacity testID="pick-qr" style={styles.pickBtn} onPress={pickQr}>
            <Ionicons name="qr-code" size={20} color={colors.primary} />
            <Text style={styles.pickTxt}>{qr ? 'Change QR image' : 'Upload QR image'}</Text>
          </TouchableOpacity>
          {qr ? <Image source={{ uri: `data:image/jpeg;base64,${qr}` }} style={styles.qr} testID="qr-preview" /> : null}

          <Text style={styles.label}>Instructions for parents</Text>
          <TextInput
            testID="instructions-input"
            style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
            value={instr}
            onChangeText={setInstr}
            multiline
            placeholder="e.g. Pay using any UPI app, then upload screenshot."
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity testID="save-upi" style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save Settings</Text>}
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
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, backgroundColor: '#F3F4F6' },
  pickTxt: { color: colors.primary, fontWeight: '600' },
  qr: { width: 200, height: 200, borderRadius: 12, alignSelf: 'center', marginTop: 12 },
  saveBtn: { backgroundColor: colors.secondary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 24 },
  saveTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
