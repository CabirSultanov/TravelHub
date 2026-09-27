import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Choices, ControlButton, ControlHeading, ControlList, EmptyCard, FeedNotice, SearchField, s } from '@/components/control/ControlUI';
import { useControlFeed } from '@/hooks/useControlFeed';
import { api } from '@/services/api';
import type { TaxiFleet } from '@/types/admin';
import type { AuthUser } from '@/types/auth';
import { filterFleets, type FleetFilter } from '@/utils/adminControl';

const empty = { fleets: [] as TaxiFleet[], owners: [] as AuthUser[] };
async function loadFleets(token: string, signal: AbortSignal) {
  const [fleets, owners] = await Promise.all([api.getTaxiFleets(token, signal), api.getOwnerCandidates(token, signal)]);
  return { fleets, owners };
}

export default function Fleets() {
  const router = useRouter();
  const feed = useControlFeed(loadFleets, empty);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FleetFilter>('All');
  const fleets = filterFleets(feed.data.fleets, filter, search);
  return <ControlList data={fleets} feed={feed} keyFor={(fleet) => String(fleet.id)}
    header={<View style={s.group}><ControlHeading title="The teams behind each ride" subtitle="Find a taxi service, check its owner and manage its drivers." />
      <SearchField label="Company name or city" value={search} onChange={setSearch} />
      <Choices values={['All', 'With owner', 'Without owner'] as const} selected={filter} onChange={setFilter} />
      <FeedNotice feed={feed} />{feed.hasLoaded ? <Text style={s.label}>{fleets.length} taxi services</Text> : null}</View>}
    renderItem={(fleet) => {
      const owner = feed.data.owners.find((user) => user.id === fleet.ownerId);
      return <View style={s.card}><Text style={s.cardTitle}>{fleet.companyName}</Text><Text style={s.muted}>{fleet.city}</Text>
        <Text style={s.label}>OWNER</Text><Text style={s.muted}>{fleet.ownerId == null ? 'No owner assigned' : owner?.name ?? 'Owner details unavailable'}</Text>
        {owner?.isBlocked ? <Text style={s.blocked}>Owner account blocked</Text> : null}
        <ControlButton label={`Manage ${fleet.companyName}`} tone="primary" onPress={() => router.push({ pathname: '/admin/fleets/[id]', params: { id: fleet.id } })} /></View>;
    }} empty={!feed.isLoading && !feed.error ? <EmptyCard title="No matching taxi services" message="Try a different name, city or owner filter. Companies are created on the website." /> : undefined} />;
}
