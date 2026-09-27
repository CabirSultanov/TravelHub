import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { getMobileHome } from '@/utils/mobileAccess';

export default function IndexScreen() {
  const { user } = useAuth();

  return <Redirect href={getMobileHome(user?.role)} />;
}
