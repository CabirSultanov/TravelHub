import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { CallButton, Choices, ControlButton, ControlHeading, ControlList, ControlModal, EmptyCard, FeedNotice, Person, SearchField, s } from '@/components/control/ControlUI';
import { useControlFeed } from '@/hooks/useControlFeed';
import { api } from '@/services/api';
import type { TaxiFleet } from '@/types/admin';
import type { AuthUser } from '@/types/auth';

type FleetDetails = { fleet: TaxiFleet; owners: AuthUser[]; drivers: AuthUser[] };
type FleetForm = { kind: 'owner' } | { kind: 'driver' } | { kind: 'removeOwner' } | { kind: 'removeDriver'; user: AuthUser };
type FleetFeed = ReturnType<typeof useControlFeed<FleetDetails | null>>;

async function loadFleet(id: number, token: string, signal: AbortSignal): Promise<FleetDetails> {
  const [fleet, owners, drivers] = await Promise.all([api.getTaxiService(id, token, signal), api.getOwnerCandidates(token, signal), api.getFleetDrivers(id, token, signal)]);
  return { fleet, owners, drivers };
}

export default function FleetDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Key the local form as well as the requests: a different company never inherits a selection.
  return <FleetTeam key={id} id={Number(id)} />;
}

function FleetTeam({ id }: { id: number }) {
  const valid = Number.isSafeInteger(id) && id > 0;
  const feed = useControlFeed<FleetDetails | null>((token, signal) => loadFleet(id, token, signal), null, { resourceKey: `fleet:${id}`, enabled: valid });
  const [section, setSection] = useState<'Owner' | 'Drivers'>('Owner');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FleetForm | null>(null);
  const [success, setSuccess] = useState('');
  const detail = feed.data;
  const owner = detail?.owners.find((user) => user.id === detail.fleet.ownerId);
  const drivers = section === 'Drivers' ? (detail?.drivers ?? []).filter((user) => [user.name, user.email, user.phoneNumber].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))) : [];
  function openForm(next: FleetForm) { setSuccess(''); setForm(next); }
  return <>
    <ControlList data={drivers} feed={feed} keyFor={(user) => String(user.id)}
      header={<View style={s.group}>
        <ControlHeading title={detail?.fleet.companyName ?? 'Taxi service'} subtitle={detail?.fleet.city ?? 'Owner and driver assignments, in one place.'} />
        <FeedNotice feed={feed} success={success} />
        {!valid ? <EmptyCard title="Invalid company link" message="Return to Fleets and choose a taxi service." /> : null}
        {detail ? <>
          <CallButton name="taxi service" phone={detail.fleet.phoneNumber} />
          <Choices values={['Owner', 'Drivers'] as const} selected={section} onChange={setSection} disabled={feed.isUpdating} />
          {section === 'Owner' ? <View style={s.card}>
            <Text style={s.eyebrow}>CURRENT OWNER</Text>
            {owner ? <Person user={owner} /> : <Text style={s.cardTitle}>{detail.fleet.ownerId == null ? 'No owner assigned' : 'Owner details unavailable'}</Text>}
            {detail.fleet.ownerId != null && !owner ? <Text style={s.muted}>An owner is assigned, but their account details are not available in the current owner list.</Text> : null}
            <ControlButton label={detail.fleet.ownerId == null ? 'Assign owner' : 'Change owner'} disabled={!feed.canAct} tone="primary" onPress={() => openForm({ kind: 'owner' })} />
            {detail.fleet.ownerId != null ? <ControlButton label="Remove owner assignment" disabled={!feed.canAct} tone="danger" onPress={() => openForm({ kind: 'removeOwner' })} /> : null}
          </View> : <>
            <View style={s.row}><Text style={[s.cardTitle, s.grow]}>Current drivers</Text><Text style={s.label}>{detail.drivers.length} assigned</Text></View>
            <SearchField label="Search current team" value={search} onChange={setSearch} disabled={feed.isUpdating} />
            <ControlButton label="Add driver" disabled={!feed.canAct} tone="primary" onPress={() => openForm({ kind: 'driver' })} />
          </>}
        </> : null}
      </View>}
      renderItem={(user) => <View style={s.card}><Person user={user} /><ControlButton label={`Remove ${user.name}`} tone="danger" disabled={!feed.canAct} onPress={() => openForm({ kind: 'removeDriver', user })} /></View>}
      empty={section === 'Drivers' && feed.hasLoaded && !feed.error ? <EmptyCard title={search ? 'No matching drivers' : 'No drivers assigned'} message={search ? 'Try another name, email or phone number.' : 'Add an eligible registered user to build this team.'} /> : undefined} />
    {form && detail ? <FleetAssignment key={`${id}:${form.kind}`} form={form} feed={feed} detail={detail} onClose={() => setForm(null)} onSaved={(message) => { setSuccess(message); setForm(null); }} /> : null}
  </>;
}

function FleetAssignment({ form, feed, detail, onClose, onSaved }: { form: FleetForm; feed: FleetFeed; detail: FleetDetails; onClose: () => void; onSaved: (message: string) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuthUser | null>(null);
  const { fleet, owners, drivers } = detail;
  const adding = form.kind === 'owner' || form.kind === 'driver';
  const candidates = useControlFeed<AuthUser[]>(async (token, signal) => form.kind === 'driver'
    ? api.getDriverCandidates(fleet.id, search, token, signal)
    : owners.filter((user) => [user.name, user.email].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))), [],
  { resourceKey: `candidates:${fleet.id}:${form.kind}:${search}`, delayMs: 300, enabled: adding });
  const currentOwner = owners.find((user) => user.id === fleet.ownerId);
  const title = form.kind === 'owner' ? 'Assign owner' : form.kind === 'driver' ? 'Add driver' : form.kind === 'removeOwner' ? 'Remove owner assignment?' : 'Remove driver assignment?';
  const unchanged = form.kind === 'owner' ? selected?.id === fleet.ownerId : form.kind === 'driver' ? drivers.some((user) => user.id === selected?.id)
    : form.kind === 'removeOwner' ? fleet.ownerId == null : !drivers.some((user) => user.id === form.user.id);
  const disabled = !feed.canAct || unchanged || (adding && (!selected || !candidates.canAct));
  const label = form.kind === 'owner' ? 'Save assignment' : form.kind === 'driver' ? 'Confirm add driver' : 'Remove assignment';

  async function save() {
    if (disabled) return;
    const success = await feed.perform((token, signal) => {
      if (form.kind === 'owner' && selected) return api.assignFleetOwner(fleet.id, selected.id, token, signal);
      if (form.kind === 'driver' && selected) return api.assignFleetDriver(fleet.id, selected.id, token, signal);
      if (form.kind === 'removeOwner') return api.assignFleetOwner(fleet.id, null, token, signal);
      if (form.kind === 'removeDriver') return api.removeFleetDriver(fleet.id, form.user.id, token, signal);
      return Promise.reject(new Error('Choose a person before saving.'));
    });
    if (success) onSaved(`${label}: change saved for ${fleet.companyName}.`);
  }

  return <ControlModal title={title} busy={feed.isUpdating} onClose={onClose}>
    <View style={s.card}><Text style={s.label}>TAXI SERVICE</Text><Text style={s.cardTitle}>{fleet.companyName}</Text><Text style={s.muted}>{fleet.city}</Text></View>
    <FeedNotice feed={feed} />
    {adding ? <>
      <SearchField label="Find a registered user by name or email" value={search} disabled={feed.isUpdating} onChange={(value) => { setSearch(value); setSelected(null); }} />
      <FeedNotice feed={candidates} />
      {selected ? <View style={s.card}><Text style={s.eyebrow}>REVIEW ASSIGNMENT</Text><Person user={selected} />
        <Text style={s.muted}>{form.kind === 'owner' ? `Give ${selected.name} owner access to ${fleet.companyName}.` : `Add ${selected.name} to ${fleet.companyName} as a taxi driver.`}</Text>
        {unchanged ? <Text style={s.noticeText}>This assignment is already present in the latest details. You can close this form.</Text> : null}
        <ControlButton label={feed.isUpdating ? 'Saving…' : label} tone="primary" disabled={disabled} busy={feed.isUpdating} onPress={() => void save()} />
      </View> : <Text style={s.muted}>Choose a person, then review and confirm. Selecting a name does not save changes.</Text>}
      {!candidates.isLoading && !candidates.error ? <>
        {candidates.data.slice(0, 50).map((user) => <Pressable key={user.id} accessibilityRole="button" accessibilityLabel={`Select ${user.name}, ${user.email}`} accessibilityState={{ selected: selected?.id === user.id, disabled: feed.isUpdating }}
          disabled={feed.isUpdating} onPress={() => setSelected(user)} style={[s.card, selected?.id === user.id && { borderColor: '#1f7a8c', borderWidth: 2 }, feed.isUpdating && s.dim]}><Person user={user} /></Pressable>)}
        <Text style={s.muted}>{candidates.data.length === 0 ? 'No matching candidates. ' : ''}{form.kind === 'driver' ? 'Only unblocked regular users can be added. Drivers assigned to another company will not appear. Up to 50 candidates are returned; refine your search.' : candidates.data.length > 50 ? 'Showing the first 50 matches. Refine your search.' : 'Candidates and their real roles are provided by TravelHub. Existing assignment rules apply.'}</Text>
      </> : null}
    </> : <>
      {form.kind === 'removeDriver' ? <Person user={form.user} /> : currentOwner ? <Person user={currentOwner} /> : <Text style={s.muted}>Current owner account #{fleet.ownerId ?? '—'}</Text>}
      <Text style={s.muted}>Remove this assignment from {fleet.companyName}? The account will not be deleted.{form.kind === 'removeDriver' ? ' A driver with an active ride cannot be removed.' : ''}</Text>
      {unchanged ? <Text style={s.noticeText}>The assignment is already removed in the latest details.</Text> : null}
      <ControlButton label={feed.isUpdating ? 'Saving…' : label} tone="danger" busy={feed.isUpdating} disabled={disabled} onPress={() => void save()} />
    </>}
  </ControlModal>;
}
