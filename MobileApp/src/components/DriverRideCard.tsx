import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DriverRide } from '@/types/auth';

export function DriverRideCard({
  ride,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  busy = false,
}: {
  ride: DriverRide;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.service}>{ride.taxiServiceName}</Text>
          <Text style={styles.className}>{ride.carClassName}</Text>
        </View>
        <Text style={styles.price}>{ride.totalPrice.toFixed(2)} AZN</Text>
      </View>

      <View style={styles.route}>
        <Text style={styles.routeLabel}>PICKUP</Text>
        <Text style={styles.address}>{ride.pickupAddress}</Text>
        <View style={styles.routeLine} />
        <Text style={styles.routeLabel}>DROPOFF</Text>
        <Text style={styles.address}>{ride.dropoffAddress}</Text>
      </View>

      <View style={styles.customerRow}>
        <Text style={styles.customer}>{ride.customerName}</Text>
        <Text style={styles.phone}>{ride.phoneNumber}</Text>
      </View>
      <Text style={styles.distance}>{ride.distanceKm.toFixed(2)} km</Text>

      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {secondaryActionLabel && onSecondaryAction && (
            <Pressable disabled={busy} onPress={onSecondaryAction} style={({ pressed }) => [styles.secondaryButton, (pressed || busy) && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
            </Pressable>
          )}
          {actionLabel && onAction && (
            <Pressable disabled={busy} onPress={onAction} style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Updating...' : actionLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 18, borderWidth: 1, gap: 14, padding: 18 },
  topRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  service: { color: '#17323b', fontSize: 18, fontWeight: '800' },
  className: { color: '#607080', fontSize: 14, marginTop: 3 },
  price: { color: '#1f7a8c', fontSize: 17, fontWeight: '800' },
  route: { backgroundColor: '#f5fafb', borderRadius: 12, gap: 4, padding: 13 },
  routeLabel: { color: '#1f7a8c', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  address: { color: '#31515f', fontSize: 15, lineHeight: 21 },
  routeLine: { backgroundColor: '#cbdde3', height: 1, marginVertical: 7 },
  customerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  customer: { color: '#17323b', fontSize: 16, fontWeight: '700' },
  phone: { color: '#607080', fontSize: 14 },
  distance: { color: '#607080', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  primaryButton: { alignItems: 'center', backgroundColor: '#1f7a8c', borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 46 },
  secondaryButton: { alignItems: 'center', borderColor: '#b43d3d', borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  secondaryButtonText: { color: '#b43d3d', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.65 },
});
