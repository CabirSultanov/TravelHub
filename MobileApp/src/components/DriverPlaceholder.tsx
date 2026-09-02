import { StyleSheet, Text, View } from 'react-native';

export function DriverPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f5fafb', flex: 1, padding: 20 },
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 16, borderWidth: 1, gap: 10, padding: 20 },
  title: { color: '#17323b', fontSize: 22, fontWeight: '800' },
  message: { color: '#607080', fontSize: 16, lineHeight: 24 },
});
