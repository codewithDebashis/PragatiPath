import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
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

  const set = (k: string) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onSubmit = async () => {
    if (!form.name || !form.email || !form.password || !form.child_name || !form.child_class) {
      setErr('Please fill all required fields including class'); return;
    }
    if (form.password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    setBusy(true); setErr('');
    try {
      await register({
        ...form,
        email: form.email.trim(),
        child_age: form.child_age ? Number(form.child_age) : undefined,
      });
      router.replace('/(parent)/dashboard');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
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
    </SafeAreaView>
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
});
