import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();

  if (!user) {
    return null;
  }

  const roleLabel = user.role === 'TaxiDriver'
    ? 'Taxi driver'
    : user.role === 'SuperAdmin'
      ? 'Super admin'
      : user.role;

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your TravelHub driver account.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.roleRow}>
          <Text style={styles.roleLabel}>Account role</Text>
          <Text style={styles.role}>{roleLabel}</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f5fafb', flex: 1, padding: 20 },
  heading: { gap: 8, marginBottom: 28, marginTop: 8 },
  eyebrow: { color: '#1f7a8c', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#17323b', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#607080', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 18, borderWidth: 1, gap: 18, padding: 20 },
  identity: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: '#d9eef2', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  avatarText: { color: '#1f7a8c', fontSize: 22, fontWeight: '800' },
  identityText: { flex: 1, gap: 3 },
  name: { color: '#17323b', fontSize: 22, fontWeight: '800' },
  email: { color: '#607080', fontSize: 16 },
  divider: { backgroundColor: '#dbe4eb', height: 1 },
  roleRow: { gap: 5 },
  roleLabel: { color: '#607080', fontSize: 13, fontWeight: '700' },
  role: { color: '#1f7a8c', fontSize: 16, fontWeight: '800' },
  button: { alignItems: 'center', backgroundColor: '#b43d3d', borderRadius: 12, justifyContent: 'center', minHeight: 50 },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
