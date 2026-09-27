import { Stack } from 'expo-router';
import { controlColors } from '@/components/control/ControlUI';
export default function RidesLayout() {
  return <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: controlColors.background }, headerTintColor: controlColors.ink }}>
    <Stack.Screen name="index" options={{ title: 'Rides' }} /><Stack.Screen name="[id]" options={{ title: 'Ride details' }} />
  </Stack>;
}
