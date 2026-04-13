import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Badge } from '../../components/Badge';
import { C, DECISION_COLOR } from '../../lib/theme';

interface Assignment {
  id: string;
  decision: string;
  assignedAt: string;
  declineReason?: string;
  booking: {
    id: string;
    transportType: string;
    passengerCount?: number;
    materialDescription?: string;
    requestedAt: string;
    pickupLabel?: string;
    pickupCustomAddress?: string;
    dropoffLabel?: string;
    dropoffCustomAddress?: string;
  };
  vehicle: { vehicleNo: string; type: string };
  trip?: { id: string; status: string };
}

export default function DriverHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  const { data: assignments = [], isLoading, refetch } = useQuery<Assignment[]>({
    queryKey: ['driver-assignments'],
    queryFn: () => api.get<Assignment[]>('/assignments').then(r => r.data),
    refetchInterval: 20_000,
  });

  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/assignments/${id}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-assignments'] }),
  });

  const decline = useMutation({
    mutationFn: (id: string) =>
      api.post(`/assignments/${id}/decline`, { reason: 'Driver unavailable' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-assignments'] }),
  });

  const handleDecline = (id: string) => {
    Alert.alert('Decline Assignment', 'Are you sure you want to decline this assignment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => decline.mutate(id) },
    ]);
  };

  const pending  = assignments.filter(a => a.decision === 'PENDING');
  const accepted = assignments.filter(a => a.decision === 'ACCEPTED');

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={s.greeting}>Good day,</Text>
          <Text style={s.name}>{user?.name ?? 'Driver'}</Text>
        </View>
        <View style={s.rolePill}><Text style={s.roleText}>DRIVER</Text></View>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {/* Pending assignments — need action */}
      {pending.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>⚡ Action Required</Text>
          {pending.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              actions={
                <View style={s.actionRow}>
                  <TouchableOpacity style={[s.btn, s.acceptBtn]} onPress={() => accept.mutate(a.id)} disabled={accept.isPending}>
                    <Text style={s.btnText}>✓ Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, s.declineBtn]} onPress={() => handleDecline(a.id)} disabled={decline.isPending}>
                    <Text style={s.btnText}>✗ Decline</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ))}
        </View>
      )}

      {/* Accepted assignments — go to trip */}
      {accepted.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Accepted Assignments</Text>
          {accepted.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              actions={
                <TouchableOpacity
                  style={[s.btn, s.tripBtn]}
                  onPress={() => router.push('/(driver)/trip')}
                >
                  <Text style={s.btnText}>
                    {a.trip?.status === 'STARTED' || a.trip?.status === 'IN_PROGRESS'
                      ? '🚗 Continue Trip'
                      : '▶ Start Trip'}
                  </Text>
                </TouchableOpacity>
              }
            />
          ))}
        </View>
      )}

      {!isLoading && pending.length === 0 && accepted.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🛑</Text>
          <Text style={s.emptyTitle}>No active assignments</Text>
          <Text style={s.emptyText}>New assignments will appear here automatically</Text>
        </View>
      )}
    </ScrollView>
  );
}

function AssignmentCard({ assignment: a, actions }: { assignment: Assignment; actions?: React.ReactNode }) {
  const pickup  = a.booking.pickupLabel  ?? a.booking.pickupCustomAddress  ?? '—';
  const dropoff = a.booking.dropoffLabel ?? a.booking.dropoffCustomAddress ?? '—';
  const color   = DECISION_COLOR[a.decision] ?? C.muted;

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <Text style={s.vehicle}>🚗 {a.vehicle.vehicleNo} · {a.vehicle.type}</Text>
        <Badge label={a.decision} color={color} />
      </View>
      <View style={s.routeRow}>
        <View style={s.routeDot} />
        <Text style={s.routeText}>{pickup}</Text>
      </View>
      <View style={s.routeLine} />
      <View style={s.routeRow}>
        <View style={[s.routeDot, { backgroundColor: C.danger }]} />
        <Text style={s.routeText}>{dropoff}</Text>
      </View>
      <Text style={s.time}>📅 {new Date(a.booking.requestedAt).toLocaleString()}</Text>
      {a.booking.passengerCount ? <Text style={s.meta}>👥 {a.booking.passengerCount} passengers</Text> : null}
      {a.booking.materialDescription ? <Text style={s.meta}>📦 {a.booking.materialDescription}</Text> : null}
      {actions && <View style={{ marginTop: 12 }}>{actions}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  greeting: { fontSize: 13, color: C.muted },
  name: { fontSize: 20, fontWeight: '800', color: C.text },
  rolePill: { backgroundColor: C.successLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: C.success, fontWeight: '800', fontSize: 12 },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  vehicle: { fontSize: 13, fontWeight: '600', color: C.muted },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  routeLine: { height: 18, width: 1, backgroundColor: C.border, marginLeft: 3.5, marginVertical: 2 },
  routeText: { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  time: { fontSize: 12, color: C.light, marginTop: 8 },
  meta: { fontSize: 12, color: C.muted, marginTop: 3 },
  actionRow: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  acceptBtn: { backgroundColor: C.success },
  declineBtn: { backgroundColor: C.danger },
  tripBtn: { backgroundColor: C.primary },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center' },
});
