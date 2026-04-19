import { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C, TRIP_STATUS_COLOR } from '../../lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Requester {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string | null;
}

interface BookingInfo {
  id: string;
  transportType: string;
  passengerCount?: number;
  materialDescription?: string;
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
  requestedAt: string;
  status: string;
  requester: Requester;
}

interface ActiveAssignment {
  id: string;
  decision: string;
  assignedAt: string;
  booking: BookingInfo;
  vehicle: { vehicleNo: string; type: string; make?: string };
  trip?: { id: string; status: string } | null;
}

interface ActiveTrip {
  id: string;
  status: string;
  odometerStart?: number;
  odometerEnd?: number;
  actualStartAt?: string;
  actualEndAt?: string;
  remarks?: string;
  assignmentId: string;
  assignment: {
    id: string;
    booking: BookingInfo;
    vehicle: { vehicleNo: string; type: string; make?: string };
    driver: { user: { name: string } };
  };
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ActiveTripScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [odometerStart, setOdometerStart] = useState('');
  const [odometerEnd, setOdometerEnd] = useState('');
  const [remarks, setRemarks] = useState('');
  const [fuelVolume, setFuelVolume] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [showFuelForm, setShowFuelForm] = useState(false);

  // Fetch accepted assignments (to detect "ready to start" state)
  const { data: assignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useQuery<ActiveAssignment[]>({
    queryKey: ['driver-assignments'],
    queryFn: () => api.get<ActiveAssignment[]>('/assignments').then(r => r.data),
    refetchInterval: 20_000,
  });

  // Fetch trips (active + completed)
  const { data: trips = [], isLoading: tripsLoading, refetch: refetchTrips } = useQuery<ActiveTrip[]>({
    queryKey: ['driver-trips'],
    queryFn: () => api.get<ActiveTrip[]>('/trips').then(r => r.data),
    refetchInterval: 20_000,
  });

  const isLoading = assignmentsLoading || tripsLoading;

  const refetch = () => {
    void refetchAssignments();
    void refetchTrips();
  };

  // Find accepted assignment that hasn't had a trip started yet.
  // Steps 4-5: require booking.status === 'ASSIGNED' so completed/historical
  // bookings never appear here as "ready to start".
  const readyToStart = assignments.find(
    a =>
      a.booking.status === 'ASSIGNED' &&
      a.decision === 'ACCEPTED' &&
      (!a.trip || a.trip.status === 'CREATED'),
  );

  // Active trip: STARTED or IN_PROGRESS
  const activeTrip = trips.find(t => ['STARTED', 'IN_PROGRESS'].includes(t.status));

  // ── Mutations ──────────────────────────────────────────────────────────────

  const startTrip = useMutation({
    mutationFn: ({ assignmentId, odometer }: { assignmentId: string; odometer?: number }) =>
      api.post(`/trips/${assignmentId}/start`, {
        ...(odometer !== undefined ? { odometerStart: odometer } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['driver-trips'] });
      void qc.invalidateQueries({ queryKey: ['driver-assignments'] });
      setOdometerStart('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Could not start trip. Please try again.'),
  });

  const completeTrip = useMutation({
    mutationFn: ({ id, odometer, note }: { id: string; odometer?: number; note: string }) =>
      api.post(`/trips/${id}/complete`, {
        ...(odometer !== undefined ? { odometerEnd: odometer } : {}),
        remarks: note,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['driver-trips'] });
      void qc.invalidateQueries({ queryKey: ['driver-assignments'] });
      setOdometerEnd('');
      setRemarks('');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Could not complete trip. Please try again.'),
  });

  const addFuel = useMutation({
    mutationFn: (payload: object) => api.post(`/trips/${activeTrip!.id}/fuel`, payload),
    onSuccess: () => {
      setShowFuelForm(false);
      setFuelVolume('');
      setFuelCost('');
      setFuelOdometer('');
      qc.invalidateQueries({ queryKey: ['driver-trips'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Could not log fuel. Please try again.'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStart = () => {
    if (!readyToStart) return;
    // Validate only if a value was entered — odometer is optional
    if (odometerStart && isNaN(Number(odometerStart))) {
      Alert.alert('Invalid', 'Odometer Reading must be a valid number.');
      return;
    }
    const odo = odometerStart.trim() !== '' && !isNaN(Number(odometerStart))
      ? Number(odometerStart)
      : undefined;
    const msg = odo !== undefined
      ? `Starting trip — odometer at ${odo} km. Confirm?`
      : 'Starting trip (no odometer reading entered). Confirm?';
    Alert.alert('Start Trip', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start',
        onPress: () => startTrip.mutate({ assignmentId: readyToStart.id, odometer: odo }),
      },
    ]);
  };

  const handleComplete = () => {
    if (!activeTrip) return;
    // Validate only if a value was entered — odometer is optional
    if (odometerEnd && isNaN(Number(odometerEnd))) {
      Alert.alert('Invalid', 'Odometer Reading must be a valid number.');
      return;
    }
    const odo = odometerEnd.trim() !== '' && !isNaN(Number(odometerEnd))
      ? Number(odometerEnd)
      : undefined;
    Alert.alert('Complete Trip', 'Mark this trip as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => completeTrip.mutate({ id: activeTrip.id, odometer: odo, note: remarks }) },
    ]);
  };

  const handleFuelLog = () => {
    if (!fuelVolume || !fuelOdometer) {
      Alert.alert('Required', 'Enter fuel volume and odometer reading.');
      return;
    }
    addFuel.mutate({
      fuelVolume: Number(fuelVolume),
      fuelCost: fuelCost ? Number(fuelCost) : undefined,
      odometerAtRefuel: Number(fuelOdometer),
      recordedAt: new Date().toISOString(),
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  // Steps 4-5: Show empty state when no active/current trip — do NOT factor in
  // completed trips here; historical trips belong in History, not Track.
  if (!readyToStart && !activeTrip) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Text style={s.emptyIcon}>🚦</Text>
        <Text style={s.emptyTitle}>No Active Trip</Text>
        <Text style={s.emptyText}>Accept an assignment from the Home tab to start a trip</Text>
      </View>
    );
  }

  const isStarted = activeTrip && ['STARTED', 'IN_PROGRESS'].includes(activeTrip.status);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>My Trip</Text>
        {activeTrip && (
          <Badge label={activeTrip.status.replace(/_/g, ' ')} color={TRIP_STATUS_COLOR[activeTrip.status] ?? C.muted} />
        )}
        {readyToStart && !activeTrip && (
          <Badge label="READY TO START" color={C.primary} />
        )}
      </View>

      {/* ── READY TO START — trip accepted but not yet started ── */}
      {readyToStart && !activeTrip && (
        <>
          <BookingCard
            booking={readyToStart.booking}
            vehicle={readyToStart.vehicle}
            label="Booking Details"
          />

          <View style={s.card}>
            <Text style={s.cardTitle}>▶ Start Trip</Text>
            <Text style={s.inputLabel}>Odometer Reading (km) — optional</Text>
            <TextInput
              style={s.input}
              value={odometerStart}
              onChangeText={setOdometerStart}
              placeholder="e.g. 12450"
              keyboardType="numeric"
              placeholderTextColor={C.light}
            />
            <TouchableOpacity
              style={[s.primaryBtn, startTrip.isPending && s.btnDisabled]}
              onPress={handleStart}
              disabled={startTrip.isPending}
            >
              {startTrip.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryBtnText}>▶ Start Trip</Text>}
            </TouchableOpacity>
            {startTrip.isError && (
              <Text style={s.errorText}>Could not start trip. Please try again.</Text>
            )}
          </View>
        </>
      )}

      {/* ── ACTIVE TRIP — started or in progress ── */}
      {activeTrip && (
        <>
          <BookingCard
            booking={activeTrip.assignment.booking}
            vehicle={activeTrip.assignment.vehicle}
            label="Trip in Progress"
            odometerStart={activeTrip.odometerStart}
            actualStartAt={activeTrip.actualStartAt}
          />

          {/* Complete trip form */}
          {isStarted && (
            <View style={s.card}>
              <Text style={s.cardTitle}>✓ Complete Trip</Text>
              <Text style={s.inputLabel}>Odometer Reading (km) — optional</Text>
              <TextInput style={s.input} value={odometerEnd} onChangeText={setOdometerEnd} placeholder="e.g. 12680" keyboardType="numeric" placeholderTextColor={C.light} />
              <Text style={s.inputLabel}>Remarks (optional)</Text>
              <TextInput style={[s.input, s.multiline]} value={remarks} onChangeText={setRemarks} placeholder="Any notes about the trip..." multiline numberOfLines={3} placeholderTextColor={C.light} />
              <TouchableOpacity style={[s.successBtn, completeTrip.isPending && s.btnDisabled]} onPress={handleComplete} disabled={completeTrip.isPending}>
                {completeTrip.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>✓ Complete Trip</Text>}
              </TouchableOpacity>
              {completeTrip.isError && (
                <Text style={s.errorText}>Could not complete trip. Please try again.</Text>
              )}
            </View>
          )}

          {/* Fuel log */}
          {isStarted && (
            <View style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.cardTitle}>⛽ Fuel Log</Text>
                <TouchableOpacity onPress={() => setShowFuelForm(!showFuelForm)}>
                  <Text style={s.toggleText}>{showFuelForm ? 'Cancel' : '+ Add'}</Text>
                </TouchableOpacity>
              </View>
              {showFuelForm && (
                <>
                  <Text style={s.inputLabel}>Fuel Volume (litres) *</Text>
                  <TextInput style={s.input} value={fuelVolume} onChangeText={setFuelVolume} placeholder="e.g. 35" keyboardType="numeric" placeholderTextColor={C.light} />
                  <Text style={s.inputLabel}>Fuel Cost (₹, optional)</Text>
                  <TextInput style={s.input} value={fuelCost} onChangeText={setFuelCost} placeholder="e.g. 2800" keyboardType="numeric" placeholderTextColor={C.light} />
                  <Text style={s.inputLabel}>Odometer at refuel (km) *</Text>
                  <TextInput style={s.input} value={fuelOdometer} onChangeText={setFuelOdometer} placeholder="e.g. 12550" keyboardType="numeric" placeholderTextColor={C.light} />
                  <TouchableOpacity style={[s.warningBtn, addFuel.isPending && s.btnDisabled]} onPress={handleFuelLog} disabled={addFuel.isPending}>
                    {addFuel.isPending
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.primaryBtnText}>⛽ Log Fuel</Text>}
                  </TouchableOpacity>
                  {addFuel.isError && (
                    <Text style={s.errorText}>Could not log fuel. Please try again.</Text>
                  )}
                </>
              )}
            </View>
          )}
        </>
      )}

      {/* Completed trips are shown in the History tab — not here (Steps 4-5) */}
    </ScrollView>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

function BookingCard({
  booking, vehicle, label, odometerStart, actualStartAt,
}: {
  booking: BookingInfo;
  vehicle: { vehicleNo: string; type: string; make?: string };
  label: string;
  odometerStart?: number;
  actualStartAt?: string;
}) {
  const pickup  = booking.pickupLabel  ?? booking.pickupCustomAddress  ?? '—';
  const dropoff = booking.dropoffLabel ?? booking.dropoffCustomAddress ?? '—';
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{label}</Text>
      <RequesterRow requester={booking.requester} />
      <InfoRow icon="🚗" label="Vehicle"    value={`${vehicle.vehicleNo} · ${vehicle.type}`} />
      <InfoRow icon="📍" label="Pickup"     value={pickup} />
      <InfoRow icon="🏁" label="Dropoff"    value={dropoff} />
      <InfoRow icon="📅" label="Scheduled"  value={new Date(booking.requestedAt).toLocaleString()} />
      {booking.passengerCount ? <InfoRow icon="👥" label="Passengers" value={String(booking.passengerCount)} /> : null}
      {booking.materialDescription ? <InfoRow icon="📦" label="Material" value={booking.materialDescription} /> : null}
      {odometerStart != null ? <InfoRow icon="📏" label="Odo Start" value={`${odometerStart} km`} /> : null}
      {actualStartAt ? <InfoRow icon="⏱"  label="Started"   value={new Date(actualStartAt).toLocaleTimeString()} /> : null}
    </View>
  );
}

function RequesterRow({ requester }: { requester: Requester }) {
  return (
    <View style={s.requesterBox}>
      <Text style={s.requesterTitle}>👤 Requested by</Text>
      <Text style={s.requesterName}>{requester.name}</Text>
      <Text style={s.requesterMeta}>{requester.email}</Text>
      {requester.mobileNumber ? <Text style={s.requesterMeta}>📞 {requester.mobileNumber}</Text> : null}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header:      { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title:       { fontSize: 20, fontWeight: '800', color: C.text },
  section:     { marginHorizontal: 16, marginBottom: 8 },
  sectionTitle:{ fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  card:        { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  completedCard:{ borderWidth: 1, borderColor: C.successLight },
  cardTitle:   { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  cardRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  requesterBox:{ backgroundColor: C.primaryLight, borderRadius: 8, padding: 10, marginBottom: 12 },
  requesterTitle:{ fontSize: 11, fontWeight: '700', color: C.primary, marginBottom: 2 },
  requesterName:{ fontSize: 13, fontWeight: '700', color: C.text },
  requesterMeta:{ fontSize: 12, color: C.muted, marginTop: 2 },
  infoRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  infoIcon:    { fontSize: 13, width: 20 },
  infoLabel:   { fontSize: 12, color: C.muted, fontWeight: '600', width: 72 },
  infoValue:   { fontSize: 12, color: C.text, flex: 1 },
  inputLabel:  { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 11, fontSize: 15, color: C.text, marginBottom: 12 },
  multiline:   { minHeight: 72, textAlignVertical: 'top' },
  primaryBtn:  { backgroundColor: C.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  successBtn:  { backgroundColor: C.success, borderRadius: 10, padding: 14, alignItems: 'center' },
  warningBtn:  { backgroundColor: C.warning, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  toggleText:  { color: C.primary, fontWeight: '600', fontSize: 13 },
  errorText:   { fontSize: 12, color: C.danger, marginTop: 6 },
  emptyIcon:   { fontSize: 56, marginBottom: 14 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText:   { fontSize: 14, color: C.muted, textAlign: 'center' },
});
