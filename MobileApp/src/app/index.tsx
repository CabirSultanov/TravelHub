import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function IndexScreen() {
  const { user } = useAuth();

  return <Redirect href={user ? '/(driver)/available' : '/login'} />;
}
