import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { canAccessControl, getMobileHome } from '@/utils/mobileAccess';
import { controlColors } from '@/components/control/ControlUI';

export default function ControlLayout() {
  const { user } = useAuth();
  if (!canAccessControl(user?.role)) return <Redirect href={getMobileHome(user?.role)} />;
  return <Tabs screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: controlColors.background }, headerTintColor: controlColors.ink,
    headerTitleStyle: { fontSize: 18, fontWeight: '800' }, tabBarActiveTintColor: controlColors.teal, tabBarInactiveTintColor: controlColors.muted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: controlColors.border } }}>
    <Tabs.Screen name="index" options={{ href: null }} />
    <Tabs.Screen name="overview" options={{ title: 'Overview', tabBarIcon: () => <Text style={{ fontSize: 19 }}>🏠</Text> }} />
    <Tabs.Screen name="rides" options={{ title: 'Rides', headerShown: false, tabBarIcon: () => <Text style={{ fontSize: 19 }}>🚕</Text> }} />
    <Tabs.Screen name="fleets" options={{ title: 'Fleets', headerShown: false, tabBarIcon: () => <Text style={{ fontSize: 19 }}>🏢</Text> }} />
    <Tabs.Screen name="users" options={{ title: 'Users', href: user?.role === 'SuperAdmin' ? '/admin/users' : null, tabBarIcon: () => <Text style={{ fontSize: 19 }}>👥</Text> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <Text style={{ fontSize: 19 }}>👤</Text> }} />
  </Tabs>;
}
