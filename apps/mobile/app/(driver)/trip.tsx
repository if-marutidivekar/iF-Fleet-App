import { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { Badge } from '../../components/Badge';
import { C, TRIP_STATUS_COLOR } from '../../lib/theme';

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
    booking: {
      transportType: string;
      passengerCount?: number;
      materialDescription?: string;
      pickupLabel?: string; pickupCustomAddress?: string;
      dropoffLabel?: string; dropoffCustomAddress?: string;
      requestedAt: string;
    };
    vehicle: { vehicleNo: string; type: string; make?: string };
    driver: { user: { name: string } };
  };
}

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

  const { data: trips = [], isLoading, refetch } = useQuery<ActiveTrip[]>({
    queryKey: ['driver-trips'],
    queryFn: () => api.get<ActiveTrip[]>('/trips').then(r => r.data),
    refetchInterval: 20_000,
  });

  // Active trip = one that is not completed/cancelled
  const activeTrip = trips.find(t => ['CREATED', 'STARTED', 'IN_PROGRESS'].includes(t.status));

  const startTrip = useMutation({
    mutationFn: ({ assignmentId, odometer }: { assignmentId: string; odometer: number }) =>
      api.post(`/trips/${assignmentId}/start`, { odometerStart: odometer }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['driver-trips'] }); void qc.invalidateQueries({ queryKey: ['driver-assignments'] }); },
    onError: () => Alert.alert('Error', 'Could not start trip. Please try again.'),
  });

  const completeTrip = useMutation({
    mutationFn: ({ id, odometer, note }: { id: string; odometer: number; note: string }) =>
      api.post(`/trips/${id}/complete`, { odometerEnd: odometer, remarks: note }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['driver-trips'] }); void qc.invalidateQueries({ queryKey: ['driver-assignments'] }); },
    onError: () => Alert.alert('Error', 'Could not complete trip. Please try again.'),
  });

  const addFuel = useMutation({
    mutationFn: (payload: object) => api.post(`/trips/${activeTrip!.id}/fuel`, payload),
    onSuccess: () => { setShowFuelForm(false); setFuelVolume(''); setFuelCost(''); setFuelOdometer(''); qc.invalidateQueries({ queryKey: ['driver-trips'] }); },
    onError: () => Alert.alert('Error', 'Could not log fuel. Please try again.'),
  });

  const handleStart = () => {
    if (!odometerStart || isNaN(Number(odometerStart))) {
      Alert.alert('Required', 'Please enter the current odometer reading.');
      return;
    }
    if (!activeTrip) return;
    Alert.alert('Start Trip', `Starting trip with odometer at ${odometerStart} km. Confirm?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: () => startTrip.mutate({ assignmentId: activeTrip.assignment.id, odometer: Number(odometerStart) }) },
    ]);
  };

  const handleComplete = () => {
    if (!odometerEnd || isNaN(Number(odometerEnd))) {
      Alert.alert('Required', 'Please enter the ending odometer reading.');
      return;
    }
    if (!activeTrip) return;
    Alert.alert('Complete Trip', 'Mark this trip as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => completeTrip.mutate({ id: activeTrip.id, odometer: Number(odometerEnd), note: remarks }) },
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

  if (isLoading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!activeTrip) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Text style={s.emptyIcon}>🚦</Text>
        <Text style={s.emptyTitle}>No Active Trip</Text>
        <Text style={s.emptyText}>Accept an assignment from the Home tab to start a trip</Text>
      </View>
    );
  }

  const t = activeTrip;
  const pickup  = t.assignment.booking.pickupLabel  ?? t.assignment.booking.pickupCustomAddress  ?? '—';
  const dropoff = t.assignment.booking.dropoffLabel ?? t.assignment.booking.dropoffCustomAddress ?? '—';
  const tripColor = TRIP_STATUS_COLOR[t.status] ?? C.muted;
  const isStarted = ['STARTED', 'IN_PROGRESS'].includes(t.status);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>My Trip</Text>
        <Badge label={t.status.replace(/_/g, ' ')} color={tripColor} />
      </View>

      {/* Trip details */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Trip Details</Text>
        <InfoRow icon="🚗" label="Vehicle" value={`${t.assignment.vehicle.vehicleNo} · ${t.assignment.vehicle.type}`} />
        <InfoRow icon="📍" label="Pickup" value={pickup} />
        <InfoRow icon="🏁" label="Dropoff" value={dropoff} />
        <InfoRow icon="📅" label="Scheduled" value={new Date(t.assignment.booking.requestedAt).toLocaleString()} />
        {t.assignment.booking.passengerCount ? <InfoRow icon="👥" label="Passengers" value={String(t.assignment.booking.passengerCount)} /> : null}
        {t.assignment.booking.materialDescription ? <InfoRow icon="📦" label="Material" value={t.assignment.booking.materialDescription} /> : null}
        {t.odometerStart ? <InfoRow icon="📏" label="Odo Start" value={`${t.odometerStart} km`} /> : null}
        {t.actualStartAt ? <InfoRow icon="⏱" label="Started" value={new Date(t.actualStartAt).toLocaleTimeString()} /> : null}
      </View>

      {/* Start trip form */}
      {!isStarted && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Start Trip</Text>
          <Text style={s.inputLabel}>Odometer reading (km) *</Text>
          <TextInput
            style={s.input}
            value={odometerStart}
            onChangeText={setOdometerStart}
            placeholder="e.g. 12450"
            keyboardType="numeric"
            placeholderTextColor={C.light}
          />
          <TouchableOpacity style={[s.primaryBtn, startTrip.isPending && s.btnDisabled]} onPress={handleStart} disabled={startTrip.isPending}>
            {startTrip.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>▶ Start Trip</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Complete trip form */}
      {isStarted && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Complete Trip</Text>
          <Text style={s.inputLabel}>Ending odometer (km) *</Text>
          <TextInput style={s.input} value={odometerEnd} onChangeText={setOdometerEnd} placeholder="e.g. 12680" keyboardType="numeric" placeholderTextColor={C.light} />
          <Text style={s.inputLabel}>Remarks (optional)</Text>
          <TextInput style={[s.input, s.multiline]} value={remarks} onChangeText={setRemarks} placeholder="Any notes about the trip..." multiline numberOfLines={3} placeholderTextColor={C.light} />
          <TouchableOpacity style={[s.successBtn, completeTrip.isPending && s.btnDisabled]} onPress={handleComplete} disabled={completeTrip.isPending}>
            {completeTrip.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>✓ Complete Trip</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Fuel log */}
      {isStarted && (
        <View style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardTitle}>Fuel Log</Text>
            <TouchableOpacity onPress={() => setShowFuelForm(!showFuelForm)}>
              <Text style={s.toggleText}>{showFuelForm ? 'Cancel' : '+ Add'}</Text>
            </TouchableOpacity>
          </View>
          {showFuelForm && (
            <>
              <Text style={s.inputLabel}>Fuel Volume (litres) *</Text>
              <TextInput style={s.input} value={fuelVolume} onChangeText={setFuelVolume} placeholder="e.g. 35" keyboardType="numeric" placeholderTextColor={C.light} />
              <Text style={s.inputLabel}>Fuel Cost (₹)</Text>
              <TextInput style={s.input} value={fuelCost} onChangeText={setFuelCost} placeholder="e.g. 2800" keyboardType="numeric" placeholderTextColor={C.light} />
              <Text style={s.inputLabel}>Odometer at refuel (km) *</Text>
              <TextInput style={s.input} value={fuelOdometer} onChangeText={setFuelOdometer} placeholder="e.g. 12550" keyboardType="numeric" placeholderTextColor={C.light} />
              <TouchableOpacity style={[s.warningBtn, addFuel.isPending && s.btnDisabled]} onPress={handleFuelLog} disabled={addFuel.isPending}>
                {addFuel.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.primaryBtnText}>⛽ Log Fuel</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  card: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  infoIcon: { fontSize: 13, width: 20 },
  infoLabel: { fontSize: 12, color: C.muted, fontWeight: '600', width: 72 },
  infoValue: { fontSize: 12, color: C.text, flex: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 11, fontSize: 15, color: C.text, marginBottom: 12 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  successBtn: { backgroundColor: C.success, borderRadius: 10, padding: 14, alignItems: 'center' },
  warningBtn: { backgroundColor: C.warning, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  toggleText: { color: C.primary, fontWeight: '600', fontSize: 13 },
  emptyIcon: { fontSize: 56, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center' },
});
