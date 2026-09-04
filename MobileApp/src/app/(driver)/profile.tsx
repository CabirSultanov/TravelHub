import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.role}>{user.role}</Text>
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f5fafb', flex: 1, padding: 20 },
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 16, borderWidth: 1, gap: 10, padding: 20 },
  name: { color: '#17323b', fontSize: 22, fontWeight: '800' },
  email: { color: '#607080', fontSize: 16 },
  role: { color: '#1f7a8c', fontSize: 14, fontWeight: '800', marginBottom: 16 },
  button: { alignItems: 'center', backgroundColor: '#b43d3d', borderRadius: 12, justifyContent: 'center', minHeight: 50 },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
