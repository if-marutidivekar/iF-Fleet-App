import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Badge } from '../../components/Badge';
import { C, STATUS_COLOR, STATUS_LABEL } from '../../lib/theme';

interface Booking { id: string; status: string; transportType: string; requestedAt: string; requester: { name: string }; pickupLabel?: string; pickupCustomAddress?: string; dropoffLabel?: string; dropoffCustomAddress?: string; }
interface Trip { id: string; status: string; assignment: { booking: { pickupLabel?: string; dropoffLabel?: string }; driver: { user: { name: string } }; vehicle: { vehicleNo: string } }; actualStartAt?: string; }
interface Vehicle { id: string; status: string; vehicleNo: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const { data: bookings = [], isLoading: bl, refetch: refetchB } = useQuery<Booking[]>({
    queryKey: ['admin-bookings'],
    queryFn: () => api.get<Booking[]>('/bookings').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: trips = [], isLoading: tl, refetch: refetchT } = useQuery<Trip[]>({
    queryKey: ['admin-trips'],
    queryFn: () => api.get<Trip[]>('/trips').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['admin-vehicles'],
    queryFn: () => api.get<Vehicle[]>('/fleet/vehicles').then(r => r.data),
    refetchInterval: 60_000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-bookings'] }),
  });

  const pending = bookings.filter(b => b.status === 'PENDING_APPROVAL');
  const activeTrips = trips.filter(t => ['STARTED', 'IN_PROGRESS'].includes(t.status));
  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE');

  const isLoading = bl || tl;
  const onRefresh = () => { void refetchB(); void refetchT(); };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={C.primary} />}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerBrand}>
          <Image source={require('../../assets/logo.png')} style={s.headerLogo} resizeMode="contain" />
          <View>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.name}>{user?.name ?? 'Admin'}</Text>
          </View>
        </View>
        <View style={s.roleBadge}><Text style={s.roleText}>ADMIN</Text></View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <StatCard label="Pending" value={pending.length} color={C.warning} emoji="⏳" />
        <StatCard label="Active Trips" value={activeTrips.length} color={C.orange} emoji="🚗" />
        <StatCard label="Available" value={availableVehicles.length} color={C.success} emoji="🚙" />
      </View>

      {/* Pending bookings quick-action */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Pending Approvals</Text>
          {pending.length > 3 && (
            <TouchableOpacity onPress={() => router.push('/(admin)/book')}>
              <Text style={s.seeAll}>See all {pending.length} →</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading && <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />}

        {!isLoading && pending.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyText}>✅ No pending approvals</Text>
          </View>
        )}

        {pending.slice(0, 3).map(b => {
          const pickup = b.pickupLabel ?? b.pickupCustomAddress ?? '—';
          const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
          return (
            <View key={b.id} style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.requester}>{b.requester.name}</Text>
                <Badge label={b.transportType.replace(/_/g, ' ')} color={C.primary} />
              </View>
              <Text style={s.route}>{pickup} → {dropoff}</Text>
              <Text style={s.time}>{new Date(b.requestedAt).toLocaleString()}</Text>
              <View style={s.actionRow}>
                <TouchableOpacity style={[s.actionBtn, s.approveBtn]} onPress={() => approve.mutate(b.id)} disabled={approve.isPending}>
                  <Text style={s.actionText}>{approve.isPending ? '…' : '✓ Approve'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.rejectBtn]} onPress={() => router.push('/(admin)/book')}>
                  <Text style={s.actionText}>✗ Reject →</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Active trips quick view */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Active Trips</Text>
          {activeTrips.length > 2 && (
            <TouchableOpacity onPress={() => router.push('/(admin)/track')}>
              <Text style={s.seeAll}>See all →</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isLoading && activeTrips.length === 0 && (
          <View style={s.empty}><Text style={s.emptyText}>No active trips right now</Text></View>
        )}

        {activeTrips.slice(0, 2).map(t => (
          <View key={t.id} style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.requester}>{t.assignment.driver.user.name}</Text>
              <Badge label={t.status.replace(/_/g, ' ')} color={C.orange} />
            </View>
            <Text style={s.route}>
              {t.assignment.booking.pickupLabel ?? '—'} → {t.assignment.booking.dropoffLabel ?? '—'}
            </Text>
            <Text style={s.time}>Vehicle: {t.assignment.vehicle.vehicleNo}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={s.statEmoji}>{emoji}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header:      { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo:  { width: 32, height: 32 },
  greeting: { fontSize: 13, color: C.muted },
  name: { fontSize: 20, fontWeight: '800', color: C.text },
  roleBadge: { backgroundColor: C.purpleLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { color: C.purple, fontWeight: '800', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, margin: 16 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2 },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: '600' },
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  requester: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  route: { fontSize: 13, color: C.muted, marginBottom: 3 },
  time: { fontSize: 12, color: C.light },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approveBtn: { backgroundColor: C.success },
  rejectBtn: { backgroundColor: C.danger },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { backgroundColor: C.surface, borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { color: C.muted, fontSize: 14 },
});
