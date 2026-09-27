import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Choices, ControlButton, ControlHeading, ControlList, ControlModal, EmptyCard, FeedNotice, SearchField, s } from '@/components/control/ControlUI';
import { ControlRide } from '@/components/control/ControlRide';
import { useControlFeed } from '@/hooks/useControlFeed';
import { api } from '@/services/api';
import type { AdminRide } from '@/types/admin';
import { filterRides, rideFilters, type RideFilter } from '@/utils/adminControl';

export default function Rides() {
  const params = useLocalSearchParams<{ filter?: string; today?: string }>();
  const feed = useControlFeed<AdminRide[]>(api.getAdminRides, [], { poll: true });
  const [filter, setFilter] = useState<RideFilter>('All');
  const [today, setToday] = useState(false);
  const [search, setSearch] = useState('');
  const [fleetId, setFleetId] = useState<number>();
  const [choosingFleet, setChoosingFleet] = useState(false);
  const [fleetSearch, setFleetSearch] = useState('');
  useEffect(() => {
    setFilter(rideFilters.includes(params.filter as RideFilter) ? params.filter as RideFilter : 'All');
    setToday(params.today === '1');
    setSearch(''); setFleetId(undefined);
  }, [params.filter, params.today]);
  // ponytail: the existing API returns all rides. Server pagination is the upgrade when this list grows.
  const rides = filterRides(feed.data, filter, search, fleetId, today);
  const fleets = [...new Map(feed.data.map((ride) => [ride.taxiServiceId, ride.taxiServiceName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const matchingFleets = fleets.filter(([, name]) => name.toLowerCase().includes(fleetSearch.trim().toLowerCase()));
  return <>
    <ControlList data={rides} feed={feed} keyFor={(ride) => String(ride.id)} renderItem={(ride) => <ControlRide ride={ride} />}
      header={<View style={s.group}><ControlHeading title="Every ride, in view" subtitle="Follow requests across your taxi services. Ride actions stay with the driver." />
        <SearchField label="Ride number, customer or driver" value={search} onChange={setSearch} />
        <Choices values={rideFilters} selected={filter} onChange={(next) => { setFilter(next); setToday(false); }} />
        {today ? <ControlButton label="Completed today · Show all dates" onPress={() => setToday(false)} /> : null}
        <ControlButton label={fleetId ? `Fleet: ${fleets.find(([id]) => id === fleetId)?.[1] ?? `#${fleetId}`}` : 'All taxi services · Filter'} onPress={() => { setFleetSearch(''); setChoosingFleet(true); }} />
        <FeedNotice feed={feed} />{feed.hasLoaded ? <Text style={s.label}>{rides.length} matching rides · Newest first</Text> : null}
      </View>}
      empty={!feed.isLoading && !feed.error ? <EmptyCard title="No matching rides" message="Try another search or filter. New requests appear automatically." /> : undefined} />
    {choosingFleet ? <ControlModal title="Choose a taxi service" busy={false} onClose={() => setChoosingFleet(false)}>
      <SearchField label="Search taxi services" value={fleetSearch} onChange={setFleetSearch} />
      <ControlButton label="All taxi services" onPress={() => { setFleetId(undefined); setChoosingFleet(false); }} />
      {matchingFleets.slice(0, 50).map(([id, name]) => <ControlButton key={id} label={name} onPress={() => { setFleetId(id); setChoosingFleet(false); }} />)}
      <Text style={s.muted}>{matchingFleets.length > 50 ? 'Showing 50 matches. Refine your search.' : matchingFleets.length === 0 ? 'No matching taxi services in these rides.' : 'Only services with recorded rides are listed.'}</Text>
    </ControlModal> : null}
  </>;
}
