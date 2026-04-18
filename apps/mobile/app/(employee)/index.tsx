import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Badge } from '../../components/Badge';
import { C, STATUS_COLOR, STATUS_LABEL } from '../../lib/theme';

interface Booking {
  id: string;
  status: string;
  transportType: string;
  passengerCount?: number;
  materialDescription?: string;
  requestedAt: string;
  pickupLabel?: string; pickupCustomAddress?: string;
  dropoffLabel?: string; dropoffCustomAddress?: string;
  // Step 4: decision needed to show ASSIGNED-ACCEPTED vs ASSIGNED-PENDING
  assignment?: { decision?: string; driver?: { user: { name: string } }; vehicle?: { vehicleNo: string } };
}

const ACTIVE = ['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_TRIP'];

export default function EmployeeHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  const { data: bookings = [], isLoading, refetch } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: () => api.get<Booking[]>('/bookings').then(r => r.data),
    refetchInterval: 30_000,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-bookings'] }),
    // Step 3: Show backend message (e.g. "cannot cancel after trip started")
    onError: (e: any) => {
      const msg = (e as any)?.response?.data?.message ?? 'Could not cancel booking.';
      Alert.alert('Cannot Cancel', msg);
    },
  });

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: () => cancel.mutate(id) },
    ]);
  };

  const active  = bookings.filter(b => ACTIVE.includes(b.status));
  const inTrip  = bookings.filter(b => b.status === 'IN_TRIP');

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerBrand}>
          <Image source={require('../../assets/logo.png')} style={s.headerLogo} resizeMode="contain" />
          <View>
            <Text style={s.greeting}>Hello,</Text>
            <Text style={s.name}>{user?.name ?? 'Employee'}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.bookBtn} onPress={() => router.push('/(employee)/new-booking')}>
          <Text style={s.bookBtnText}>+ Book Cab</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {/* In-trip highlight */}
      {inTrip.map(b => {
        const pickup  = b.pickupLabel  ?? b.pickupCustomAddress  ?? '—';
        const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
        return (
          <View key={b.id} style={s.inTripBanner}>
            <Text style={s.inTripTitle}>🚗 You're in a trip!</Text>
            <Text style={s.inTripRoute}>{pickup} → {dropoff}</Text>
            {b.assignment?.driver && <Text style={s.inTripMeta}>Driver: {b.assignment.driver.user.name}</Text>}
            {b.assignment?.vehicle && <Text style={s.inTripMeta}>Vehicle: {b.assignment.vehicle.vehicleNo}</Text>}
          </View>
        );
      })}

      {/* Active bookings */}
      {active.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Active Bookings</Text>
          {active.map(b => <BookingCard key={b.id} booking={b} onCancel={handleCancel} cancelPending={cancel.isPending} />)}
        </View>
      )}

      {!isLoading && active.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🚕</Text>
          <Text style={s.emptyTitle}>No active bookings</Text>
          <Text style={s.emptyText}>Tap "Book Cab" to create a new request</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(employee)/new-booking')}>
            <Text style={s.emptyBtnText}>+ Book Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function BookingCard({ booking: b, onCancel, cancelPending }: {
  booking: Booking; onCancel: (id: string) => void; cancelPending: boolean;
}) {
  const pickup  = b.pickupLabel  ?? b.pickupCustomAddress  ?? '—';
  const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
  const canCancel = ['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED'].includes(b.status);

  // Step 4: Compute effective status label and color for ASSIGNED sub-states
  let effectiveLabel = STATUS_LABEL[b.status] ?? b.status.replace(/_/g, ' ');
  let effectiveColor = STATUS_COLOR[b.status] ?? C.muted;
  if (b.status === 'ASSIGNED' && b.assignment?.decision) {
    if (b.assignment.decision === 'ACCEPTED') {
      effectiveLabel = 'Assigned · Accepted';
      effectiveColor = '#059669'; // green
    } else if (b.assignment.decision === 'PENDING') {
      effectiveLabel = 'Assigned · Pending';
      effectiveColor = '#d97706'; // amber
    }
  }

  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <Text style={s.transport}>{b.transportType.replace(/_/g, ' ')}</Text>
        <Badge label={effectiveLabel} color={effectiveColor} />
      </View>
      <View style={s.routeRow}>
        <View style={s.dot} />
        <Text style={s.routeText} numberOfLines={1}>{pickup}</Text>
      </View>
      <View style={s.routeLine} />
      <View style={s.routeRow}>
        <View style={[s.dot, { backgroundColor: C.danger }]} />
        <Text style={s.routeText} numberOfLines={1}>{dropoff}</Text>
      </View>
      <Text style={s.time}>📅 {new Date(b.requestedAt).toLocaleString()}</Text>
      {b.assignment?.driver && <Text style={s.assignedInfo}>👤 {b.assignment.driver.user.name} · {b.assignment.vehicle?.vehicleNo}</Text>}
      {canCancel && (
        <TouchableOpacity style={s.cancelBtn} onPress={() => onCancel(b.id)} disabled={cancelPending}>
          <Text style={s.cancelText}>Cancel Booking</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header:      { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo:  { width: 32, height: 32 },
  greeting: { fontSize: 13, color: C.muted },
  name: { fontSize: 20, fontWeight: '800', color: C.text },
  bookBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  inTripBanner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.orange, borderRadius: 14, padding: 16 },
  inTripTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  inTripRoute: { fontSize: 13, color: '#fff', marginBottom: 3 },
  inTripMeta: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  transport: { fontSize: 13, fontWeight: '700', color: C.text },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  routeLine: { height: 16, width: 1, backgroundColor: C.border, marginLeft: 3.5, marginVertical: 2 },
  routeText: { fontSize: 13, fontWeight: '600', color: C.text, flex: 1 },
  time: { fontSize: 12, color: C.light, marginTop: 8 },
  assignedInfo: { fontSize: 12, color: C.success, fontWeight: '600', marginTop: 3 },
  cancelBtn: { marginTop: 12, borderWidth: 1, borderColor: C.danger, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  cancelText: { color: C.danger, fontWeight: '600', fontSize: 13 },
  empty: { marginTop: 40, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
