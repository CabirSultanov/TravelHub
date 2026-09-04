import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { DriverPlaceholder } from '@/components/DriverPlaceholder';
import { DriverRideCard } from '@/components/DriverRideCard';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { getToken } from '@/services/auth';
import type { DriverRide } from '@/types/auth';

const REFRESH_INTERVAL_MS = 10_000;

export default function ActiveScreen() {
  const { user } = useAuth();
  const [ride, setRide] = useState<DriverRide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadRide = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    try {
      setRide(await api.getActiveRide(token));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your active ride.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (user?.role !== 'TaxiDriver') return undefined;
    void loadRide();
    const interval = setInterval(() => void loadRide(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadRide, user?.role]));

  async function updateRide() {
    const token = await getToken();
    if (!token || !ride) return;

    setIsUpdating(true);
    try {
      const updatedRide = ride.status === 'DriverAssigned'
        ? await api.markRideArrived(ride.id, token)
        : await api.completeRide(ride.id, token);
      setRide(updatedRide.status === 'Completed' ? null : updatedRide);
      setError('');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update this ride.');
    } finally {
      setIsUpdating(false);
    }
  }

  if (user?.role !== 'TaxiDriver') {
    return <DriverPlaceholder message="Ride dispatch is available only to TaxiDriver accounts." statusMessage="Use a driver account to manage an active ride." statusTitle="Driver access required" title="Active ride" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
        <Text style={styles.title}>Active ride</Text>
        <Text style={styles.subtitle}>Keep the customer updated as the trip progresses.</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#1f7a8c" size="large" /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!isLoading && !error && !ride ? <Text style={styles.empty}>You do not have an active ride.</Text> : null}
      {ride && (
        <DriverRideCard
          actionLabel={ride.status === 'DriverAssigned' ? 'Mark arrived' : 'Complete ride'}
          busy={isUpdating}
          onAction={() => void updateRide()}
          ride={ride}
        />
      )}
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
