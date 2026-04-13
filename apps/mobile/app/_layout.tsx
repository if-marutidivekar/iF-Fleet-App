import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
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

export default function RootLayout() {
  useEffect(() => {
    // Non-critical — Expo Go doesn't support remote push in SDK 53+
    registerForPushNotifications().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        Auth routing is handled declaratively:
        - app/index.tsx uses <Redirect> to send unauthenticated users to /(auth)/login
          and authenticated users to their role-based route.
        - Individual screens call router.replace('/(auth)/login') on logout / 401.
        - Do NOT use router.replace() in a useEffect here: it fires before expo-router's
          navigator finishes mounting, causing "navigate before Root Layout" crash.
      */}
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
