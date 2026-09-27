import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { CallButton, ControlHeading, ControlScreen, EmptyCard, FeedNotice, s } from '@/components/control/ControlUI';
import { RideStatus } from '@/components/control/ControlRide';
import { useControlFeed } from '@/hooks/useControlFeed';
import { api } from '@/services/api';
import type { AdminRide } from '@/types/admin';
import { isTerminalRide } from '@/utils/adminControl';
import { formatRideDate, formatRidePrice } from '@/utils/driverRides';

export default function RideDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const valid = Number.isSafeInteger(rideId) && rideId > 0;
  const feed = useControlFeed<AdminRide | null>((token, signal) => api.getAdminRide(rideId, token, signal), null,
    { resourceKey: `ride:${id}`, enabled: valid, poll: true, stopPolling: isTerminalRide });
  const ride = feed.data;
  return <ControlScreen feed={feed}>
    <ControlHeading title={`Ride #${valid ? rideId : '—'}`} subtitle="A live view of the journey. Only the assigned driver can progress this ride." />
    <FeedNotice feed={feed} />
    {!valid ? <EmptyCard title="Invalid ride link" message="Return to Rides and choose an existing booking." /> : null}
    {ride ? <>
      <View style={s.card}><RideStatus status={ride.status} /><Text style={s.cardTitle}>{ride.taxiServiceName}</Text><Text style={s.muted}>{ride.carClassName} · {ride.distanceKm.toFixed(2)} km</Text>
        <Text style={s.cardTitle}>{formatRidePrice(ride.totalPrice)}</Text>
        <Text style={s.label}>PICKUP</Text><Text selectable style={s.muted}>{ride.pickupAddress}</Text>
        <Text style={s.label}>DROPOFF</Text><Text selectable style={s.muted}>{ride.dropoffAddress}</Text></View>
      <View style={s.card}><Text style={s.eyebrow}>CUSTOMER</Text><Text style={s.cardTitle}>{ride.customerName}</Text><Text selectable style={s.muted}>{ride.email}</Text><CallButton name="customer" phone={ride.phoneNumber} /></View>
      <View style={s.card}><Text style={s.eyebrow}>DRIVER</Text><Text style={s.cardTitle}>{ride.driverId == null ? 'No driver assigned' : ride.driverName || 'Driver details unavailable'}</Text>
        {ride.driverId != null ? <CallButton name="driver" phone={ride.driverPhoneNumber} /> : <Text style={s.muted}>Driver details appear after a driver accepts the request.</Text>}</View>
      <View style={s.card}><Text style={s.cardTitle}>Ride timeline</Text>
        {ride.status === 'AwaitingDriver' ? <Text style={s.muted}>Waiting for a driver to accept.</Text> : null}
        {[['Accepted', ride.acceptedAt], ['Arrived', ride.arrivedAt], ['Completed', ride.completedAt], ['Cancelled', ride.cancelledAt]].map(([label, value]) => value && formatRideDate(value) !== 'Date unavailable'
          ? <View key={label} style={s.row}><Text style={s.label}>{label}</Text><Text style={s.muted}>{formatRideDate(value)}</Text></View> : null)}
        {!ride.acceptedAt && !ride.arrivedAt && !ride.completedAt && !ride.cancelledAt && ride.status !== 'AwaitingDriver' ? <Text style={s.muted}>No recorded event times for this booking.</Text> : null}</View>
      <View style={s.card}><Text style={s.cardTitle}>Demo payment</Text><Text style={s.muted}>{ride.paidAt ? `Recorded as paid · ${formatRideDate(ride.paidAt)}` : ride.status === 'Cancelled' ? 'Not charged. The request was cancelled.' : 'Not charged. Demo payment is recorded when a driver accepts.'}</Text>
        {ride.savedCardLast4 ? <Text style={s.muted}>Card ending {ride.savedCardLast4}</Text> : null}<Text style={s.label}>Educational payment only. No bank charge.</Text></View>
      {ride.rating != null ? <View style={s.card}><Text style={s.cardTitle}>Customer feedback</Text><Text accessibilityLabel={`${ride.rating} out of 5 stars`} style={s.cardTitle}>{'★'.repeat(Math.max(0, Math.min(5, ride.rating)))} · {ride.rating}/5</Text>
        {ride.reviewComment ? <Text style={s.muted}>{ride.reviewComment}</Text> : null}<Text style={s.label}>{formatRideDate(ride.reviewedAt)}</Text></View> : null}
    </> : null}
  </ControlScreen>;
}
