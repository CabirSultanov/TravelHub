import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DriverActiveRide } from '@/components/DriverActiveRide';
import { DriverPlaceholder } from '@/components/DriverPlaceholder';
import { useAuth } from '@/context/AuthContext';
import { useDriverFeed } from '@/hooks/useDriverFeed';
import { api } from '@/services/api';
import type { DriverRide } from '@/types/auth';
import { getDriverAction } from '@/utils/driverRides';

const loadActiveRide = (token: string, signal: AbortSignal) => api.getActiveRide(token, signal);

export default function ActiveScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [completed, setCompleted] = useState<{ userId: number; ride: DriverRide } | null>(null);
  const { data: activeRide, isLoading, isRefreshing, isUpdating, canAct, accessDenied, error, refresh, setData, perform } = useDriverFeed<DriverRide | null>(loadActiveRide, null, { enabled: user?.role === 'TaxiDriver' });
  const completedRide = !accessDenied && completed?.userId === user?.id ? completed?.ride : null;
  const ride = activeRide ?? completedRide;
  const action = ride ? getDriverAction(ride.status) : null;
  const actionDisabled = !canAct || isUpdating;
  const latestRide = useRef({ userId: user?.id, rideId: activeRide?.id, status: activeRide?.status, actionDisabled });
  latestRide.current = { userId: user?.id, rideId: activeRide?.id, status: activeRide?.status, actionDisabled };
  const focusVersion = useRef(0);

  useFocusEffect(useCallback(() => {
    focusVersion.current++;
    return () => { focusVersion.current++; };
  }, []));

  useEffect(() => { setCompleted(null); }, [user?.id]);
  useEffect(() => { if (accessDenied) setCompleted(null); }, [accessDenied]);
  useEffect(() => {
    if (activeRide && activeRide.status !== 'Completed') setCompleted(null);
  }, [activeRide]);

  function findNextRide() {
    setCompleted(null);
    router.navigate('/(driver)/available');
  }

  async function markArrived() {
    if (!activeRide || action !== 'arrived' || actionDisabled) return;
    await perform((token, signal) => api.markRideArrived(activeRide.id, token, signal), setData);
  }

  function confirmComplete() {
    if (!user || !activeRide || action !== 'complete' || actionDisabled) return;
    const rideId = activeRide.id;
    const userId = user.id;
    const confirmedFocus = focusVersion.current;
    const complete = () => {
      const latest = latestRide.current;
      if (focusVersion.current !== confirmedFocus || latest.userId !== userId || latest.rideId !== rideId || latest.status !== 'DriverArrived' || latest.actionDisabled) return;
      void perform((token, signal) => api.completeRide(rideId, token, signal), (updatedRide) => {
        if (updatedRide.status === 'Completed') {
          setCompleted({ userId, ride: updatedRide });
          setData(null);
        } else {
          setData(updatedRide);
        }
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Complete this ride? Only confirm after the passenger has reached their destination.')) complete();
      return;
    }
    Alert.alert('Complete this ride?', 'Only confirm after the passenger has reached their destination. This will move the ride to your history.', [
      { text: 'Keep ride active', style: 'cancel' },
      { text: 'Complete ride', onPress: complete },
    ]);
  }

  if (user?.role !== 'TaxiDriver') {
    return <DriverPlaceholder message="Ride dispatch is available only to TaxiDriver accounts." statusMessage="Use a driver account to manage an active ride." statusTitle="Driver access required" title="Active ride" />;
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#1f7a8c" colors={['#1f7a8c']} />}>
        {error ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry loading active ride" disabled={isUpdating} onPress={refresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {isLoading && !ride ? <View style={styles.loading}><ActivityIndicator color="#1f7a8c" size="large" /><Text style={styles.muted}>Getting your active ride…</Text></View> : null}

        {ride ? <DriverActiveRide key={ride.id} ride={ride} /> : !isLoading && !error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.eyebrow}>READY WHEN YOU ARE</Text>
            <Text accessibilityRole="header" style={styles.emptyTitle}>No active ride</Text>
            <Text style={styles.muted}>Accept a request from Available to see your passenger, pickup point, and next steps here.</Text>
            <Pressable accessibilityRole="button" onPress={findNextRide} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Find a ride</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {ride && (action || ride.status === 'Completed') ? (
        <SafeAreaView edges={['bottom']} style={styles.actionDock}>
          {ride.status === 'Completed' ? (
            <>
              <Pressable accessibilityRole="button" onPress={findNextRide} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>Find next ride</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.navigate('/(driver)/history')} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}><Text style={styles.historyText}>View history</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.actionHint}>{action === 'arrived' ? 'Let the passenger know when you reach the pickup.' : 'Complete only after reaching the passenger’s destination.'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action === 'arrived' ? "I've arrived" : 'Complete ride'}
                accessibilityState={{ disabled: actionDisabled, busy: isUpdating }}
                disabled={actionDisabled}
                onPress={action === 'arrived' ? () => void markArrived() : confirmComplete}
                style={({ pressed }) => [styles.primaryButton, (pressed || actionDisabled) && styles.pressed]}
              >
                {isUpdating ? <ActivityIndicator color="#ffffff" /> : null}
                <Text style={styles.primaryText}>{isUpdating ? 'Updating ride…' : action === 'arrived' ? "I've arrived" : 'Complete ride'}</Text>
              </Pressable>
            </>
          )}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f5fafb', flex: 1 },
  content: { flexGrow: 1, gap: 16, padding: 20, paddingBottom: 26 },
  errorCard: { backgroundColor: '#fff6ef', borderColor: '#edd6c4', borderRadius: 14, borderWidth: 1, gap: 6, padding: 14 },
  error: { color: '#8c432e', fontSize: 14, lineHeight: 21 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  retryText: { color: '#1f7a8c', fontSize: 14, fontWeight: '800' },
  loading: { alignItems: 'center', gap: 18, paddingVertical: 48 },
  muted: { color: '#607080', fontSize: 15, lineHeight: 23 },
  emptyCard: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 22, borderWidth: 1, gap: 16, marginTop: 16, padding: 24 },
  eyebrow: { color: '#1f7a8c', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  emptyTitle: { color: '#17323b', fontSize: 28, fontWeight: '800' },
  actionDock: { backgroundColor: '#ffffff', borderTopColor: '#dbe4eb', borderTopWidth: 1, gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  actionHint: { color: '#607080', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: '#1f7a8c', borderRadius: 14, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 54, paddingHorizontal: 16, paddingVertical: 12 },
  primaryText: { color: '#ffffff', flexShrink: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  historyButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  historyText: { color: '#1f7a8c', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
