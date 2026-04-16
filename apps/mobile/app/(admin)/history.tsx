import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C, STATUS_COLOR, STATUS_LABEL } from '../../lib/theme';

interface Booking {
  id: string; status: string; transportType: string; requestedAt: string;
  pickupLabel?: string; pickupCustomAddress?: string;
  dropoffLabel?: string; dropoffCustomAddress?: string;
  requester?: { name: string; email: string };
  assignment?: {
    driver?: { user: { name: string } };
    vehicle?: { vehicleNo: string };
    trip?: { odometerStart?: number; odometerEnd?: number; actualEndAt?: string };
  };
}

const DONE = ['COMPLETED', 'REJECTED', 'CANCELLED'];

export default function AdminHistory() {
  const insets = useSafeAreaInsets();

  const { data: bookings = [], isLoading, refetch } = useQuery<Booking[]>({
    queryKey: ['admin-bookings-history'],
    queryFn: () => api.get<Booking[]>('/bookings').then(r =>
      r.data.filter(b => DONE.includes(b.status))
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    ),
    refetchInterval: 60_000,
  });

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Booking History</Text>
        {bookings.length > 0 && <Text style={s.count}>{bookings.length} records</Text>}
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && bookings.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📜</Text>
          <Text style={s.emptyTitle}>No history yet</Text>
          <Text style={s.emptyText}>Completed, rejected and cancelled bookings appear here</Text>
        </View>
      )}

      <View style={s.list}>
        {bookings.map(b => {
          const pickup = b.pickupLabel ?? b.pickupCustomAddress ?? '—';
          const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
          const color = STATUS_COLOR[b.status] ?? C.muted;
          const trip = b.assignment?.trip;
          const km = trip?.odometerEnd && trip?.odometerStart ? trip.odometerEnd - trip.odometerStart : null;

          return (
            <View key={b.id} style={[s.card, b.status === 'COMPLETED' ? {} : { opacity: 0.75 }]}>
              <View style={s.cardRow}>
                <Text style={s.transport}>{b.transportType.replace(/_/g, ' ')}</Text>
                <Badge label={STATUS_LABEL[b.status] ?? b.status} color={color} />
              </View>
              {b.requester && <Text style={s.requester}>👤 {b.requester.name}</Text>}
              <Text style={s.route}>{pickup} → {dropoff}</Text>
              <Text style={s.time}>📅 {new Date(b.requestedAt).toLocaleString()}</Text>
              {b.assignment?.driver && (
                <Text style={s.meta}>🚗 {b.assignment.driver.user.name} · {b.assignment.vehicle?.vehicleNo}</Text>
              )}
              {km !== null && <Text style={s.meta}>📏 {km} km</Text>}
              {trip?.actualEndAt && (
                <Text style={s.meta}>✓ Ended {new Date(trip.actualEndAt).toLocaleDateString()}</Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  count: { fontSize: 13, color: C.muted, fontWeight: '600' },
  list: { marginHorizontal: 16 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  transport: { fontSize: 13, fontWeight: '700', color: C.text },
  requester: { fontSize: 12, color: C.primary, marginBottom: 2, fontWeight: '600' },
  route: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 4 },
  time: { fontSize: 12, color: C.light, marginBottom: 3 },
  meta: { fontSize: 12, color: C.muted, marginTop: 2 },
  empty: { marginTop: 60, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center' },
});
