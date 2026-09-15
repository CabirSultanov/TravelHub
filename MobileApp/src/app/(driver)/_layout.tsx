import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { canAccessMobileApp } from '@/utils/mobileAccess';

export default function DriverLayout() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1f7a8c" size="large" />
      </View>
    );
  }

  if (!user || !canAccessMobileApp(user.role)) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: '#f5fafb' },
      headerTintColor: '#17323b',
      headerTitleStyle: { fontSize: 18, fontWeight: '800' },
      tabBarActiveTintColor: '#1f7a8c',
      tabBarInactiveTintColor: '#607080',
      tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      tabBarStyle: { borderTopColor: '#dbe4eb', backgroundColor: '#ffffff' },
    }}>
      <Tabs.Screen name="available" options={{ title: 'Available', tabBarIcon: () => <TabIcon symbol="🚕" /> }} />
      <Tabs.Screen name="active" options={{ title: 'Active', tabBarIcon: () => <TabIcon symbol="🚗" /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: () => <TabIcon symbol="📋" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TabIcon symbol="👤" /> }} />
    </Tabs>
  );
}

function TabIcon({ symbol }: { symbol: string }) {
  return <Text style={styles.tabIcon}>{symbol}</Text>;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: '#f5fafb', flex: 1, justifyContent: 'center' },
  tabIcon: { fontSize: 19 },
});
