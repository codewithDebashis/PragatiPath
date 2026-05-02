import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../src/auth';
import { colors, radii, shadow } from '../src/theme';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async () => {
    if (!email || !password) { setErr('Please enter email and password'); return; }
    setBusy(true); setErr('');
    try {
      const u = await login(email.trim(), password);
      if (u.role === 'admin') router.replace('/(admin)/dashboard');
      else router.replace('/(parent)/dashboard');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.brand}>PRAGATI PATH</Text>
            <Text style={styles.tag}>Designed for Winners.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.h1}>Welcome back</Text>
            <Text style={styles.sub}>Sign in to your parent account</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email"
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password"
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}

            <TouchableOpacity
              testID="login-submit"
              style={[styles.btn, busy && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
            </TouchableOpacity>

            <View style={styles.linkRow}>
              <Text style={styles.muted}>New parent? </Text>
              <Link href="/register" asChild>
                <TouchableOpacity testID="goto-register">
                  <Text style={styles.link}>Create account</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View style={styles.adminHint}>
              <Text style={styles.adminHintText}>Admin login: use admin email & password set by your school.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  scroll: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 60, backgroundColor: colors.primary },
  brand: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  tag: { color: colors.secondary, fontSize: 16, fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: colors.surface, marginHorizontal: 16, padding: 24, borderRadius: 24, marginTop: -30, ...shadow },
  h1: { fontSize: 26, fontWeight: '800', color: colors.primary },
  sub: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.textPrimary, backgroundColor: '#fff' },
  err: { color: colors.error, marginTop: 12, fontSize: 14 },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: radii.button, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  muted: { color: colors.textSecondary },
  link: { color: colors.secondary, fontWeight: '700' },
  adminHint: { marginTop: 18, padding: 12, backgroundColor: '#FFF7E6', borderRadius: 10 },
  adminHintText: { color: '#92400E', fontSize: 12 },
});
