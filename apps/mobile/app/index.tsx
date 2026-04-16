import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';
import { UserRole } from '@if-fleet/domain';

export default function Index() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Redirect href="/(auth)/login" />;

  // Profile completion gate — applies to all roles
  if (!user.profileCompleted) return <Redirect href="/(auth)/complete-profile" />;

  if (user.role === UserRole.ADMIN) return <Redirect href="/(admin)" />;
  if (user.role === UserRole.DRIVER) return <Redirect href="/(driver)" />;
  return <Redirect href="/(employee)" />;
}
