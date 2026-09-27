import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DriverPlaceholder } from '@/components/DriverPlaceholder';
import { DriverRideCard } from '@/components/DriverRideCard';
import { useAuth } from '@/context/AuthContext';
import { useDriverFeed } from '@/hooks/useDriverFeed';
import { api } from '@/services/api';
import type { DriverRide } from '@/types/auth';

type Offers = { active: DriverRide | null; rides: DriverRide[] };
const emptyOffers: Offers = { active: null, rides: [] };
async function loadOffers(token: string, signal: AbortSignal): Promise<Offers> {
  const active = await api.getActiveRide(token, signal);
  return { active, rides: active ? [] : await api.getAvailableRides(token, signal) };
}

export default function AvailableScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const feed = useDriverFeed(loadOffers, emptyOffers, { enabled: user?.role === 'TaxiDriver' });
  const [updatingRideId, setUpdatingRideId] = useState<number | null>(null);

  async function updateRide(ride: DriverRide, action: 'accept' | 'decline') {
    if (!feed.canAct || feed.isUpdating || feed.data.active) return;
    setUpdatingRideId(ride.id);
    try {
      await feed.perform(async (token, signal) => {
        if (action === 'accept') return api.acceptRide(ride.id, token, signal);
        await api.declineRide(ride.id, token, signal);
        return null;
      }, (accepted) => {
        if (accepted) {
          feed.setData({ active: accepted, rides: [] });
          router.navigate('/(driver)/active');
        } else {
          feed.setData({ ...feed.data, rides: feed.data.rides.filter((item) => item.id !== ride.id) });
        }
      });
    } finally { setUpdatingRideId(null); }
  }

  if (user?.role !== 'TaxiDriver') {
    return <DriverPlaceholder message="Ride dispatch is available only to TaxiDriver accounts." statusMessage="Use a driver account to accept and manage rides." statusTitle="Driver access required" title="Available rides" />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.screen, { paddingBottom: Math.max(insets.bottom, 20) }]} refreshControl={<RefreshControl refreshing={feed.isRefreshing} onRefresh={feed.refresh} tintColor="#1f7a8c" colors={['#1f7a8c']} />}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
        <Text style={styles.title}>Your next ride</Text>
        <Text style={styles.subtitle}>Choose a request from your taxi service. New requests refresh automatically.</Text>
      </View>
      {feed.error ? <View style={styles.notice}><Text accessibilityRole="alert" style={styles.error}>{feed.error}</Text><Pressable accessibilityRole="button" onPress={feed.refresh} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable></View> : null}
      {feed.isLoading ? <ActivityIndicator accessibilityLabel="Loading requests" color="#1f7a8c" size="large" /> : null}
      {feed.data.active ? (
        <View style={styles.activeCard}>
          <Text style={styles.eyebrow}>ACTIVE RIDE</Text>
          <Text style={styles.cardTitle}>You have a ride to finish</Text>
          <Text style={styles.subtitle}>Continue your current ride before choosing another request.</Text>
          <Text style={styles.pickup}>{feed.data.active.pickupAddress}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/(driver)/active')} style={styles.primaryButton}><Text style={styles.primaryText}>Return to active ride</Text></Pressable>
        </View>
      ) : null}
      {!feed.isLoading && !feed.error && !feed.data.active && feed.data.rides.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>A → B</Text></View>
          <Text style={styles.cardTitle}>Ready for your next request</Text>
          <Text style={styles.emptyText}>No rides are waiting right now. Requests from your taxi service will appear here.</Text>
          <Text style={styles.hint}>Updates every 10 seconds while this tab is open</Text>
        </View>
      ) : null}
      {feed.data.rides.length > 0 ? <View style={styles.listHeading}><Text style={styles.listTitle}>Available requests</Text><Text style={styles.count}>{feed.data.rides.length}</Text></View> : null}
      {feed.data.rides.map((ride) => (
        <DriverRideCard key={ride.id} ride={ride} actionLabel="Accept ride" secondaryActionLabel="Decline" busy={feed.isUpdating && updatingRideId === ride.id} disabled={!feed.canAct || feed.isUpdating} onAction={() => void updateRide(ride, 'accept')} onSecondaryAction={() => void updateRide(ride, 'decline')} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f5fafb', flexGrow: 1, gap: 16, padding: 20 },
  heading: { gap: 9, marginBottom: 4, marginTop: 8 },
  eyebrow: { color: '#1f7a8c', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#17323b', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#607080', fontSize: 15, lineHeight: 23 },
  notice: { backgroundColor: '#fff7ed', borderRadius: 14, padding: 14 },
  error: { color: '#8b4b14', fontSize: 14, lineHeight: 21 },
  retry: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingRight: 24 },
  link: { color: '#176b7b', fontWeight: '800', fontSize: 15 },
  activeCard: { backgroundColor: '#ffffff', borderColor: '#bcdae2', borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 },
  cardTitle: { color: '#17323b', fontSize: 22, fontWeight: '800' },
  pickup: { backgroundColor: '#edf6f8', borderRadius: 12, color: '#17323b', fontSize: 16, lineHeight: 24, padding: 14 },
  primaryButton: { backgroundColor: '#1f7a8c', borderRadius: 12, minHeight: 54, alignItems: 'center', justifyContent: 'center', padding: 14 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  emptyCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderWidth: 1, borderRadius: 20, padding: 24, gap: 14 },
  emptyMark: { backgroundColor: '#e4f2f5', borderRadius: 20, padding: 22 },
  emptyMarkText: { color: '#1f7a8c', fontSize: 22, fontWeight: '800' },
  emptyText: { color: '#607080', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  hint: { color: '#607080', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  listHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  listTitle: { color: '#17323b', fontSize: 16, fontWeight: '800' },
  count: { backgroundColor: '#e4f2f5', borderRadius: 12, color: '#176b7b', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4 },
});
