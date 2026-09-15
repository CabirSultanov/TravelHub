import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { useDriverFeed } from '@/hooks/useDriverFeed';
import { api } from '@/services/api';

type DriverFleet = { id: number; companyName: string; city: string; phoneNumber: string };

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const fleet = useDriverFeed<DriverFleet | null>(
    (token, signal) => api.getTaxiService(user?.taxiServiceId ?? 0, token, signal),
    null,
    { poll: false, enabled: user?.taxiServiceId != null },
  );

  if (!user) return null;

  const roleLabel = user.role === 'TaxiDriver' ? 'Taxi driver' : user.role === 'SuperAdmin' ? 'Super admin' : user.role;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();

  async function logOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } catch {
      // AuthContext still clears the local user if SecureStore reports a deletion error.
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen} refreshControl={user.taxiServiceId != null ? <RefreshControl refreshing={fleet.isRefreshing} onRefresh={() => void fleet.refresh()} tintColor="#1f7a8c" colors={['#1f7a8c']} /> : undefined}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>Your account and taxi service, in one place.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.identityText}><Text style={styles.name}>{user.name}</Text><Text style={styles.role}>{roleLabel}</Text></View>
          </View>
          <View style={styles.divider} />
          <View style={styles.field}><Text style={styles.label}>Email</Text><Text selectable style={styles.value}>{user.email}</Text></View>
          <View style={styles.field}><Text style={styles.label}>Phone number</Text><Text selectable style={styles.value}>{user.phoneNumber || 'Not provided'}</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your taxi service</Text>
          {user.taxiServiceId == null ? <Text style={styles.subtitle}>{user.role === 'TaxiDriver' ? 'No taxi service assigned yet. Ask your taxi service owner to add you to their team.' : 'This account is not assigned to a taxi service.'}</Text>
            : fleet.isLoading ? <ActivityIndicator accessibilityLabel="Loading taxi service" color="#1f7a8c" />
              : <>
                {fleet.data && <><Text style={styles.fleetName}>{fleet.data.companyName}</Text><View style={styles.field}><Text style={styles.label}>City</Text><Text style={styles.value}>{fleet.data.city}</Text></View><View style={styles.field}><Text style={styles.label}>Taxi service phone</Text><Text selectable style={styles.value}>{fleet.data.phoneNumber || 'Not provided'}</Text></View></>}
                {fleet.error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>Taxi service details are unavailable right now.</Text><Pressable accessibilityRole="button" disabled={fleet.isRefreshing} onPress={() => void fleet.refresh()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
              </>}
        </View>

        <Pressable accessibilityRole="button" accessibilityState={{ disabled: loggingOut, busy: loggingOut }} disabled={loggingOut} onPress={() => void logOut()} style={({ pressed }) => [styles.logoutButton, (pressed || loggingOut) && styles.pressed]}>
          <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Log out'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f5fafb', flex: 1 },
  screen: { flexGrow: 1, gap: 16, padding: 20, paddingBottom: 32 },
  heading: { gap: 8, marginBottom: 8, marginTop: 8 },
  eyebrow: { color: '#1f7a8c', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#17323b', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#607080', fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 20, borderWidth: 1, gap: 18, padding: 20 },
  identity: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: '#d9eef2', borderRadius: 29, height: 58, justifyContent: 'center', width: 58 },
  avatarText: { color: '#1f7a8c', fontSize: 22, fontWeight: '800' },
  identityText: { flex: 1, gap: 6 },
  name: { color: '#17323b', fontSize: 22, fontWeight: '800' },
  role: { color: '#176b7b', fontSize: 13, fontWeight: '700' },
  divider: { backgroundColor: '#e5edf1', height: 1 },
  field: { gap: 5 },
  label: { color: '#607080', fontSize: 12, fontWeight: '700' },
  value: { color: '#31515f', fontSize: 16, lineHeight: 24 },
  sectionTitle: { color: '#17323b', fontSize: 18, fontWeight: '800' },
  fleetName: { color: '#176b7b', fontSize: 21, fontWeight: '800' },
  errorBox: { gap: 4 },
  error: { color: '#983c32', fontSize: 14, lineHeight: 21 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  retryText: { color: '#176b7b', fontSize: 14, fontWeight: '700' },
  logoutButton: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e9c8c6', borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 4, minHeight: 52, padding: 12 },
  logoutText: { color: '#a43b35', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.65 },
});
