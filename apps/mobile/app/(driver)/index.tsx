import { useState } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Badge } from '../../components/Badge';
import { C, DECISION_COLOR } from '../../lib/theme';

interface MyDriverProfile {
  id: string;
  currentLocationText?: string | null;
  locationUpdatedAt?: string | null;
  currentLocationPreset?: { id: string; name: string } | null;
  assignedVehicle?: {
    id: string; vehicleNo: string; type: string; make?: string; model?: string;
    status: string;
  } | null;
}

interface Requester {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string | null;
}

interface Assignment {
  id: string;
  decision: string;
  assignedAt: string;
  declineReason?: string;
  booking: {
    id: string;
    bookingNo: number;
    transportType: string;
    passengerCount?: number;
    materialDescription?: string;
    requestedAt: string;
    pickupLabel?: string;
    pickupCustomAddress?: string;
    dropoffLabel?: string;
    dropoffCustomAddress?: string;
    // Step 5: needed to hide action buttons when requester cancelled
    status: string;
    requester: Requester;
  };
  vehicle: { vehicleNo: string; type: string };
  trip?: { id: string; status: string } | null;
}

export default function DriverHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  // Per-card inline decline state
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  // Per-card cancel acceptance state
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data: assignments = [], isLoading, refetch } = useQuery<Assignment[]>({
    queryKey: ['driver-assignments'],
    queryFn: () => api.get<Assignment[]>('/assignments').then(r => r.data),
    refetchInterval: 20_000,
  });

  const { data: myProfile } = useQuery<MyDriverProfile>({
    queryKey: ['my-driver-profile'],
    queryFn: () => api.get<MyDriverProfile>('/fleet/drivers/me').then(r => r.data),
    refetchInterval: 60_000,
    retry: false, // don't spam on error (e.g. driver profile doesn't exist yet)
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/assignments/${id}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-assignments'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to accept'),
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/assignments/${id}/decline`, { declineReason: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-assignments'] });
      setDecliningId(null);
      setDeclineReason('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to decline'),
  });

  const cancelAcceptanceMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/assignments/${id}/driver-cancel`, { cancelReason: reason || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-assignments'] });
      setCancellingId(null);
      setCancelReason('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to cancel acceptance'),
  });

  const handleDeclineSubmit = (id: string) => {
    if (!declineReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for declining');
      return;
    }
    declineMutation.mutate({ id, reason: declineReason });
  };

  // Steps 1-3: Section filters aligned with booking/trip lifecycle.
  // Backend sets decision=DECLINED when booking is cancelled, so filters below
  // are doubly-guarded for safety.

  // Awaiting driver accept/decline
  const pending = assignments.filter(
    a => a.decision === 'PENDING' && a.booking.status !== 'CANCELLED',
  );
  // Driver accepted; trip NOT yet active (ready to start)
  const approvedAssigned = assignments.filter(
    a =>
      a.decision === 'ACCEPTED' &&
      a.booking.status !== 'CANCELLED' &&
      (!a.trip || !['STARTED', 'IN_PROGRESS'].includes(a.trip.status)),
  );
  // Trip actively running (STARTED or IN_PROGRESS)
  const inProgress = assignments.filter(
    a =>
      a.decision === 'ACCEPTED' &&
      a.booking.status !== 'CANCELLED' &&
      a.trip != null &&
      ['STARTED', 'IN_PROGRESS'].includes(a.trip.status),
  );
  // Trip completed OR driver declined (excludes requester-cancelled bookings)
  const completedDeclined = assignments.filter(
    a =>
      a.booking.status === 'COMPLETED' ||
      (a.decision === 'DECLINED' && a.booking.status !== 'CANCELLED'),
  );
  // Requester-cancelled bookings — info only, no actions
  const cancelled = assignments.filter(a => a.booking.status === 'CANCELLED');

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
            <Text style={s.greeting}>Good day,</Text>
            <Text style={s.name}>{user?.name ?? 'Driver'}</Text>
          </View>
        </View>
        <View style={s.rolePill}><Text style={s.roleText}>DRIVER</Text></View>
      </View>

      {/* ── My Vehicle Banner ── */}
      {myProfile && (
        <TouchableOpacity
          style={myProfile.assignedVehicle ? s.vehicleBanner : s.vehicleBannerWarn}
          onPress={() => router.push('/(driver)/fleet')}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            {myProfile.assignedVehicle ? (
              <>
                <Text style={s.bannerLabel}>🚗 My Vehicle</Text>
                <Text style={s.bannerValue}>{myProfile.assignedVehicle.vehicleNo} · {myProfile.assignedVehicle.type.replace(/_/g, ' ')}</Text>
                <Text style={s.bannerSub}>
                  {myProfile.currentLocationPreset?.name ?? myProfile.currentLocationText ?? '⚠️ Location not set — tap to update'}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.bannerLabel}>🚙 No Vehicle Assigned</Text>
                <Text style={s.bannerSub}>Tap to view available vehicles →</Text>
              </>
            )}
          </View>
          <Text style={s.bannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {/* ── Pending Assignments — action required (Steps 1-3) ── */}
      {pending.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>⚡ Pending Assignments</Text>
          {pending.map(a => {
            const isDeclining = decliningId === a.id;
            return (
              <AssignmentCard key={a.id} assignment={a}>
                {isDeclining && (
                  <View style={s.declineBox}>
                    <Text style={s.declineLabel}>Reason for declining *</Text>
                    <TextInput
                      style={s.declineInput}
                      value={declineReason}
                      onChangeText={setDeclineReason}
                      placeholder="Reason for declining..."
                      placeholderTextColor={C.light}
                      autoFocus
                    />
                  </View>
                )}
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.btn, s.acceptBtn]}
                    onPress={() => acceptMutation.mutate(a.id)}
                    disabled={acceptMutation.isPending}
                  >
                    <Text style={s.btnText}>✓ Accept</Text>
                  </TouchableOpacity>
                  {isDeclining ? (
                    <>
                      <TouchableOpacity
                        style={[s.btn, s.declineConfirmBtn]}
                        onPress={() => handleDeclineSubmit(a.id)}
                        disabled={declineMutation.isPending}
                      >
                        <Text style={s.btnText}>{declineMutation.isPending ? '…' : 'Submit Decline'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.btn, s.cancelBtn]}
                        onPress={() => { setDecliningId(null); setDeclineReason(''); }}
                      >
                        <Text style={[s.btnText, { color: C.muted }]}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[s.btn, s.declineBtn]}
                      onPress={() => setDecliningId(a.id)}
                    >
                      <Text style={s.btnText}>✗ Decline</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </AssignmentCard>
            );
          })}
        </View>
      )}

      {/* ── Assigned — driver accepted, ready to start trip (Steps 7, 11) ── */}
      {approvedAssigned.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Assigned</Text>
          {approvedAssigned.map(a => {
            const isCancelling = cancellingId === a.id;
            return (
              <AssignmentCard key={a.id} assignment={a}>
                {isCancelling && (
                  <View style={[s.declineBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                    <Text style={[s.declineLabel, { color: C.orange }]}>Cancel your acceptance?</Text>
                    <TextInput
                      style={[s.declineInput, { borderColor: '#fed7aa' }]}
                      value={cancelReason}
                      onChangeText={setCancelReason}
                      placeholder="Reason (optional)"
                      placeholderTextColor={C.light}
                    />
                  </View>
                )}
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={[s.btn, s.tripBtn]}
                    onPress={() => router.push('/(driver)/track')}
                  >
                    <Text style={s.btnText}>▶ Start Trip</Text>
                  </TouchableOpacity>
                  {/* Cancel acceptance only while no trip exists yet */}
                  {!a.trip && (
                    isCancelling ? (
                      <>
                        <TouchableOpacity
                          style={[s.btn, { backgroundColor: C.orange, flex: 1.2 }]}
                          onPress={() => cancelAcceptanceMutation.mutate({ id: a.id, reason: cancelReason })}
                          disabled={cancelAcceptanceMutation.isPending}
                        >
                          <Text style={s.btnText}>{cancelAcceptanceMutation.isPending ? '…' : 'Confirm'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.btn, s.cancelBtn]}
                          onPress={() => { setCancellingId(null); setCancelReason(''); }}
                        >
                          <Text style={[s.btnText, { color: C.muted }]}>Keep</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={[s.btn, { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', flex: 0.9 }]}
                        onPress={() => setCancellingId(a.id)}
                      >
                        <Text style={[s.btnText, { color: C.orange }]}>✕ Cancel</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </AssignmentCard>
            );
          })}
        </View>
      )}

      {/* ── In Progress — trip actively running (Steps 2-3) ── */}
      {inProgress.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>🚗 In Progress</Text>
          {inProgress.map(a => (
            <AssignmentCard key={a.id} assignment={a}>
              <View style={s.actionRow}>
                <TouchableOpacity
                  style={[s.btn, s.tripBtn]}
                  onPress={() => router.push('/(driver)/track')}
                >
                  <Text style={s.btnText}>🚗 Continue Trip</Text>
                </TouchableOpacity>
              </View>
            </AssignmentCard>
          ))}
        </View>
      )}

      {/* ── Completed / Declined — trip done or driver declined (Steps 2-3) ── */}
      {completedDeclined.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Completed / Declined</Text>
          {completedDeclined.map(a => {
            const isCompleted = a.booking.status === 'COMPLETED';
            return (
              <View key={a.id} style={[s.card, isCompleted ? s.completedCard : s.declinedCard]}>
                <View style={s.cardTop}>
                  <View>
                    <Text style={s.vehicle}>🚗 {a.vehicle.vehicleNo} · {a.vehicle.type}</Text>
                    <Text style={s.bookingNoText}>Req #{a.booking.bookingNo}</Text>
                  </View>
                  <Badge
                    label={isCompleted ? 'Completed' : 'Declined'}
                    color={isCompleted ? C.success : C.danger}
                  />
                </View>
                <RequesterBox requester={a.booking.requester} />
                <RouteRow
                  pickup={a.booking.pickupLabel ?? a.booking.pickupCustomAddress ?? '—'}
                  dropoff={a.booking.dropoffLabel ?? a.booking.dropoffCustomAddress ?? '—'}
                />
                <Text style={s.time}>📅 {new Date(a.booking.requestedAt).toLocaleString()}</Text>
                {a.declineReason && (
                  <View style={s.reasonBox}>
                    <Text style={s.reasonText}>Reason: {a.declineReason}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Cancelled Bookings — info only, no actions ── */}
      {cancelled.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cancelled Bookings</Text>
          {cancelled.map(a => (
            <View key={a.id} style={[s.card, s.cancelledCard]}>
              <View style={s.cardTop}>
                <View>
                  <Text style={s.vehicle}>🚗 {a.vehicle.vehicleNo} · {a.vehicle.type}</Text>
                  <Text style={s.bookingNoText}>Req #{a.booking.bookingNo}</Text>
                </View>
                <Badge label="Cancelled" color="#6b7280" />
              </View>
              <RequesterBox requester={a.booking.requester} />
              <RouteRow
                pickup={a.booking.pickupLabel ?? a.booking.pickupCustomAddress ?? '—'}
                dropoff={a.booking.dropoffLabel ?? a.booking.dropoffCustomAddress ?? '—'}
              />
              <Text style={s.time}>📅 {new Date(a.booking.requestedAt).toLocaleString()}</Text>
              <View style={[s.reasonBox, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                <Text style={[s.reasonText, { color: '#64748b' }]}>
                  🚫 This booking was cancelled by the requester. No action required.
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {!isLoading &&
        pending.length === 0 &&
        approvedAssigned.length === 0 &&
        inProgress.length === 0 &&
        completedDeclined.length === 0 &&
        cancelled.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🛑</Text>
          <Text style={s.emptyTitle}>No active assignments</Text>
          <Text style={s.emptyText}>New assignments will appear here automatically</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function RequesterBox({ requester }: { requester: Requester }) {
  return (
    <View style={s.requesterBox}>
      <Text style={s.requesterTitle}>👤 Requested by</Text>
      <Text style={s.requesterName}>{requester.name}</Text>
      <Text style={s.requesterMeta}>{requester.email}</Text>
      {requester.mobileNumber ? <Text style={s.requesterMeta}>📞 {requester.mobileNumber}</Text> : null}
    </View>
  );
}

function RouteRow({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <>
      <View style={s.routeRow}>
        <View style={s.routeDot} />
        <Text style={s.routeText}>{pickup}</Text>
      </View>
      <View style={s.routeLine} />
      <View style={s.routeRow}>
        <View style={[s.routeDot, { backgroundColor: C.danger }]} />
        <Text style={s.routeText}>{dropoff}</Text>
      </View>
    </>
  );
}

function AssignmentCard({ assignment: a, children }: { assignment: Assignment; children?: React.ReactNode }) {
  const pickup  = a.booking.pickupLabel  ?? a.booking.pickupCustomAddress  ?? '—';
  const dropoff = a.booking.dropoffLabel ?? a.booking.dropoffCustomAddress ?? '—';
  const color   = DECISION_COLOR[a.decision] ?? C.muted;

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View>
          <Text style={s.vehicle}>🚗 {a.vehicle.vehicleNo} · {a.vehicle.type}</Text>
          <Text style={s.bookingNoText}>Req #{a.booking.bookingNo}</Text>
        </View>
        <Badge label={a.decision} color={color} />
      </View>

      {/* Requester info */}
      <RequesterBox requester={a.booking.requester} />

      <RouteRow pickup={pickup} dropoff={dropoff} />
      <Text style={s.time}>📅 {new Date(a.booking.requestedAt).toLocaleString()}</Text>
      {a.booking.passengerCount ? <Text style={s.meta}>👥 {a.booking.passengerCount} passenger{a.booking.passengerCount > 1 ? 's' : ''}</Text> : null}
      {a.booking.materialDescription ? <Text style={s.meta}>📦 {a.booking.materialDescription}</Text> : null}
      {a.declineReason ? (
        <View style={s.reasonBox}>
          <Text style={s.reasonText}>Reason: {a.declineReason}</Text>
        </View>
      ) : null}
      {children && <View style={{ marginTop: 12 }}>{children}</View>}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 0 },
  headerBrand:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo:   { width: 32, height: 32 },
  // Vehicle banner
  vehicleBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primaryLight, borderBottomWidth: 1, borderBottomColor: C.primary + '33', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12 },
  vehicleBannerWarn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fde68a', paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12 },
  bannerLabel:  { fontSize: 10, fontWeight: '700', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  bannerValue:  { fontSize: 14, fontWeight: '700', color: C.text },
  bannerSub:    { fontSize: 12, color: C.muted, marginTop: 2 },
  bannerArrow:  { fontSize: 24, color: C.primary, fontWeight: '300' },
  greeting:     { fontSize: 13, color: C.muted },
  name:         { fontSize: 20, fontWeight: '800', color: C.text },
  rolePill:     { backgroundColor: C.successLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleText:     { color: C.success, fontWeight: '800', fontSize: 12 },
  section:      { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  card:         { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  completedCard: { borderWidth: 1, borderColor: C.successLight },
  declinedCard:  { borderWidth: 1, borderColor: '#fecaca' },
  cancelledCard: { borderWidth: 1, borderColor: '#e2e8f0', opacity: 0.85 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  vehicle:      { fontSize: 13, fontWeight: '600', color: C.muted },
  bookingNoText:{ fontSize: 11, color: C.light, marginTop: 2 },
  requesterBox: { backgroundColor: C.primaryLight, borderRadius: 8, padding: 10, marginBottom: 10 },
  requesterTitle:{ fontSize: 11, fontWeight: '700', color: C.primary, marginBottom: 2 },
  requesterName:{ fontSize: 13, fontWeight: '700', color: C.text },
  requesterMeta:{ fontSize: 12, color: C.muted, marginTop: 2 },
  routeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  routeLine:    { height: 18, width: 1, backgroundColor: C.border, marginLeft: 3.5, marginVertical: 2 },
  routeText:    { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  time:         { fontSize: 12, color: C.light, marginTop: 8 },
  meta:         { fontSize: 12, color: C.muted, marginTop: 3 },
  reasonBox:    { backgroundColor: C.dangerLight, borderRadius: 6, padding: 8, marginTop: 8, borderWidth: 1, borderColor: '#fecaca' },
  reasonText:   { fontSize: 12, color: C.danger },
  declineBox:   { backgroundColor: C.dangerLight, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#fecaca' },
  declineLabel: { fontSize: 12, fontWeight: '700', color: C.danger, marginBottom: 6 },
  declineInput: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 6, padding: 8, fontSize: 13, color: C.text, backgroundColor: '#fff' },
  actionRow:    { flexDirection: 'row', gap: 8 },
  btn:          { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  acceptBtn:    { backgroundColor: C.success },
  declineBtn:   { backgroundColor: C.danger },
  declineConfirmBtn: { backgroundColor: C.danger, flex: 1.4 },
  cancelBtn:    { backgroundColor: C.border, flex: 0.7 },
  tripBtn:      { backgroundColor: C.primary },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 40 },
  emptyIcon:    { fontSize: 56, marginBottom: 14 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText:    { fontSize: 14, color: C.muted, textAlign: 'center' },
});
