import { Stack } from 'expo-router';
import { controlColors } from '@/components/control/ControlUI';
export default function FleetsLayout() {
  return <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: controlColors.background }, headerTintColor: controlColors.ink }}>
    <Stack.Screen name="index" options={{ title: 'Fleets' }} /><Stack.Screen name="[id]" options={{ title: 'Fleet details' }} />
  </Stack>;
}
