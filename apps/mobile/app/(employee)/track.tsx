import { ScrollView, View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C, STATUS_COLOR, STATUS_LABEL } from '../../lib/theme';

interface Booking {
  id: string;
  status: string;
  transportType: string;
  requestedAt: string;
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
  assignment?: {
    vehicle?: { vehicleNo: string; type: string };
    driver?: {
      user: { name: string; mobileNumber?: string };
      currentLocationText?: string;
      currentLocationPreset?: { name: string };
    };
    trip?: { actualStartAt?: string };
  };
}

const ACTIVE = ['APPROVED', 'ASSIGNED', 'IN_TRIP'];

function statusConfig(status: string) {
  switch (status) {
    case 'APPROVED':
      return { icon: '✅', title: 'Approved', desc: 'Your booking is approved. Awaiting driver assignment.' };
    case 'ASSIGNED':
      return { icon: '👤', title: 'Driver Assigned', desc: 'A driver has been assigned. Trip will start soon.' };
    case 'IN_TRIP':
      return { icon: '🚗', title: 'In Trip', desc: 'Your trip is currently in progress.' };
    default:
      return { icon: '⏳', title: status, desc: '' };
  }
}

export default function EmployeeTrack() {
  const insets = useSafeAreaInsets();

  const { data: bookings = [], isLoading, refetch } = useQuery<Booking[]>({
    queryKey: ['my-bookings-active'],
    queryFn: () => api.get<Booking[]>('/bookings').then(r =>
      r.data.filter(b => ACTIVE.includes(b.status))
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
    ),
    refetchInterval: 15_000,
  });

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Track</Text>
        {bookings.length > 0 && <Text style={s.count}>{bookings.length} active</Text>}
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && bookings.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🗺️</Text>
          <Text style={s.emptyTitle}>No Active Bookings</Text>
          <Text style={s.emptyText}>Your approved and in-progress bookings will appear here. Book a cab from the Book tab.</Text>
        </View>
      )}

      <View style={s.list}>
        {bookings.map(b => {
          const { icon, title, desc } = statusConfig(b.status);
          const color = STATUS_COLOR[b.status] ?? C.muted;
          const pickup  = b.pickupLabel  ?? b.pickupCustomAddress  ?? '—';
          const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
          const driver = b.assignment?.driver;
          const driverLoc = driver?.currentLocationPreset?.name ?? driver?.currentLocationText ?? null;

          return (
            <View key={b.id} style={[s.card, b.status === 'IN_TRIP' && s.cardInTrip]}>
              {/* Status banner */}
              <View style={[s.statusBanner, { backgroundColor: color + '22' }]}>
                <Text style={s.statusIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.statusTitle, { color }]}>{title}</Text>
                  {desc ? <Text style={s.statusDesc}>{desc}</Text> : null}
                </View>
                <Badge label={STATUS_LABEL[b.status] ?? b.status} color={color} />
              </View>

              {/* Route */}
              <View style={s.routeRow}>
                <View style={s.routeItem}>
                  <Text style={s.routeLabel}>FROM</Text>
                  <Text style={s.routeValue}>{pickup}</Text>
                </View>
                <Text style={s.routeArrow}>→</Text>
                <View style={s.routeItem}>
                  <Text style={s.routeLabel}>TO</Text>
                  <Text style={s.routeValue}>{dropoff}</Text>
                </View>
              </View>

              <Text style={s.time}>📅 {new Date(b.requestedAt).toLocaleString()}</Text>

              {/* Driver & vehicle info */}
              {driver && (
                <View style={s.driverBox}>
                  <Text style={s.driverName}>👤 {driver.user.name}{b.assignment?.vehicle ? ` · ${b.assignment.vehicle.vehicleNo}` : ''}</Text>
                  {driver.user.mobileNumber && <Text style={s.driverPhone}>📞 {driver.user.mobileNumber}</Text>}
                  {driverLoc && (
                    <Text style={s.driverLocation}>📍 Currently at: {driverLoc}</Text>
                  )}
                  {!driverLoc && (
                    <Text style={s.driverLocationUnknown}>📍 Driver location not set yet</Text>
                  )}
                  {b.assignment?.trip?.actualStartAt && (
                    <Text style={s.tripStarted}>🕐 Trip started {new Date(b.assignment.trip.actualStartAt).toLocaleTimeString()}</Text>
                  )}
                </View>
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
  card: { backgroundColor: C.surface, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  cardInTrip: { borderWidth: 2, borderColor: C.orange },
  statusBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  statusIcon:  { fontSize: 22 },
  statusTitle: { fontSize: 14, fontWeight: '700' },
  statusDesc:  { fontSize: 12, color: C.muted, marginTop: 1 },
  routeRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 8 },
  routeItem:   { flex: 1 },
  routeLabel:  { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.5 },
  routeValue:  { fontSize: 13, fontWeight: '600', color: C.text, marginTop: 2 },
  routeArrow:  { fontSize: 16, color: C.muted },
  time:        { fontSize: 12, color: C.light, paddingHorizontal: 14, paddingBottom: 10 },
  driverBox:   { backgroundColor: C.bg, margin: 10, borderRadius: 10, padding: 12 },
  driverName:  { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 3 },
  driverPhone: { fontSize: 12, color: C.muted, marginBottom: 3 },
  driverLocation: { fontSize: 12, color: C.success, fontWeight: '600', marginBottom: 3 },
  driverLocationUnknown: { fontSize: 12, color: C.warning, marginBottom: 3 },
  tripStarted: { fontSize: 12, color: C.orange, fontWeight: '600' },
  empty: { marginTop: 80, alignItems: 'center', padding: 32 },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptyText:  { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21 },
});
