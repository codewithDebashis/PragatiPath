import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, AppState, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { colors, radii, shadow } from './theme';

const DISMISS_KEY = 'pp_rating_dismissed';
const RATED_KEY = 'pp_rated';

export default function RatingPrompt() {
  const [visible, setVisible] = useState(false);
  const [stars, setStars] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const wasBackgroundedRef = useRef(false);
  const checkingRef = useRef(false);

  // Web visibility-based "background" detection
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVis = () => {
      if (document.hidden) {
        wasBackgroundedRef.current = true;
      } else if (wasBackgroundedRef.current) {
        wasBackgroundedRef.current = false;
        maybeShow();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Native AppState
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        wasBackgroundedRef.current = true;
      } else if (state === 'active' && wasBackgroundedRef.current) {
        wasBackgroundedRef.current = false;
        maybeShow();
      }
    });
    return () => sub.remove();
  }, []);

  const maybeShow = async () => {
    if (visible || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const dismissed = await AsyncStorage.getItem(DISMISS_KEY);
      const ratedLocal = await AsyncStorage.getItem(RATED_KEY);
      if (dismissed === '1' || ratedLocal === '1') return;
      // Verify with server (source of truth)
      const r = await api.get('/feedback/me/rated');
      if (r.data?.rated) {
        await AsyncStorage.setItem(RATED_KEY, '1');
        return;
      }
      setStars(0);
      setMsg('');
      setVisible(true);
    } catch {
      // silent
    } finally {
      checkingRef.current = false;
    }
  };

  const submit = async () => {
    if (!stars) { Alert.alert('Please select a star rating'); return; }
    setBusy(true);
    try {
      await api.post('/feedback', { type: 'rating', rating: stars, message: msg || undefined });
      await AsyncStorage.setItem(RATED_KEY, '1');
      setVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || e.message || 'Could not submit');
    } finally { setBusy(false); }
  };

  const dismissForever = async () => {
    await AsyncStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const remindLater = () => setVisible(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={remindLater}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.card} testID="rating-prompt-card">
          <View style={styles.iconWrap}>
            <Ionicons name="heart" size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Enjoying Pragati Path?</Text>
          <Text style={styles.sub}>Tap a star to rate the app. Your feedback helps us improve.</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} testID={`rating-star-${n}`} onPress={() => setStars(n)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={36} color={n <= stars ? '#F59E0B' : '#D1D5DB'} />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            testID="rating-feedback"
            style={styles.input}
            placeholder="Tell us what you loved or what we can improve (optional)"
            placeholderTextColor="#9CA3AF"
            value={msg}
            onChangeText={setMsg}
            multiline
            maxLength={500}
          />

          <TouchableOpacity testID="rating-submit" style={[styles.btnPrimary, (!stars || busy) && { opacity: 0.5 }]} onPress={submit} disabled={!stars || busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryTxt}>Submit Rating</Text>}
          </TouchableOpacity>

          <View style={styles.row2}>
            <TouchableOpacity testID="rating-later" style={styles.btnGhost} onPress={remindLater}>
              <Text style={styles.btnGhostTxt}>Maybe Later</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="rating-dismiss" style={styles.btnGhost} onPress={dismissForever}>
              <Text style={styles.btnGhostTxt}>No, thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: radii.card, padding: 24, alignItems: 'center', ...shadow },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6 },
  starsRow: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 12 },
  input: { width: '100%', minHeight: 70, borderWidth: 1, borderColor: colors.border, borderRadius: radii.input, padding: 12, fontSize: 14, color: colors.textPrimary, marginTop: 8, textAlignVertical: 'top' },
  btnPrimary: { width: '100%', backgroundColor: colors.primary, padding: 14, borderRadius: radii.button, alignItems: 'center', marginTop: 14 },
  btnPrimaryTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  row2: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  btnGhost: { padding: 10, flex: 1, alignItems: 'center' },
  btnGhostTxt: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
});
