import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AdminRide } from '@/types/admin';
import { adminStatus } from '@/utils/adminControl';
import { formatRidePrice } from '@/utils/driverRides';
import { s } from './ControlUI';

export function RideStatus({ status }: { status: string }) {
  return <Text accessibilityLiveRegion="polite" style={[styles.status, status === 'AwaitingDriver' && styles.waiting,
    status === 'Completed' && styles.completed, status === 'Cancelled' && styles.cancelled]}>{adminStatus(status)}</Text>;
}

export function ControlRide({ ride }: { ride: AdminRide }) {
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ride ${ride.id}, ${adminStatus(ride.status)}, ${ride.taxiServiceName}`}
    onPress={() => router.push({ pathname: '/admin/rides/[id]', params: { id: ride.id } })} style={({ pressed }) => [s.card, pressed && s.dim]}>
    <View style={s.row}><Text style={[s.eyebrow, s.grow]}>RIDE #{ride.id}</Text><RideStatus status={ride.status} /></View>
    <View style={s.row}><Text style={[s.cardTitle, s.grow]}>{ride.taxiServiceName}</Text><Text style={styles.price}>{formatRidePrice(ride.totalPrice)}</Text></View>
    <View style={styles.route}><Text style={s.label}>PICKUP</Text><Text numberOfLines={2} style={styles.address}>{ride.pickupAddress}</Text>
      <View style={styles.divider} /><Text style={s.label}>DROPOFF</Text><Text numberOfLines={2} style={styles.address}>{ride.dropoffAddress}</Text></View>
    <Text style={s.muted}>{ride.carClassName} · {ride.distanceKm.toFixed(2)} km</Text>
    <Text style={s.muted}>{ride.customerName}{ride.driverName ? ` · Driver: ${ride.driverName}` : ''}</Text>
    <Text style={s.buttonText}>View ride →</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  status: { color: '#236b7a', backgroundColor: '#e7f4f6', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  waiting: { color: '#865b24', backgroundColor: '#fff4dd' },
  completed: { color: '#27764e', backgroundColor: '#eaf6ef' },
  cancelled: { color: '#697781', backgroundColor: '#edf0f3' },
  price: { color: '#1f7a8c', fontSize: 18, fontWeight: '800' },
  route: { backgroundColor: '#f3f9fa', borderRadius: 13, padding: 13, gap: 6 },
  address: { color: '#31515f', fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: '#dce9ed', marginVertical: 5 },
});
