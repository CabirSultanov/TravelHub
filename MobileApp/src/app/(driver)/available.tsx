import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { DriverPlaceholder } from '@/components/DriverPlaceholder';
import { DriverRideCard } from '@/components/DriverRideCard';
import { useAuth } from '@/context/AuthContext';
import { ApiError, api } from '@/services/api';
import { getToken } from '@/services/auth';
import type { DriverRide } from '@/types/auth';

const REFRESH_INTERVAL_MS = 10_000;

export default function AvailableScreen() {
  const { signOut, user } = useAuth();
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingRideId, setUpdatingRideId] = useState<number | null>(null);

  const loadRides = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      const nextRides = await api.getAvailableRides(token);
      setRides(nextRides);
      setError('');
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        await signOut();
        return;
      }
      setError(loadError instanceof Error ? loadError.message : 'Unable to load available rides.');
    } finally {
      setIsLoading(false);
    }
  }, [signOut]);

  useFocusEffect(useCallback(() => {
    if (user?.role !== 'TaxiDriver') return undefined;
    void loadRides();
    const interval = setInterval(() => void loadRides(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadRides, user?.role]));

  async function updateRide(rideId: number, action: 'accept' | 'decline') {
    const token = await getToken();
    if (!token) return;

    setUpdatingRideId(rideId);
    try {
      if (action === 'accept') {
        await api.acceptRide(rideId, token);
      } else {
        await api.declineRide(rideId, token);
      }
      await loadRides();
    } catch (updateError) {
      if (updateError instanceof ApiError && updateError.status === 401) {
        await signOut();
        return;
      }
      setError(updateError instanceof Error ? updateError.message : 'Unable to update this ride.');
    } finally {
      setUpdatingRideId(null);
    }
  }

  if (user?.role !== 'TaxiDriver') {
    return <DriverPlaceholder message="Ride dispatch is available only to TaxiDriver accounts." statusMessage="Use a driver account to accept and manage rides." statusTitle="Driver access required" title="Available rides" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
        <Text style={styles.title}>Available rides</Text>
        <Text style={styles.subtitle}>New requests refresh automatically while this screen is open.</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#1f7a8c" size="large" /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!isLoading && !error && rides.length === 0 ? <Text style={styles.empty}>No rides are available right now.</Text> : null}
      {rides.map((ride) => (
        <DriverRideCard
          actionLabel="Accept"
          busy={updatingRideId === ride.id}
          key={ride.id}
          onAction={() => void updateRide(ride.id, 'accept')}
          onSecondaryAction={() => void updateRide(ride.id, 'decline')}
          ride={ride}
          secondaryActionLabel="Decline"
        />
      ))}
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
