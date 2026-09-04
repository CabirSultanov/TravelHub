import { StyleSheet, Text, View } from 'react-native';

export function DriverPlaceholder({
  title,
  message,
  statusTitle,
  statusMessage,
}: {
  title: string;
  message: string;
  statusTitle: string;
  statusMessage: string;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>TRAVELHUB DRIVER</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusLabel}>DRIVER STATUS</Text>
        </View>
        <Text style={styles.statusTitle}>{statusTitle}</Text>
        <Text style={styles.statusMessage}>{statusMessage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#f5fafb', flex: 1, padding: 20 },
  heading: { gap: 8, marginBottom: 28, marginTop: 8 },
  eyebrow: { color: '#1f7a8c', fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: '#17323b', fontSize: 30, fontWeight: '800' },
  message: { color: '#607080', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#ffffff', borderColor: '#dbe4eb', borderRadius: 18, borderWidth: 1, gap: 10, padding: 20 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  statusDot: { backgroundColor: '#1f7a8c', borderRadius: 5, height: 10, width: 10 },
  statusLabel: { color: '#1f7a8c', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  statusTitle: { color: '#17323b', fontSize: 20, fontWeight: '800', marginTop: 4 },
  statusMessage: { color: '#607080', fontSize: 15, lineHeight: 22 },
});
