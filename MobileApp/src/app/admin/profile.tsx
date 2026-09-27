import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { ControlButton, ControlHeading, ControlScreen, Person, s } from '@/components/control/ControlUI';

export default function ControlProfile() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  async function logout() { setBusy(true); try { await signOut(); } catch { /* Local state is cleared in AuthContext's finally. */ } finally { setBusy(false); } }
  return <ControlScreen><ControlHeading title="Your profile" subtitle="Your TravelHub management account." />
    <View style={s.card}><Person user={user} /></View>
    <View style={s.card}><Text style={s.cardTitle}>{user.role === 'SuperAdmin' ? 'SuperAdmin access' : 'Administrator access'}</Text>
      <Text style={s.muted}>Monitor rides and manage taxi service teams.{user.role === 'SuperAdmin' ? ' View all accounts and manage access for regular users and admins.' : ''}</Text></View>
    <ControlButton label={busy ? 'Logging out…' : 'Log out'} tone="danger" busy={busy} onPress={() => void logout()} />
  </ControlScreen>;
}
