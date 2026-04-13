import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/auth.store';
import { registerForPushNotifications } from '../lib/notifications';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 2 } },
});

// expo-notifications 0.29+ requires shouldShowBanner + shouldShowList
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,      // legacy iOS compat
    shouldShowBanner: true,     // iOS 14+ foreground banner
    shouldShowList: true,       // iOS 14+ notification centre
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AuthGuard() {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, segments]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    // Non-critical — Expo Go doesn't support remote push in SDK 53+
    registerForPushNotifications().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
      {/* expo-router 6.x auto-discovers all file-system routes.
          Do NOT declare Stack.Screen for group folders ("(auth)") —
          use the full leaf path ("(auth)/login") or let the router
          handle them automatically via screenOptions. */}
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
