import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';

export default function DriverLayout() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1f7a8c" size="large" />
      </View>
    );
  }

  if (!user || user.role !== 'TaxiDriver') {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: '#f5fafb' },
      headerTintColor: '#17323b',
      tabBarActiveTintColor: '#1f7a8c',
      tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
    }}>
      <Tabs.Screen name="available" options={{ title: 'Available' }} />
      <Tabs.Screen name="active" options={{ title: 'Active' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: '#f5fafb', flex: 1, justifyContent: 'center' },
});
