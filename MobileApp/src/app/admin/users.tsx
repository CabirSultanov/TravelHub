import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { ControlButton, ControlHeading, ControlList, ControlModal, EmptyCard, FeedNotice, Person, SearchField, s } from '@/components/control/ControlUI';
import { useAuth } from '@/context/AuthContext';
import { useControlFeed } from '@/hooks/useControlFeed';
import { api } from '@/services/api';
import type { PagedResponse } from '@/types/admin';
import type { AuthUser } from '@/types/auth';
import { canBlockAccount } from '@/utils/adminControl';
import { getMobileHome } from '@/utils/mobileAccess';

const empty: PagedResponse<AuthUser> = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };

export default function Users() {
  const { user } = useAuth();
  const [query, setQuery] = useState({ search: '', page: 1 });
  const [confirm, setConfirm] = useState<{ user: AuthUser; blocked: boolean } | null>(null);
  const [success, setSuccess] = useState('');
  const feed = useControlFeed((token, signal) => api.getAdminUsers(query.search, query.page, token, signal), empty,
    { resourceKey: `users:${query.search}:${query.page}`, enabled: user?.role === 'SuperAdmin', delayMs: 300 });
  if (user?.role !== 'SuperAdmin') return <Redirect href={getMobileHome(user?.role)} />;
  const target = confirm ? feed.data.items.find((account) => account.id === confirm.user.id) : null;
  const unchanged = target?.isBlocked === confirm?.blocked;
  async function save() {
    if (!confirm || !target || !canBlockAccount(target) || unchanged || !feed.canAct) return;
    const saved = await feed.perform((token, signal) => api.setUserBlocked(target.id, confirm.blocked, token, signal));
    if (saved) { setSuccess(`${confirm.user.name}: account ${confirm.blocked ? 'blocked' : 'unblocked'}.`); setConfirm(null); }
  }
  return <>
    <ControlList data={feed.data.items} feed={feed} keyFor={(account) => String(account.id)}
      header={<View style={s.group}><ControlHeading title="People across TravelHub" subtitle="Every account, with its real role. Owner and driver assignments stay with their businesses." />
        <SearchField label="Name, email or phone" value={query.search} disabled={feed.isUpdating} onChange={(search) => { setSuccess(''); setQuery({ search, page: 1 }); }} />
        <FeedNotice feed={feed} success={success} />
        {feed.hasLoaded ? <><Text style={s.label}>{feed.data.totalItems} accounts · 20 per page · Page {feed.data.page} of {Math.max(1, feed.data.totalPages)}</Text>
          <View style={s.row}><View style={s.grow}><ControlButton label="Previous page" disabled={!feed.canAct || feed.data.page <= 1} onPress={() => setQuery({ ...query, page: feed.data.page - 1 })} /></View>
            <View style={s.grow}><ControlButton label="Next page" disabled={!feed.canAct || feed.data.page >= feed.data.totalPages} onPress={() => setQuery({ ...query, page: feed.data.page + 1 })} /></View></View></> : null}
      </View>}
      renderItem={(account) => <View style={s.card}><Person user={account} />
        {canBlockAccount(account) ? <ControlButton label={account.isBlocked ? 'Unblock account' : 'Block account'} tone={account.isBlocked ? 'secondary' : 'danger'} disabled={!feed.canAct}
          onPress={() => { setSuccess(''); setConfirm({ user: account, blocked: !account.isBlocked }); }} />
          : <Text style={s.label}>{account.role === 'SuperAdmin' ? 'Protected account' : 'Manage assignments through the business'}</Text>}
      </View>}
      empty={!feed.isLoading && !feed.error ? <EmptyCard title="No matching accounts" message="Try another name, email or phone number." /> : undefined} />
    {confirm ? <ControlModal title={confirm.blocked ? 'Block account?' : 'Unblock account?'} busy={feed.isUpdating} onClose={() => setConfirm(null)}>
      <Person user={target ?? confirm.user} /><Text style={s.muted}>{confirm.blocked ? 'This account will lose access to TravelHub.' : 'This account will be allowed to access TravelHub again.'} The role will not change.</Text>
      <FeedNotice feed={feed} />{unchanged ? <Text style={s.noticeText}>The requested account state is already shown in the latest details. You can close this form.</Text> : null}
      <ControlButton label={feed.isUpdating ? 'Saving…' : confirm.blocked ? 'Confirm block' : 'Confirm unblock'} tone={confirm.blocked ? 'danger' : 'primary'} busy={feed.isUpdating}
        disabled={!feed.canAct || !target || !canBlockAccount(target) || unchanged} onPress={() => void save()} />
    </ControlModal> : null}
  </>;
}
