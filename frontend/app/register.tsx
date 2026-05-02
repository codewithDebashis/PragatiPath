import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Modal, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../src/auth';
import { colors, radii, shadow } from '../src/theme';
import { ClassPicker } from '../src/ClassPicker';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    child_name: '', child_age: '', child_class: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [welcome, setWelcome] = useState<{ userIdCode: string; email: string; password: string } | null>(null);

  const set = (k: string) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onSubmit = async () => {
    if (!form.name || !form.email || !form.password || !form.child_name || !form.child_class) {
      setErr('Please fill all required fields including class'); return;
    }
    if (form.password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setBusy(true); setErr('');
    try {
      const u = await register({
        ...form,
        email: form.email.trim(),
        child_age: form.child_age ? Number(form.child_age) : undefined,
      });
      setWelcome({
        userIdCode: u.user_id_code || '',
        email: u.email,
        password: form.password,
      });
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const closeWelcome = () => {
    setWelcome(null);
    router.replace('/(parent)/dashboard');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.brand}>Create your account</Text>
            <Text style={styles.tag}>Enroll your child at Pragati Path</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.section}>Parent details</Text>
            <Field label="Full Name *" value={form.name} onChange={set('name')} testID="reg-name" />
            <Field label="Email *" value={form.email} onChange={set('email')} testID="reg-email" autoCapitalize="none" keyboardType="email-address" />
            <Field label="Password *" value={form.password} onChange={set('password')} testID="reg-password" secureTextEntry />
            <Field label="Phone" value={form.phone} onChange={set('phone')} testID="reg-phone" keyboardType="phone-pad" />

            <Text style={[styles.section, { marginTop: 18 }]}>Child details</Text>
            <Field label="Child's Name *" value={form.child_name} onChange={set('child_name')} testID="reg-child-name" />
            <Field label="Child's Age" value={form.child_age} onChange={set('child_age')} testID="reg-child-age" keyboardType="numeric" />
            <Text style={styles.label}>Class / Grade *</Text>
            <ClassPicker value={form.child_class} onChange={set('child_class')} testID="reg-child-class" />

            {err ? <Text style={styles.err} testID="reg-error">{err}</Text> : null}

            <TouchableOpacity testID="reg-submit" style={[styles.btn, busy && { opacity: 0.6 }]} onPress={onSubmit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
            </TouchableOpacity>

            <View style={styles.linkRow}>
              <Text style={styles.muted}>Already have an account? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity testID="goto-login"><Text style={styles.link}>Sign in</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!welcome} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.trophyWrap}>
              <Ionicons name="trophy" size={42} color={colors.secondary} />
            </View>
            <Text style={styles.welcomeTitle}>🎉 Account Created!</Text>
            <Text style={styles.welcomeSub}>
              Please save these login details. You'll need them to sign in next time.
            </Text>

            <CredRow label="User ID" value={welcome?.userIdCode || ''} testID="welcome-user-id" />
            <CredRow label="Email" value={welcome?.email || ''} testID="welcome-email" />
            <CredRow label="Password" value={welcome?.password || ''} testID="welcome-password" sensitive />

            <View style={styles.warnBox}>
              <Ionicons name="alert-circle" size={18} color="#92400E" />
              <Text style={styles.warnText}>
                Save these credentials securely. Pragati Path is designed for Winners — every child is a winner!
              </Text>
            </View>

            <TouchableOpacity
              testID="welcome-copy-all"
              style={styles.copyAllBtn}
              onPress={async () => {
                if (!welcome) return;
                const text = `Pragati Path Login\nUser ID: ${welcome.userIdCode}\nEmail: ${welcome.email}\nPassword: ${welcome.password}`;
                await Clipboard.setStringAsync(text);
                Alert.alert('Copied', 'All credentials copied to clipboard');
              }}
            >
              <Ionicons name="copy" size={18} color={colors.primary} />
              <Text style={styles.copyAllText}>Copy all credentials</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="welcome-continue" style={styles.continueBtn} onPress={closeWelcome}>
              <Text style={styles.continueText}>I have saved them — Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CredRow({ label, value, testID, sensitive }: { label: string; value: string; testID?: string; sensitive?: boolean }) {
  const [hidden, setHidden] = useState(!!sensitive);
  return (
    <View style={styles.credRow} testID={testID}>
      <Text style={styles.credLabel}>{label}</Text>
      <View style={styles.credValueWrap}>
        <Text style={styles.credValue} selectable>
          {hidden ? '•'.repeat(Math.max(value.length, 6)) : value}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {sensitive && (
            <TouchableOpacity onPress={() => setHidden((h) => !h)} testID={`${testID}-toggle`}>
              <Ionicons name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={async () => {
              await Clipboard.setStringAsync(value);
              Alert.alert('Copied', `${label} copied`);
            }}
            testID={`${testID}-copy`}
          >
            <Ionicons name="copy" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Field({ label, value, onChange, testID, ...rest }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#9CA3AF"
        {...rest}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  hero: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 50, backgroundColor: colors.primary },
  brand: { color: '#fff', fontSize: 26, fontWeight: '800' },
  tag: { color: colors.secondary, fontSize: 14, marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: colors.surface, marginHorizontal: 16, padding: 24, borderRadius: 24, marginTop: -30, ...shadow },
  section: { color: colors.primary, fontWeight: '700', fontSize: 16, marginBottom: 6 },
  label: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 10, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary, backgroundColor: '#fff' },
  err: { color: colors.error, marginTop: 12, fontSize: 14 },
  btn: { backgroundColor: colors.secondary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  muted: { color: colors.textSecondary },
  link: { color: colors.primary, fontWeight: '700' },

  modalBg: { flex: 1, backgroundColor: 'rgba(10,25,47,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 24, ...shadow },
  trophyWrap: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  welcomeSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 18, lineHeight: 20 },
  credRow: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, marginBottom: 10 },
  credLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  credValueWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  credValue: { fontSize: 16, color: colors.primary, fontWeight: '700', flexShrink: 1, marginRight: 12 },
  warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10, marginTop: 8 },
  warnText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 18 },
  copyAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  copyAllText: { color: colors.primary, fontWeight: '700' },
  continueBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 12 },
  continueText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
