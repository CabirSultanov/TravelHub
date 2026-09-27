import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DriverRide } from '@/types/auth';
import { formatRideDate, formatRidePrice, getDriverStatusLabel } from '@/utils/driverRides';

function RideTime({ label, value }: { label: string; value?: string | null }) {
  if (!value || formatRideDate(value) === 'Date unavailable') return null;
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{formatRideDate(value)}</Text></View>;
}

export function DriverActiveRide({ ride }: { ride: DriverRide }) {
  const [callError, setCallError] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const completed = ride.status === 'Completed';
  const arrived = ride.status === 'DriverArrived';
  const assigned = ride.status === 'DriverAssigned';
  const activeStep = completed ? 2 : arrived ? 1 : 0;
  const phone = ride.phoneNumber.trim();

  async function callPassenger() {
    if (isCalling || !phone) return;
    setIsCalling(true);
    setCallError('');
    try {
      await Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
    } catch {
      setCallError('Unable to open the phone app. Use the passenger’s number shown above.');
    } finally {
      setIsCalling(false);
    }
  }

  return (
    <View style={styles.content}>
      <View style={styles.heading}>
        <View style={styles.headingTop}><Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text><Text style={styles.rideId}>RIDE #{ride.id}</Text></View>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{getDriverStatusLabel(ride.status)}</Text>
        <Text style={styles.subtitle}>{completed ? 'All done. This ride is now in your history.' : arrived ? 'Your arrival is now shown on the passenger’s ride screen. Take them to their destination when they are ready.' : assigned ? 'Your passenger is expecting you. Head to the pickup point below.' : 'Check the current ride details below.'}</Text>
      </View>

      <View style={[styles.statusCard, completed && styles.completedCard]}>
        {completed ? <Text accessible={false} style={styles.completeCheck}>✓</Text> : null}
        <View accessibilityLabel={completed ? 'Ride progress: completed' : arrived ? 'Ride progress: at pickup' : 'Ride progress: accepted'} style={styles.progress}>
          {['Accepted', 'At pickup', 'Completed'].map((label, index) => (
            <View key={label} style={styles.progressStep}>
              <View style={[styles.stepDot, index <= activeStep && styles.stepDone]}><Text accessible={false} style={[styles.stepNumber, index <= activeStep && styles.stepDoneText]}>{index < activeStep || completed ? '✓' : index + 1}</Text></View>
              <Text style={[styles.stepLabel, index === activeStep && styles.currentStep]}>{label}</Text>
            </View>
          ))}
        </View>
        {completed ? <><Text style={styles.completedFare}>{ride.totalPrice.toFixed(2)} <Text style={styles.currency}>AZN</Text></Text><Text style={styles.fareLabel}>Trip fare · {ride.distanceKm.toFixed(2)} km</Text><RideTime label="Completed" value={ride.completedAt} /></> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeading}><Text accessibilityRole="header" style={styles.cardTitle}>{completed ? 'Trip summary' : 'Your route'}</Text><Text style={styles.classBadge}>{ride.carClassName}</Text></View>
        <View style={[styles.routePoint, !completed && styles.pickupPoint]}>
          <View style={styles.routeMarker}><Text accessible={false} style={styles.routeMarkerText}>A</Text></View>
          <View style={styles.routeText}><Text style={styles.routeLabel}>{completed ? 'PICKUP' : arrived ? 'MEET YOUR PASSENGER HERE' : 'PICKUP POINT'}</Text><Text selectable style={[styles.address, !completed && styles.pickupAddress]}>{ride.pickupAddress}</Text></View>
        </View>
        <View style={styles.routePoint}>
          <View style={[styles.routeMarker, styles.dropoffMarker]}><Text accessible={false} style={styles.routeMarkerText}>B</Text></View>
          <View style={styles.routeText}><Text style={styles.routeLabel}>DROPOFF</Text><Text selectable style={styles.address}>{ride.dropoffAddress}</Text></View>
        </View>
        <View style={styles.summary}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Taxi service</Text><Text style={styles.summaryValue}>{ride.taxiServiceName}</Text></View>
          {!completed ? <><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Distance</Text><Text style={styles.summaryValue}>{ride.distanceKm.toFixed(2)} km</Text></View><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Trip fare</Text><Text style={styles.fareValue}>{formatRidePrice(ride.totalPrice)}</Text></View></> : null}
          <RideTime label="Accepted" value={ride.acceptedAt} />
          <RideTime label="Arrived" value={ride.arrivedAt} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>PASSENGER</Text>
        <View style={styles.passengerRow}>
          <View style={styles.avatar}><Text accessible={false} style={styles.avatarText}>{ride.customerName.trim().split(/\s+/).slice(0, 2).map((name) => name[0]).join('')}</Text></View>
          <View style={styles.passengerDetails}><Text style={styles.passengerName}>{ride.customerName}</Text>{phone ? <Text selectable style={styles.phone}>{phone}</Text> : <Text style={styles.phone}>No phone number available</Text>}</View>
        </View>
        {!completed && phone ? <Pressable accessibilityRole="button" accessibilityLabel={`Call passenger ${ride.customerName}`} accessibilityState={{ disabled: isCalling }} disabled={isCalling} onPress={() => void callPassenger()} style={({ pressed }) => [styles.callButton, (pressed || isCalling) && styles.pressed]}>{isCalling ? <ActivityIndicator color="#1f7a8c" /> : null}<Text style={styles.callText}>{isCalling ? 'Opening phone…' : 'Call passenger'}</Text></Pressable> : null}
        {callError ? <Text accessibilityRole="alert" style={styles.callError}>{callError}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  heading: { gap: 10, marginBottom: 2, marginTop: 8 },
  headingTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  eyebrow: { color: '#1f7a8c', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  rideId: { color: '#768b93', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: '#17323b', fontSize: 32, fontWeight: '800', lineHeight: 40, letterSpacing: -0.8 },
  subtitle: { color: '#607080', fontSize: 15, lineHeight: 23 },
  statusCard: { backgroundColor: '#eaf5f6', borderColor: '#c7e1e5', borderRadius: 20, borderWidth: 1, gap: 18, padding: 20 },
  completedCard: { backgroundColor: '#edf7f1', borderColor: '#cce3d5' },
  completeCheck: { alignSelf: 'center', color: '#27764e', fontSize: 32, fontWeight: '800' },
  progress: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  progressStep: { alignItems: 'center', flex: 1, gap: 8 },
  stepDot: { alignItems: 'center', backgroundColor: '#f7fbfc', borderColor: '#cbdce0', borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  stepDone: { backgroundColor: '#1f7a8c', borderColor: '#1f7a8c' },
  stepNumber: { color: '#607080', fontSize: 13, fontWeight: '800' },
  stepDoneText: { color: '#ffffff' },
  stepLabel: { color: '#607080', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  currentStep: { color: '#17323b', fontWeight: '800' },
  completedFare: { color: '#17323b', fontSize: 34, fontWeight: '800', textAlign: 'center' },
  currency: { color: '#517466', fontSize: 16, fontWeight: '700' },
  fareLabel: { color: '#517466', fontSize: 13, marginTop: -10, textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 20, borderWidth: 1, gap: 16, padding: 18 },
  cardHeading: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  cardTitle: { color: '#17323b', flexShrink: 1, fontSize: 17, fontWeight: '800' },
  classBadge: { backgroundColor: '#edf4f6', borderRadius: 8, color: '#315c68', flexShrink: 1, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6 },
  routePoint: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingHorizontal: 2, paddingVertical: 8 },
  pickupPoint: { backgroundColor: '#eff8f9', borderColor: '#d6e9ec', borderRadius: 14, borderWidth: 1, padding: 14 },
  routeMarker: { alignItems: 'center', backgroundColor: '#d7edef', borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  dropoffMarker: { backgroundColor: '#e8eef3', borderRadius: 7 },
  routeMarkerText: { color: '#315c68', fontSize: 12, fontWeight: '800' },
  routeText: { flex: 1, gap: 6, minWidth: 0 },
  routeLabel: { color: '#1f7a8c', fontSize: 10, fontWeight: '800', letterSpacing: 0.7, lineHeight: 16 },
  address: { color: '#31515f', flexShrink: 1, fontSize: 15, lineHeight: 23 },
  pickupAddress: { color: '#17323b', fontSize: 18, fontWeight: '700', lineHeight: 26 },
  summary: { borderTopColor: '#e5edef', borderTopWidth: 1, gap: 12, paddingTop: 16 },
  summaryRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 14, justifyContent: 'space-between' },
  summaryLabel: { color: '#607080', flexShrink: 1, fontSize: 12, lineHeight: 19 },
  summaryValue: { color: '#31515f', flexShrink: 1, fontSize: 12, fontWeight: '600', lineHeight: 19, maxWidth: '65%', textAlign: 'right' },
  fareValue: { color: '#1f7a8c', flexShrink: 1, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  passengerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  avatar: { alignItems: 'center', backgroundColor: '#e5f2f3', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: '#1f7a8c', fontSize: 16, fontWeight: '800' },
  passengerDetails: { flex: 1, gap: 5, minWidth: 0 },
  passengerName: { color: '#17323b', fontSize: 17, fontWeight: '800', lineHeight: 24 },
  phone: { color: '#607080', fontSize: 14, lineHeight: 21 },
  callButton: { alignItems: 'center', backgroundColor: '#f0f8f9', borderColor: '#b7d8de', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 48, padding: 12 },
  callText: { color: '#1f7a8c', flexShrink: 1, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  callError: { color: '#a83434', fontSize: 13, lineHeight: 20 },
  pressed: { opacity: 0.65 },
});
