/**
 * Offline GPS ping queue.
 * Persists unsent location pings to AsyncStorage with idempotency keys.
 * On reconnect, call flushQueue() to batch-upload them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const QUEUE_KEY = 'if-fleet-location-queue';

interface QueuedPing {
  tripId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string; // ISO string — used as idempotency key
}

export async function enqueueLocationPing(ping: QueuedPing): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueuedPing[] = raw ? (JSON.parse(raw) as QueuedPing[]) : [];
  queue.push(ping);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function flushQueue(): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;

  const queue: QueuedPing[] = JSON.parse(raw) as QueuedPing[];
  if (queue.length === 0) return;

  // Group by tripId for batch upload
  const byTrip = queue.reduce<Record<string, QueuedPing[]>>((acc, p) => {
    if (!acc[p.tripId]) acc[p.tripId] = [];
    acc[p.tripId]!.push(p);
    return acc;
  }, {});

  const errors: QueuedPing[] = [];

  for (const [tripId, pings] of Object.entries(byTrip)) {
    try {
      await api.post(`/trips/${tripId}/location/batch`, { pings });
    } catch {
      // Keep failed pings for retry
      errors.push(...pings);
    }
  }

  if (errors.length > 0) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(errors));
  } else {
    await AsyncStorage.removeItem(QUEUE_KEY);
  }
}
