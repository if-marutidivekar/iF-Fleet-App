import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * Requests push notification permission and registers the device token
 * with the backend. Called once on app start.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    // Simulators and Expo Go on non-physical devices cannot receive push notifications.
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    // User denied push notification permission — non-fatal, in-app alerts still work.
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Register token with backend (fire-and-forget on app start)
  try {
    await api.post('/users/me/push-token', {
      pushToken: token,
      deviceType: Platform.OS,
    });
  } catch {
    // Non-critical — token will be registered on next login
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('fleet', {
      name: 'Fleet Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}
