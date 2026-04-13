import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C, DECISION_COLOR } from '../../lib/theme';

interface Assignment {
  id: string;
  decision: string;
  assignedAt: string;
  booking: {
    transportType: string;
    requestedAt: string;
    pickupLabel?: string; pickupCustomAddress?: string;
    dropoffLabel?: string; dropoffCustomAddress?: string;
  };
  vehicle: { vehicleNo: string };
  trip?: { id: string; status: string; actualStartAt?: string; actualEndAt?: string; odometerStart?: number; odometerEnd?: number };
}

export default function DriverHistory() {
  const insets = useSafeAreaInsets();

  const { data: assignments = [], isLoading, refetch } = useQuery<Assignment[]>({
    queryKey: ['driver-all-assignments'],
    queryFn: () => api.get<Assignment[]>('/assignments').then(r => r.data),
    refetchInterval: 60_000,
  });

  const done = assignments.filter(a => ['ACCEPTED', 'DECLINED'].includes(a.decision) && a.trip?.status === 'COMPLETED').sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  const declined = assignments.filter(a => a.decision === 'DECLINED');

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Trip History</Text>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && done.length === 0 && declined.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📜</Text>
          <Text style={s.emptyTitle}>No history yet</Text>
          <Text style={s.emptyText}>Completed trips will appear here</Text>
        </View>
      )}

      {done.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Completed Trips</Text>
          {done.map(a => {
            const pickup  = a.booking.pickupLabel  ?? a.booking.pickupCustomAddress  ?? '—';
            const dropoff = a.booking.dropoffLabel ?? a.booking.dropoffCustomAddress ?? '—';
            const km = a.trip?.odometerEnd && a.trip?.odometerStart
              ? a.trip.odometerEnd - a.trip.odometerStart
              : null;
            return (
              <View key={a.id} style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.vehicle}>🚗 {a.vehicle.vehicleNo}</Text>
                  <Badge label="COMPLETED" color={C.success} />
                </View>
                <Text style={s.route}>{pickup} → {dropoff}</Text>
                <View style={s.metaRow}>
                  {a.trip?.actualStartAt && <Text style={s.meta}>⏱ {new Date(a.trip.actualStartAt).toLocaleDateString()}</Text>}
                  {km !== null && <Text style={s.meta}>📏 {km} km</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {declined.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Declined</Text>
          {declined.map(a => {
            const pickup  = a.booking.pickupLabel  ?? a.booking.pickupCustomAddress  ?? '—';
            const dropoff = a.booking.dropoffLabel ?? a.booking.dropoffCustomAddress ?? '—';
            return (
              <View key={a.id} style={[s.card, { opacity: 0.65 }]}>
                <View style={s.cardRow}>
                  <Text style={s.vehicle}>🚗 {a.vehicle.vehicleNo}</Text>
                  <Badge label="DECLINED" color={C.danger} />
                </View>
                <Text style={s.route}>{pickup} → {dropoff}</Text>
                <Text style={s.meta}>{new Date(a.assignedAt).toLocaleDateString()}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  vehicle: { fontSize: 13, fontWeight: '600', color: C.muted },
  route: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 12 },
  meta: { fontSize: 12, color: C.light },
  empty: { marginTop: 60, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted },
});
