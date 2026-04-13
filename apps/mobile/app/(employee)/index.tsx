import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

interface Booking {
  id: string;
  transportType: string;
  status: string;
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
  requestedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: '#d97706',
  APPROVED: '#2563eb',
  ASSIGNED: '#7c3aed',
  IN_TRIP: '#f97316',
  COMPLETED: '#059669',
  REJECTED: '#dc2626',
  CANCELLED: '#6b7280',
};

export default function EmployeeDashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<Booking[]>('/bookings').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-bookings'] }),
  });

  const handleLogout = () => {
    clearAuth();
    router.replace('/(auth)/login');
  };

  const active = bookings.filter((b) =>
    ['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_TRIP'].includes(b.status),
  );
  const history = bookings.filter((b) =>
    ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status),
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>My Bookings</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator style={{ marginTop: 40 }} color="#2563eb" />}

      {!isLoading && bookings.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No bookings yet.</Text>
          <Text style={styles.emptyHint}>
            Use the web app to create a new booking request.
          </Text>
        </View>
      )}

      {active.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active</Text>
          {active.map((b) => {
            const pickup = b.pickupLabel ?? b.pickupCustomAddress ?? '—';
            const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
            const color = STATUS_COLORS[b.status] ?? '#64748b';
            const canCancel = ['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED'].includes(b.status);
            return (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.transport}>{b.transportType}</Text>
                  <View style={[styles.badge, { backgroundColor: color + '1a', borderColor: color + '44' }]}>
                    <Text style={[styles.badgeText, { color }]}>
                      {b.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.route}>{pickup} → {dropoff}</Text>
                <Text style={styles.time}>{new Date(b.requestedAt).toLocaleString()}</Text>
                {canCancel && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => cancelMutation.mutate(b.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <Text style={styles.cancelText}>Cancel Booking</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}

      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>History</Text>
          {history.slice(0, 5).map((b) => {
            const pickup = b.pickupLabel ?? b.pickupCustomAddress ?? '—';
            const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
            const color = STATUS_COLORS[b.status] ?? '#64748b';
            return (
              <View key={b.id} style={[styles.card, { opacity: 0.75 }]}>
                <View style={styles.cardRow}>
                  <Text style={styles.transport}>{b.transportType}</Text>
                  <View style={[styles.badge, { backgroundColor: color + '1a', borderColor: color + '44' }]}>
                    <Text style={[styles.badgeText, { color }]}>
                      {b.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.route}>{pickup} → {dropoff}</Text>
                <Text style={styles.time}>{new Date(b.requestedAt).toLocaleString()}</Text>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  logout: { fontSize: 14, color: '#dc2626', fontWeight: '600' },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 8,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  transport: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  route: { fontSize: 13, color: '#475569', marginBottom: 4 },
  time: { fontSize: 12, color: '#94a3b8' },
  cancelBtn: {
    marginTop: 10, borderWidth: 1, borderColor: '#dc2626',
    borderRadius: 7, padding: 8, alignItems: 'center',
  },
  cancelText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});
