import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ControlButton, ControlHeading, ControlScreen, EmptyCard, FeedNotice, s } from '@/components/control/ControlUI';
import { ControlRide } from '@/components/control/ControlRide';
import { useControlFeed } from '@/hooks/useControlFeed';
import { api } from '@/services/api';
import type { AdminRide } from '@/types/admin';
import { completedToday, filterRides, isActiveRide } from '@/utils/adminControl';

export default function Overview() {
  const router = useRouter();
  const feed = useControlFeed<AdminRide[]>(api.getAdminRides, [], { poll: true });
  const waiting = filterRides(feed.data, 'Waiting');
  const now = new Date();
  const counters = [
    { label: 'Waiting for driver', value: waiting.length, filter: 'Waiting', caption: 'Requests still looking for a driver', tone: styles.waiting },
    { label: 'Active rides', value: feed.data.filter(isActiveRide).length, filter: 'Active', caption: 'Assigned or at the pickup point', tone: styles.active },
    { label: 'Completed today', value: feed.data.filter((ride) => completedToday(ride, now)).length, filter: 'Completed', caption: 'Based on your local date', tone: styles.completed },
  ];
  return <ControlScreen feed={feed}>
    <ControlHeading title="A clear view of your rides" subtitle="Keep an eye on requests and the teams moving them forward." />
    <FeedNotice feed={feed} />
    {feed.hasLoaded ? <>
      {counters.map((counter) => <Pressable key={counter.filter} accessibilityRole="button" accessibilityLabel={`${counter.label}: ${counter.value}`}
        onPress={() => router.navigate({ pathname: '/admin/rides', params: { filter: counter.filter, today: counter.filter === 'Completed' ? '1' : '0' } })}
        style={({ pressed }) => [s.card, counter.tone, pressed && s.dim]}>
        <View style={s.row}><View style={s.grow}><Text style={s.cardTitle}>{counter.label}</Text><Text style={s.muted}>{counter.caption}</Text></View><Text style={styles.number}>{counter.value}</Text></View>
      </Pressable>)}
      <View style={s.row}><Text style={[s.cardTitle, s.grow]}>Waiting requests</Text><Text style={s.label}>Newest first</Text></View>
      {waiting.slice(0, 5).map((ride) => <ControlRide key={ride.id} ride={ride} />)}
      {waiting.length === 0 ? <EmptyCard title="No requests waiting" message="New requests will appear here when a customer books a ride." /> : null}
      <ControlButton label="View all rides" onPress={() => router.navigate({ pathname: '/admin/rides', params: { filter: 'All', today: '0' } })} />
      <Text style={s.muted}>Updates every 10 seconds while this screen is open.</Text>
    </> : null}
  </ControlScreen>;
}

const styles = StyleSheet.create({
  number: { color: '#17323b', fontSize: 34, fontWeight: '800' },
  waiting: { borderColor: '#eadbbd', backgroundColor: '#fffcf6' },
  active: { borderColor: '#b9dce3', backgroundColor: '#eff8fa' },
  completed: { borderColor: '#cce3d5', backgroundColor: '#f1f8f4' },
});
