import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DriverRide } from '@/types/auth';
import { formatRidePrice } from '@/utils/driverRides';

export function DriverRideCard({
  ride,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  busy = false,
  disabled = false,
}: {
  ride: DriverRide;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const actionsDisabled = busy || disabled;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.tripHeading}>
          <Text style={styles.rideNumber}>RIDE #{ride.id}</Text>
          <Text style={styles.className}>{ride.carClassName}</Text>
        </View>
        <View style={styles.fare}>
          <Text style={styles.price}>{formatRidePrice(ride.totalPrice)}</Text>
          <Text style={styles.priceCaption}>Trip fare</Text>
        </View>
      </View>

      <View style={styles.route}>
        <View style={styles.routePoint}>
          <View style={styles.pickupMarker}><Text style={styles.markerText}>A</Text></View>
          <View style={styles.addressBlock}><Text style={styles.routeLabel}>PICKUP</Text><Text style={styles.address}>{ride.pickupAddress}</Text></View>
        </View>
        <View style={styles.routePoint}>
          <View style={styles.dropoffMarker}><Text style={styles.markerText}>B</Text></View>
          <View style={styles.addressBlock}><Text style={styles.routeLabel}>DROPOFF</Text><Text style={styles.address}>{ride.dropoffAddress}</Text></View>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.service}>{ride.taxiServiceName}</Text>
        <Text style={styles.distance}>{ride.distanceKm.toFixed(2)} km trip</Text>
      </View>
      <Text style={styles.customer}>Passenger · {ride.customerName}</Text>

      {Boolean(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {Boolean(actionLabel) && onAction && (
            <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel} ${ride.id}`} accessibilityState={{ disabled: actionsDisabled, busy }} disabled={actionsDisabled} onPress={onAction} style={({ pressed }) => [styles.primaryButton, (pressed || actionsDisabled) && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Updating...' : actionLabel}</Text>
            </Pressable>
          )}
          {Boolean(secondaryActionLabel) && onSecondaryAction && (
            <Pressable accessibilityRole="button" accessibilityLabel={`${secondaryActionLabel} ride ${ride.id}`} accessibilityState={{ disabled: actionsDisabled }} disabled={actionsDisabled} onPress={onSecondaryAction} style={({ pressed }) => [styles.secondaryButton, (pressed || actionsDisabled) && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 20, borderWidth: 1, gap: 12, padding: 18 },
  topRow: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  tripHeading: { flex: 1, gap: 5, minWidth: 95 },
  rideNumber: { color: '#607080', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  className: { color: '#17323b', fontSize: 20, fontWeight: '800' },
  fare: { alignItems: 'flex-end', gap: 2 },
  price: { color: '#176b7b', fontSize: 25, fontWeight: '800' },
  priceCaption: { color: '#607080', fontSize: 11 },
  route: { backgroundColor: '#f5fafb', borderRadius: 14, gap: 17, padding: 14 },
  routePoint: { alignItems: 'flex-start', flexDirection: 'row', gap: 11 },
  pickupMarker: { alignItems: 'center', backgroundColor: '#d9eef2', borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  dropoffMarker: { alignItems: 'center', backgroundColor: '#e8eef1', borderRadius: 8, height: 28, justifyContent: 'center', width: 28 },
  markerText: { color: '#1f7a8c', fontSize: 12, fontWeight: '800' },
  addressBlock: { flex: 1, gap: 4 },
  routeLabel: { color: '#607080', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  address: { color: '#17323b', fontSize: 16, fontWeight: '600', lineHeight: 23 },
  metaRow: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  service: { color: '#607080', flexShrink: 1, fontSize: 13, fontWeight: '700' },
  distance: { color: '#607080', fontSize: 13 },
  customer: { color: '#607080', fontSize: 13, lineHeight: 19 },
  actions: { gap: 4, marginTop: 3 },
  primaryButton: { alignItems: 'center', backgroundColor: '#1f7a8c', borderRadius: 12, justifyContent: 'center', minHeight: 54, paddingHorizontal: 16, paddingVertical: 12 },
  secondaryButton: { alignItems: 'center', borderRadius: 10, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  primaryButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  secondaryButtonText: { color: '#607080', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
