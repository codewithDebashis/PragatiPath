import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth';
import { colors } from '../../src/theme';
import { View, ActivityIndicator } from 'react-native';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'admin') return <Redirect href="/(parent)/dashboard" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.primary, borderTopColor: '#1a2a44', height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }} />
      <Tabs.Screen name="payments" options={{ title: 'Payments', tabBarIcon: ({ color, size }) => <Ionicons name="cash" color={color} size={size} /> }} />
      <Tabs.Screen name="ads" options={{ title: 'Ads', tabBarIcon: ({ color, size }) => <Ionicons name="megaphone" color={color} size={size} /> }} />
      <Tabs.Screen name="upi" options={{ title: 'UPI', tabBarIcon: ({ color, size }) => <Ionicons name="qr-code" color={color} size={size} /> }} />
      <Tabs.Screen name="users" options={{ title: 'Users', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }} />
      <Tabs.Screen name="template" options={{ href: null }} />
      <Tabs.Screen name="items" options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ href: null }} />
    </Tabs>
  );
}
