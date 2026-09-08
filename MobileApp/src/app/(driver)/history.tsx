import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DriverPlaceholder } from '@/components/DriverPlaceholder';
import { useAuth } from '@/context/AuthContext';
import { useDriverFeed } from '@/hooks/useDriverFeed';
import { api } from '@/services/api';
import type { DriverRide } from '@/types/auth';
import { formatRideDate as rideDate, formatRidePrice } from '@/utils/driverRides';

const emptyHistory: DriverRide[] = [];

function HistoryRide({ ride }: { ride: DriverRide }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.ride}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ride ${ride.id}, ${rideDate(ride.completedAt)}, ${formatRidePrice(ride.totalPrice)}`}
        accessibilityHint="Shows or hides trip details"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.rideSummary, pressed && styles.pressed]}
      >
        <View style={styles.topRow}>
          <Text style={styles.date}>{rideDate(ride.completedAt)}</Text>
          <Text style={styles.price}>{formatRidePrice(ride.totalPrice)}</Text>
        </View>
        <View style={styles.routeRow}><View style={styles.pickupDot} /><Text numberOfLines={1} style={styles.address}>{ride.pickupAddress}</Text></View>
        <View style={styles.routeRow}><View style={styles.dropoffDot} /><Text numberOfLines={1} style={styles.address}>{ride.dropoffAddress}</Text></View>
        <View style={styles.bottomRow}>
          <Text style={styles.meta}>{ride.carClassName} · {ride.distanceKm.toFixed(2)} km</Text>
          <Text style={styles.expandLabel}>{expanded ? 'Hide details −' : 'View details +'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detailHeading}>Ride #{ride.id} · Completed</Text>
          <View style={styles.detailField}><Text style={styles.label}>Pickup</Text><Text style={styles.detailValue}>{ride.pickupAddress}</Text></View>
          <View style={styles.detailField}><Text style={styles.label}>Dropoff</Text><Text style={styles.detailValue}>{ride.dropoffAddress}</Text></View>
          <View style={styles.detailField}><Text style={styles.label}>Passenger</Text><Text style={styles.detailValue}>{ride.customerName}</Text></View>
          <View style={styles.detailField}><Text style={styles.label}>Taxi service</Text><Text style={styles.detailValue}>{ride.taxiServiceName}</Text></View>
          {ride.acceptedAt ? <View style={styles.detailField}><Text style={styles.label}>Accepted</Text><Text style={styles.detailValue}>{rideDate(ride.acceptedAt)}</Text></View> : null}
          {ride.arrivedAt ? <View style={styles.detailField}><Text style={styles.label}>Arrived at pickup</Text><Text style={styles.detailValue}>{rideDate(ride.arrivedAt)}</Text></View> : null}
        </View>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const feed = useDriverFeed<DriverRide[]>(api.getRideHistory, emptyHistory, {
    poll: false,
    enabled: user?.role === 'TaxiDriver' && user.taxiServiceId != null,
  });

  if (user?.role !== 'TaxiDriver') {
    return <DriverPlaceholder message="Your account can explore the app, but ride history belongs to drivers." statusMessage="Sign in with a taxi driver account to view completed rides." statusTitle="Driver account required" title="Ride history" />;
  }

  if (user.taxiServiceId == null) {
    return <DriverPlaceholder message="Your account has not been assigned to a taxi service." statusMessage="Ask your taxi service owner to add you to their team." statusTitle="Taxi service needed" title="Ride history" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <FlatList
        data={feed.data}
        keyExtractor={(ride) => String(ride.id)}
        renderItem={({ item }) => <HistoryRide ride={item} />}
        contentContainerStyle={styles.screen}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={feed.isRefreshing} onRefresh={() => void feed.refresh()} tintColor="#1f7a8c" colors={['#1f7a8c']} />}
        ListHeaderComponent={
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
            <Text style={styles.title}>Your completed rides</Text>
            <Text style={styles.subtitle}>A record of the trips you have finished. Tap a ride for details.</Text>
            {feed.error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.error}>{feed.error}</Text><Pressable accessibilityRole="button" onPress={() => void feed.refresh()} disabled={feed.isLoading || feed.isRefreshing} style={styles.retryButton}><Text style={styles.retryLabel}>Try again</Text></Pressable></View> : null}
          </View>
        }
        ListEmptyComponent={feed.isLoading ? <ActivityIndicator accessibilityLabel="Loading ride history" color="#1f7a8c" size="large" style={styles.loader} /> : !feed.error ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptySymbol}><Text style={styles.emptySymbolText}>✓</Text></View>
            <Text style={styles.emptyTitle}>Your first completed ride goes here</Text>
            <Text style={styles.emptyMessage}>Finish a ride from the Active tab and its details will appear in your history.</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f5fafb', flex: 1 },
  screen: { flexGrow: 1, padding: 20, paddingBottom: 32 },
  heading: { gap: 8, marginBottom: 24, marginTop: 8 },
  eyebrow: { color: '#1f7a8c', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#17323b', fontSize: 28, fontWeight: '800', lineHeight: 35 },
  subtitle: { color: '#607080', fontSize: 15, lineHeight: 23 },
  ride: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  rideSummary: { gap: 11, padding: 16 },
  topRow: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', marginBottom: 3 },
  date: { color: '#607080', flexShrink: 1, fontSize: 12, fontWeight: '600', lineHeight: 20 },
  price: { color: '#17323b', fontSize: 19, fontWeight: '800' },
  routeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  pickupDot: { backgroundColor: '#1f7a8c', borderRadius: 5, height: 9, width: 9 },
  dropoffDot: { borderColor: '#607080', borderRadius: 2, borderWidth: 2, height: 9, width: 9 },
  address: { color: '#31515f', flex: 1, fontSize: 14, lineHeight: 21 },
  bottomRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginTop: 4 },
  meta: { color: '#607080', fontSize: 12 },
  expandLabel: { color: '#176b7b', fontSize: 12, fontWeight: '700' },
  details: { backgroundColor: '#f5fafb', borderTopColor: '#dbe4eb', borderTopWidth: 1, gap: 14, padding: 16 },
  detailHeading: { color: '#176b7b', fontSize: 13, fontWeight: '800' },
  detailField: { gap: 3 },
  label: { color: '#607080', fontSize: 11, fontWeight: '700' },
  detailValue: { color: '#31515f', fontSize: 14, lineHeight: 21 },
  separator: { height: 12 },
  pressed: { opacity: 0.65 },
  errorCard: { backgroundColor: '#fff3f0', borderRadius: 12, gap: 6, marginTop: 8, padding: 14 },
  error: { color: '#983c32', fontSize: 14, lineHeight: 21 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  retryLabel: { color: '#176b7b', fontSize: 14, fontWeight: '700' },
  loader: { padding: 24 },
  emptyCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 18, borderWidth: 1, gap: 12, padding: 24 },
  emptySymbol: { alignItems: 'center', backgroundColor: '#e6f2f3', borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  emptySymbolText: { color: '#1f7a8c', fontSize: 26, fontWeight: '700' },
  emptyTitle: { color: '#17323b', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { color: '#607080', fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
