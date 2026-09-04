import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { DriverPlaceholder } from '@/components/DriverPlaceholder';
import { DriverRideCard } from '@/components/DriverRideCard';
import { useAuth } from '@/context/AuthContext';
import { ApiError, api } from '@/services/api';
import { getToken } from '@/services/auth';
import type { DriverRide } from '@/types/auth';

export default function HistoryScreen() {
  const { signOut, user } = useAuth();
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setRides(await api.getRideHistory(token));
      setError('');
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        await signOut();
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Unable to load ride history.');
    } finally {
      setIsLoading(false);
    }
  }, [signOut]);

  useFocusEffect(useCallback(() => {
    if (user?.role !== 'TaxiDriver') return undefined;
    void loadHistory();
    return undefined;
  }, [loadHistory, user?.role]));

  if (user?.role !== 'TaxiDriver') {
    return <DriverPlaceholder message="Ride dispatch is available only to TaxiDriver accounts." statusMessage="Use a driver account to view completed rides." statusTitle="Driver access required" title="Ride history" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
        <Text style={styles.title}>Ride history</Text>
        <Text style={styles.subtitle}>Completed trips are kept here for your reference.</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#1f7a8c" size="large" /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!isLoading && !error && rides.length === 0 ? <Text style={styles.empty}>No completed rides yet.</Text> : null}
      {rides.map((ride) => <DriverRideCard key={ride.id} ride={ride} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f5fafb', flexGrow: 1, gap: 14, padding: 20 },
  heading: { gap: 8, marginBottom: 14, marginTop: 8 },
  eyebrow: { color: '#1f7a8c', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#17323b', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#607080', fontSize: 16, lineHeight: 24 },
  error: { color: '#a83434', fontSize: 14, lineHeight: 20 },
  empty: { color: '#607080', fontSize: 16, lineHeight: 24, paddingTop: 12, textAlign: 'center' },
});
