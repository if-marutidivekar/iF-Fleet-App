import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C } from '../../lib/theme';

interface Booking {
  id: string;
  bookingNo: number;
  transportType: string;
  passengerCount?: number;
  materialDescription?: string;
  requestedAt: string;
  status: string;
  requester: { name: string; employeeId: string };
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
}

export default function QueueScreen() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: bookings = [], isLoading, refetch } = useQuery<Booking[]>({
    queryKey: ['admin-bookings-queue'],
    queryFn: () =>
      api.get<Booking[]>('/bookings').then(r =>
        r.data.filter(b => b.status === 'PENDING_APPROVAL')
      ),
    refetchInterval: 20_000,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/approve`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-bookings-queue'] });
      void qc.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/bookings/${id}/reject`, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-bookings-queue'] });
      void qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      setRejectId(null);
      setRejectReason('');
    },
  });

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Booking Queue</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{bookings.length} pending</Text>
        </View>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && bookings.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>✅</Text>
          <Text style={s.emptyTitle}>Queue is clear</Text>
          <Text style={s.emptyText}>No pending booking requests</Text>
        </View>
      )}

      {bookings.map(b => {
        const pickup = b.pickupLabel ?? b.pickupCustomAddress ?? '—';
        const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
        const isRejectOpen = rejectId === b.id;

        return (
          <View key={b.id} style={s.card}>
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.requester}>{b.requester.name}</Text>
                <Text style={s.empId}>{b.requester.employeeId}</Text>
                <Text style={s.bookingNo}>Req #{b.bookingNo}</Text>
              </View>
              <Badge label={b.transportType.replace(/_/g, ' ')} color={C.primary} />
            </View>

            <View style={s.divider} />

            <View style={s.infoRow}>
              <Text style={s.infoLabel}>📍 Pickup</Text>
              <Text style={s.infoValue}>{pickup}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>🏁 Drop</Text>
              <Text style={s.infoValue}>{dropoff}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>🕐 Time</Text>
              <Text style={s.infoValue}>{new Date(b.requestedAt).toLocaleString()}</Text>
            </View>
            {b.passengerCount ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>👥 Pax</Text>
                <Text style={s.infoValue}>{b.passengerCount}</Text>
              </View>
            ) : null}
            {b.materialDescription ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>📦 Material</Text>
                <Text style={s.infoValue}>{b.materialDescription}</Text>
              </View>
            ) : null}

            {/* Reject reason input */}
            {isRejectOpen && (
              <View style={s.rejectBox}>
                <Text style={s.rejectLabel}>Rejection reason</Text>
                <TextInput
                  style={s.rejectInput}
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Enter reason..."
                  placeholderTextColor={C.light}
                  multiline
                />
              </View>
            )}

            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.btn, s.approveBtn]}
                onPress={() => approve.mutate(b.id)}
                disabled={approve.isPending}
              >
                <Text style={s.btnText}>{approve.isPending ? '…' : '✓ Approve'}</Text>
              </TouchableOpacity>

              {isRejectOpen ? (
                <>
                  <TouchableOpacity
                    style={[s.btn, s.rejectConfirmBtn]}
                    onPress={() => reject.mutate({ id: b.id, reason: rejectReason || 'Rejected by admin' })}
                    disabled={reject.isPending}
                  >
                    <Text style={s.btnText}>{reject.isPending ? '…' : 'Confirm'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, s.cancelBtn]}
                    onPress={() => { setRejectId(null); setRejectReason(''); }}
                  >
                    <Text style={[s.btnText, { color: C.muted }]}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[s.btn, s.rejectBtn]}
                  onPress={() => setRejectId(b.id)}
                >
                  <Text style={s.btnText}>✗ Reject</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  countBadge: { backgroundColor: C.warningLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: C.warning, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  requester: { fontSize: 15, fontWeight: '700', color: C.text },
  empId: { fontSize: 12, color: C.muted, marginTop: 1 },
  bookingNo: { fontSize: 11, color: C.light, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 10 },
  infoRow: { flexDirection: 'row', marginBottom: 5 },
  infoLabel: { fontSize: 12, color: C.muted, width: 72, fontWeight: '600' },
  infoValue: { fontSize: 12, color: C.text, flex: 1 },
  rejectBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 10 },
  rejectLabel: { fontSize: 12, fontWeight: '600', color: C.danger, marginBottom: 6 },
  rejectInput: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: 8, fontSize: 13, color: C.text, minHeight: 60, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  approveBtn: { backgroundColor: C.success },
  rejectBtn: { backgroundColor: C.danger },
  rejectConfirmBtn: { backgroundColor: C.danger, flex: 1.5 },
  cancelBtn: { backgroundColor: C.border, flex: 0.8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { marginTop: 60, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted },
});
