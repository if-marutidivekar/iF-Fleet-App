import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C, TRIP_STATUS_COLOR, TRIP_STATUS_LABEL } from '../../lib/theme';

interface Trip {
  id: string;
  status: string;
  actualStartAt?: string;
  odometerStart?: number;
  assignment: {
    booking: { pickupLabel?: string; pickupCustomAddress?: string; dropoffLabel?: string; dropoffCustomAddress?: string; requestedAt: string };
    driver: { user: { name: string } };
    vehicle: { vehicleNo: string; type: string };
  };
}

export default function LiveTripsScreen() {
  const insets = useSafeAreaInsets();

  const { data: trips = [], isLoading, refetch } = useQuery<Trip[]>({
    queryKey: ['admin-live-trips'],
    queryFn: () => api.get<Trip[]>('/trips').then(r => r.data),
    refetchInterval: 15_000,
  });

  const active = trips.filter(t => ['STARTED', 'IN_PROGRESS', 'CREATED'].includes(t.status));
  const recent = trips.filter(t => ['COMPLETED', 'EXCEPTION', 'CANCELLED'].includes(t.status)).slice(0, 5);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Live Trips</Text>
        {active.length > 0 && (
          <View style={s.liveDot}>
            <View style={s.dot} />
            <Text style={s.liveText}>{active.length} active</Text>
          </View>
        )}
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && active.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🚦</Text>
          <Text style={s.emptyTitle}>No active trips</Text>
          <Text style={s.emptyText}>Trips will appear here once started</Text>
        </View>
      )}

      {active.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>In Progress</Text>
          {active.map(t => <TripCard key={t.id} trip={t} />)}
        </View>
      )}

      {recent.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recently Completed</Text>
          {recent.map(t => <TripCard key={t.id} trip={t} dimmed />)}
        </View>
      )}
    </ScrollView>
  );
}

function TripCard({ trip: t, dimmed = false }: { trip: Trip; dimmed?: boolean }) {
  const color = TRIP_STATUS_COLOR[t.status] ?? C.muted;
  const pickup = t.assignment.booking.pickupLabel ?? t.assignment.booking.pickupCustomAddress ?? '—';
  const dropoff = t.assignment.booking.dropoffLabel ?? t.assignment.booking.dropoffCustomAddress ?? '—';
  return (
    <View style={[s.card, dimmed && { opacity: 0.65 }]}>
      <View style={s.cardRow}>
        <Text style={s.driver}>{t.assignment.driver.user.name}</Text>
        <Badge label={TRIP_STATUS_LABEL[t.status] ?? t.status.replace(/_/g, ' ')} color={color} />
      </View>
      <Text style={s.route}>{pickup} → {dropoff}</Text>
      <View style={s.metaRow}>
        <Text style={s.meta}>🚗 {t.assignment.vehicle.vehicleNo}</Text>
        {t.actualStartAt && (
          <Text style={s.meta}>⏱ {new Date(t.actualStartAt).toLocaleTimeString()}</Text>
        )}
        {t.odometerStart && (
          <Text style={s.meta}>📏 {t.odometerStart} km</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.successLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  liveText: { fontSize: 12, fontWeight: '700', color: C.success },
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  driver: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  route: { fontSize: 13, color: C.muted, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: C.light },
  empty: { marginTop: 60, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted },
});
