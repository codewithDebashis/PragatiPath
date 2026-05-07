import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import { useAuth } from './auth';

// Show banner + sound when notification arrives in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowAlert: true,
  }) as any,
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push only works on physical devices for native; web/simulators are limited
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  // Android: ensure default channel exists
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    } catch {}
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return tokenData?.data || null;
  } catch (e) {
    return null;
  }
}

/**
 * Hook to register the device for Expo push notifications and save the token to the backend.
 * Should be called once after login (e.g., from the parent layout).
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const lastTokenSentRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!user?.id) return;
      const token = await registerForPushNotificationsAsync();
      if (!isMounted || !token) return;
      if (lastTokenSentRef.current === token) return;
      try {
        await api.post('/users/me/push-token', { push_token: token, platform: Platform.OS });
        lastTokenSentRef.current = token;
      } catch {
        // silent — backend may be unreachable or token invalid; will retry next mount
      }
    })();
    return () => { isMounted = false; };
  }, [user?.id]);

  // Listen for taps on incoming push notifications (optional UX hook)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Could navigate based on data.type if needed; for now no-op.
    });
    return () => sub.remove();
  }, []);
}
