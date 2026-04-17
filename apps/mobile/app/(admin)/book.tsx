import { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C, STATUS_COLOR, STATUS_LABEL } from '../../lib/theme';

interface Booking {
  id: string;
  status: string;
  transportType: string;
  passengerCount?: number;
  materialDescription?: string;
  requestedAt: string;
  requester: { name: string; employeeId: string };
  pickupLabel?: string;
  pickupCustomAddress?: string;
  pickupPresetId?: string | null;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
  assignment?: { id: string; vehicle: { vehicleNo: string }; driver: { user: { name: string } }; decision: string } | null;
}

// Step 37: Extended vehicle type from for-assignment endpoint
interface Vehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string;
  model?: string;
  capacity: number;
  status: string;
  currentLocationText?: string | null;
  currentLocationPreset?: { id: string; name: string } | null;
}
interface DriverProfile { id: string; licenseNumber: string; shiftReady: boolean; user: { name: string; employeeId: string }; }

const TABS = [
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
];

export default function BookingQueueScreen() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'PENDING_APPROVAL' | 'APPROVED'>('PENDING_APPROVAL');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assignId, setAssignId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');

  const { data: allBookings = [], isLoading, refetch } = useQuery<Booking[]>({
    queryKey: ['admin-bookings-queue'],
    queryFn: () => api.get<Booking[]>('/bookings').then(r => r.data),
    refetchInterval: 20_000,
  });

  // Step 37: Fetch vehicles valid for assignment — AVAILABLE + non-conflicting ASSIGNED,
  // filtered by the booking's pickup preset when an assign panel is open.
  const assigningBooking = allBookings.find(b => b.id === assignId);
  const assigningPickupPresetId = assigningBooking?.pickupPresetId ?? undefined;
  const { data: assignableVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['admin-vehicles-for-assignment', assigningPickupPresetId ?? 'none'],
    queryFn: () => {
      const params = assigningPickupPresetId ? `?pickupPresetId=${assigningPickupPresetId}` : '';
      return api.get<Vehicle[]>(`/fleet/vehicles/for-assignment${params}`).then(r => r.data);
    },
    enabled: activeTab === 'APPROVED' && assignId !== null,
    staleTime: 15_000,
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ['admin-drivers'],
    queryFn: () => api.get<DriverProfile[]>('/fleet/drivers').then(r => r.data),
    enabled: activeTab === 'APPROVED',
    staleTime: 30_000,
  });

  const pending  = allBookings.filter(b => b.status === 'PENDING_APPROVAL');
  const approved = allBookings.filter(b => b.status === 'APPROVED');
  const bookings = activeTab === 'PENDING_APPROVAL' ? pending : approved;

  const shiftReadyDrivers = drivers.filter(d => d.shiftReady);

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/approve`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-bookings-queue'] });
      void qc.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      api.patch(`/bookings/${id}/reject`, { rejectionReason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-bookings-queue'] });
      void qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      setRejectId(null);
      setRejectReason('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to reject'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-bookings-queue'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to cancel'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ bookingId, vehicleId, driverId }: { bookingId: string; vehicleId: string; driverId: string }) =>
      api.post('/assignments', { bookingId, vehicleId, driverId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-bookings-queue'] });
      void qc.invalidateQueries({ queryKey: ['admin-bookings'] });
      setAssignId(null);
      setSelectedVehicle('');
      setSelectedDriver('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Assignment failed. Try again.'),
  });

  const handleConfirmReject = (id: string) => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please enter a rejection reason');
      return;
    }
    rejectMutation.mutate({ id, rejectionReason: rejectReason });
  };

  const handleConfirmAssign = (bookingId: string) => {
    if (!selectedVehicle || !selectedDriver) {
      Alert.alert('Required', 'Please select both a vehicle and a driver');
      return;
    }
    assignMutation.mutate({ bookingId, vehicleId: selectedVehicle, driverId: selectedDriver });
  };

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: () => cancelMutation.mutate(id) },
    ]);
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Booking Queue</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{pending.length} pending · {approved.length} approved</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[s.tabBtn, activeTab === t.value && s.tabActive]}
            onPress={() => { setActiveTab(t.value as typeof activeTab); setRejectId(null); setAssignId(null); }}
          >
            <Text style={[s.tabText, activeTab === t.value && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && bookings.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>{activeTab === 'PENDING_APPROVAL' ? '✅' : '📋'}</Text>
          <Text style={s.emptyTitle}>
            {activeTab === 'PENDING_APPROVAL' ? 'Queue is clear' : 'No approved bookings'}
          </Text>
          <Text style={s.emptyText}>
            {activeTab === 'PENDING_APPROVAL' ? 'No pending booking requests' : 'Approve pending bookings first'}
          </Text>
        </View>
      )}

      {bookings.map(b => {
        const pickup = b.pickupLabel ?? b.pickupCustomAddress ?? '—';
        const dropoff = b.dropoffLabel ?? b.dropoffCustomAddress ?? '—';
        const isRejectOpen = rejectId === b.id;
        const isAssignOpen = assignId === b.id;
        const statusColor = STATUS_COLOR[b.status] ?? C.muted;

        return (
          <View key={b.id} style={s.card}>
            {/* Header row */}
            <View style={s.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.requester}>{b.requester.name}</Text>
                <Text style={s.empId}>#{b.requester.employeeId}</Text>
              </View>
              <Badge label={STATUS_LABEL[b.status] ?? b.status} color={statusColor} />
            </View>

            <View style={s.divider} />

            {/* Transport badge */}
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>🚌 Type</Text>
              <Text style={s.infoValue}>{b.transportType.replace(/_/g, ' ')}</Text>
            </View>
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
                <Text style={s.infoValue}>{b.passengerCount} passenger{b.passengerCount > 1 ? 's' : ''}</Text>
              </View>
            ) : null}
            {b.materialDescription ? (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>📦 Material</Text>
                <Text style={s.infoValue}>{b.materialDescription}</Text>
              </View>
            ) : null}
            {b.assignment && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>🚗 Assigned</Text>
                <Text style={s.infoValue}>{b.assignment.vehicle.vehicleNo} · {b.assignment.driver.user.name}</Text>
              </View>
            )}

            {/* ── PENDING_APPROVAL actions ── */}
            {activeTab === 'PENDING_APPROVAL' && (
              <>
                {isRejectOpen && (
                  <View style={s.rejectBox}>
                    <Text style={s.rejectLabel}>Rejection reason *</Text>
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
                    onPress={() => approveMutation.mutate(b.id)}
                    disabled={approveMutation.isPending}
                  >
                    <Text style={s.btnText}>{approveMutation.isPending ? '…' : '✓ Approve'}</Text>
                  </TouchableOpacity>
                  {isRejectOpen ? (
                    <>
                      <TouchableOpacity
                        style={[s.btn, s.rejectConfirmBtn]}
                        onPress={() => handleConfirmReject(b.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <Text style={s.btnText}>{rejectMutation.isPending ? '…' : 'Confirm'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btn, s.cancelBtn]}
                        onPress={() => { setRejectId(null); setRejectReason(''); }}
                      >
                        <Text style={[s.btnText, { color: C.muted }]}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={[s.btn, s.rejectBtn]} onPress={() => setRejectId(b.id)}>
                      <Text style={s.btnText}>✗ Reject</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* ── APPROVED actions ── */}
            {activeTab === 'APPROVED' && !b.assignment && (
              <>
                {isAssignOpen && (
                  <View style={s.assignBox}>
                    <Text style={s.assignLabel}>Assign vehicle & driver</Text>

                    <Text style={s.fieldLabel}>Vehicle</Text>
                    {assignableVehicles.length === 0 ? (
                      <Text style={s.noOptions}>No vehicles available at this pickup location</Text>
                    ) : (
                      assignableVehicles.map(v => {
                        const loc = v.currentLocationPreset?.name ?? v.currentLocationText;
                        return (
                          <TouchableOpacity
                            key={v.id}
                            style={[s.optionRow, selectedVehicle === v.id && s.optionSelected]}
                            onPress={() => setSelectedVehicle(v.id)}
                          >
                            <Text style={[s.optionText, selectedVehicle === v.id && { color: C.primary }]}>
                              {v.vehicleNo} — {v.type}{v.make ? ` ${v.make}` : ''} (cap: {v.capacity})
                            </Text>
                            {loc ? <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>📍 {loc}</Text> : null}
                          </TouchableOpacity>
                        );
                      })
                    )}

                    <Text style={[s.fieldLabel, { marginTop: 10 }]}>Driver</Text>
                    {shiftReadyDrivers.length === 0 ? (
                      <Text style={s.noOptions}>No shift-ready drivers</Text>
                    ) : (
                      shiftReadyDrivers.map(d => (
                        <TouchableOpacity
                          key={d.id}
                          style={[s.optionRow, selectedDriver === d.id && s.optionSelected]}
                          onPress={() => setSelectedDriver(d.id)}
                        >
                          <Text style={[s.optionText, selectedDriver === d.id && { color: C.primary }]}>
                            {d.user.name} (#{d.user.employeeId})
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}

                <View style={s.actionRow}>
                  {isAssignOpen ? (
                    <>
                      <TouchableOpacity
                        style={[s.btn, s.assignBtn]}
                        onPress={() => handleConfirmAssign(b.id)}
                        disabled={assignMutation.isPending || !selectedVehicle || !selectedDriver}
                      >
                        <Text style={s.btnText}>{assignMutation.isPending ? '…' : 'Submit'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btn, s.cancelBtn]}
                        onPress={() => { setAssignId(null); setSelectedVehicle(''); setSelectedDriver(''); }}
                      >
                        <Text style={[s.btnText, { color: C.muted }]}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity style={[s.btn, s.assignBtn]} onPress={() => setAssignId(b.id)}>
                        <Text style={s.btnText}>Assign →</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.btn, s.rejectBtn]} onPress={() => handleCancel(b.id)} disabled={cancelMutation.isPending}>
                        <Text style={s.btnText}>✕ Cancel</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 0 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  countBadge: { backgroundColor: C.warningLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: C.warning, fontWeight: '700', fontSize: 11 },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTextActive: { color: C.primary },
  card: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  requester: { fontSize: 15, fontWeight: '700', color: C.text },
  empId: { fontSize: 12, color: C.muted, marginTop: 1 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 10 },
  infoRow: { flexDirection: 'row', marginBottom: 5 },
  infoLabel: { fontSize: 12, color: C.muted, width: 80, fontWeight: '600' },
  infoValue: { fontSize: 12, color: C.text, flex: 1 },
  // Reject
  rejectBox: { backgroundColor: C.dangerLight, borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  rejectLabel: { fontSize: 12, fontWeight: '700', color: C.danger, marginBottom: 6 },
  rejectInput: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: 8, fontSize: 13, color: C.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: '#fff' },
  // Assign
  assignBox: { backgroundColor: C.primaryLight, borderRadius: 8, padding: 12, marginTop: 10, borderWidth: 1, borderColor: C.primary + '44' },
  assignLabel: { fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  optionRow: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  optionSelected: { borderColor: C.primary, backgroundColor: C.primaryLight },
  optionText: { fontSize: 13, color: C.text },
  noOptions: { fontSize: 13, color: C.light, fontStyle: 'italic', marginBottom: 4 },
  // Buttons
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  approveBtn: { backgroundColor: C.success },
  rejectBtn: { backgroundColor: C.danger },
  assignBtn: { backgroundColor: C.purple },
  rejectConfirmBtn: { backgroundColor: C.danger, flex: 1.5 },
  cancelBtn: { backgroundColor: C.border, flex: 0.8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { marginTop: 60, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center' },
});
