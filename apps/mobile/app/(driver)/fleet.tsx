import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, FlatList, TextInput, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';

interface PresetLocation {
  id: string;
  name: string;
  address: string;
}

interface MyDriverProfile {
  id: string;
  currentLocationText?: string | null;
  locationUpdatedAt?: string | null;
  currentLocationPreset?: { id: string; name: string; address: string } | null;
  assignedVehicle?: {
    id: string;
    vehicleNo: string;
    type: string;
    make?: string;
    model?: string;
    status: string;
    currentDriverAssignedAt?: string | null;
  } | null;
  user: { id: string; name: string };
}

interface AvailableVehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string;
  model?: string;
  capacity: number;
}

export default function DriverFleet() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [locationModal, setLocationModal] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [selfAssigningId, setSelfAssigningId] = useState<string | null>(null);

  // Use driver-scoped endpoint instead of admin /fleet/drivers
  const { data: myProfile, isLoading: loadingProfile, refetch: refetchProfile } = useQuery<MyDriverProfile>({
    queryKey: ['my-driver-profile'],
    queryFn: () => api.get<MyDriverProfile>('/fleet/drivers/me').then(r => r.data),
    refetchInterval: 30_000,
  });

  // Only fetch available vehicles if no vehicle is currently assigned
  const hasVehicle = !!(myProfile?.assignedVehicle);
  const { data: availableVehicles = [], isLoading: loadingAvailable, refetch: refetchAvailable } = useQuery<AvailableVehicle[]>({
    queryKey: ['available-vehicles-driver'],
    queryFn: () => api.get<AvailableVehicle[]>('/fleet/vehicles/available').then(r => r.data),
    enabled: !hasVehicle,
    refetchInterval: 30_000,
  });

  const { data: presets = [] } = useQuery<PresetLocation[]>({
    queryKey: ['presets-active'],
    queryFn: () => api.get<PresetLocation[]>('/fleet/locations?activeOnly=true').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const setLocationMutation = useMutation({
    mutationFn: (payload: { presetId?: string; customAddress?: string }) =>
      api.patch('/fleet/drivers/my-location', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-driver-profile'] });
      void qc.invalidateQueries({ queryKey: ['available-with-driver'] });
      setLocationModal(false);
      setCustomAddress('');
      setSelectedPresetId(null);
    },
    onError: (e: unknown) => Alert.alert('Error', (e as any)?.response?.data?.message ?? 'Failed to set location'),
  });

  const leaveVehicleMutation = useMutation({
    mutationFn: (vehicleId: string) =>
      api.patch(`/fleet/vehicles/${vehicleId}/unassign-driver`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-driver-profile'] });
      void qc.invalidateQueries({ queryKey: ['available-vehicles-driver'] });
      void qc.invalidateQueries({ queryKey: ['available-with-driver'] });
    },
    onError: (e: unknown) => Alert.alert('Error', (e as any)?.response?.data?.message ?? 'Failed to leave vehicle'),
  });

  const selfAssignMutation = useMutation({
    mutationFn: (vehicleId: string) =>
      api.patch(`/fleet/vehicles/${vehicleId}/self-assign`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-driver-profile'] });
      void qc.invalidateQueries({ queryKey: ['available-vehicles-driver'] });
      setSelfAssigningId(null);
    },
    onError: (e: unknown) => Alert.alert('Error', (e as any)?.response?.data?.message ?? 'Failed to assign vehicle'),
  });

  const handleSetLocation = () => {
    if (!selectedPresetId && !customAddress.trim()) {
      Alert.alert('Required', 'Select a preset location or enter a custom address');
      return;
    }
    setLocationMutation.mutate(
      selectedPresetId
        ? { presetId: selectedPresetId }
        : { customAddress: customAddress.trim() }
    );
  };

  const handleLeaveVehicle = () => {
    if (!myProfile?.assignedVehicle) return;
    // Step 5: block leave while vehicle is on an active trip
    if (myProfile.assignedVehicle.status === 'IN_TRIP') {
      Alert.alert(
        'Trip In Progress',
        'You cannot leave the vehicle while a trip is active. Complete the trip first.',
        [{ text: 'OK' }],
      );
      return;
    }
    Alert.alert(
      'Leave Vehicle',
      `Are you sure you want to leave ${myProfile.assignedVehicle.vehicleNo}? The vehicle will become available for others.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: () => leaveVehicleMutation.mutate(myProfile.assignedVehicle!.id),
        },
      ],
    );
  };

  const handleSelfAssign = (v: AvailableVehicle) => {
    Alert.alert(
      'Take This Vehicle',
      `Assign yourself to ${v.vehicleNo} (${v.type.replace(/_/g, ' ')}${v.make ? ' · ' + v.make : ''})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => selfAssignMutation.mutate(v.id) },
      ],
    );
  };

  const isLoading = loadingProfile;
  const myVehicle = myProfile?.assignedVehicle;
  const locationText = myProfile?.currentLocationPreset?.name ?? myProfile?.currentLocationText ?? null;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => { void refetchProfile(); void refetchAvailable(); }}
          tintColor={C.primary}
        />
      }
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>My Vehicle</Text>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {/* ── No vehicle assigned ── */}
      {!isLoading && !myVehicle && (
        <View style={s.content}>
          <View style={s.emptyCard}>
            <Text style={s.emptyIcon}>🚙</Text>
            <Text style={s.emptyTitle}>No Vehicle Assigned</Text>
            <Text style={s.emptyText}>
              Admin can assign a vehicle to you, or pick one from the available vehicles below.
            </Text>
          </View>

          {/* Available vehicles for self-assign */}
          {loadingAvailable && <ActivityIndicator color={C.primary} style={{ margin: 16 }} />}
          {!loadingAvailable && availableVehicles.length > 0 && (
            <View>
              <Text style={s.sectionTitle}>Available Vehicles</Text>
              {availableVehicles.map(v => (
                <View key={v.id} style={s.availCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.availNo}>{v.vehicleNo}</Text>
                    <Text style={s.availType}>
                      {v.type.replace(/_/g, ' ')}{v.make ? ` · ${v.make} ${v.model ?? ''}` : ''} · {v.capacity} seats
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.takeBtn}
                    onPress={() => handleSelfAssign(v)}
                    disabled={selfAssignMutation.isPending && selfAssigningId === v.id}
                  >
                    {selfAssignMutation.isPending && selfAssigningId === v.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={s.takeBtnTxt}>Take Vehicle</Text>}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {!loadingAvailable && availableVehicles.length === 0 && (
            <View style={s.noAvailBox}>
              <Text style={s.noAvailText}>No vehicles currently available. Contact your admin.</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Vehicle assigned ── */}
      {!isLoading && myVehicle && (
        <View style={s.content}>
          {/* Vehicle Card */}
          <View style={s.vehicleCard}>
            <Text style={s.vehicleLabel}>Assigned Vehicle</Text>
            <Text style={s.vehicleNo}>{myVehicle.vehicleNo}</Text>
            <Text style={s.vehicleType}>
              {myVehicle.type.replace(/_/g, ' ')}
              {myVehicle.make ? ` · ${myVehicle.make} ${myVehicle.model ?? ''}` : ''}
            </Text>
            {myVehicle.currentDriverAssignedAt && (
              <Text style={s.assignedAt}>
                Assigned since {new Date(myVehicle.currentDriverAssignedAt).toLocaleDateString()}
              </Text>
            )}
          </View>

          {/* Location Card */}
          <View style={s.locationCard}>
            <Text style={s.locationLabel}>My Current Location</Text>
            {locationText ? (
              <>
                <Text style={s.locationText}>📍 {locationText}</Text>
                {myProfile?.locationUpdatedAt && (
                  <Text style={s.updatedAt}>
                    Updated {new Date(myProfile.locationUpdatedAt).toLocaleString()}
                  </Text>
                )}
              </>
            ) : (
              <View style={s.warningBox}>
                <Text style={s.warningText}>
                  ⚠️ Location not set. Set your location so employees can see you in the Available Vehicles screen.
                </Text>
              </View>
            )}
            <TouchableOpacity style={s.setLocationBtn} onPress={() => setLocationModal(true)}>
              <Text style={s.setLocationText}>
                {locationText ? '📍 Update Location' : '📍 Set My Location'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Leave Vehicle — blocked while IN_TRIP (Step 5) */}
          {myVehicle.status === 'IN_TRIP' ? (
            <View style={s.inTripBar}>
              <Text style={s.inTripText}>🚦 Trip in progress — cannot leave vehicle now</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={s.leaveBtn}
              onPress={handleLeaveVehicle}
              disabled={leaveVehicleMutation.isPending}
            >
              {leaveVehicleMutation.isPending
                ? <ActivityIndicator color={C.danger} size="small" />
                : <Text style={s.leaveText}>Leave Vehicle</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Set Location Modal */}
      <Modal
        visible={locationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.modalTitle}>Set My Location</Text>

            <Text style={s.sectionLabel}>Choose a preset:</Text>
            <FlatList
              data={presets}
              keyExtractor={p => p.id}
              style={{ maxHeight: 200 }}
              renderItem={({ item: p }) => (
                <TouchableOpacity
                  style={[s.presetOption, selectedPresetId === p.id && s.presetSelected]}
                  onPress={() => { setSelectedPresetId(p.id); setCustomAddress(''); }}
                >
                  <Text style={[s.presetName, selectedPresetId === p.id && { color: C.primary }]}>{p.name}</Text>
                  <Text style={s.presetAddr}>{p.address}</Text>
                </TouchableOpacity>
              )}
            />

            <Text style={s.orText}>— or enter a custom address —</Text>
            <TextInput
              style={[s.input, selectedPresetId ? { opacity: 0.4 } : {}]}
              placeholder="e.g. Gate No. 3, Plant Area"
              placeholderTextColor={C.light}
              value={customAddress}
              onChangeText={t => { setCustomAddress(t); setSelectedPresetId(null); }}
              editable={!selectedPresetId}
            />

            <TouchableOpacity
              style={s.saveBtn}
              onPress={handleSetLocation}
              disabled={setLocationMutation.isPending}
            >
              {setLocationMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.saveBtnText}>Save Location</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelModalBtn} onPress={() => setLocationModal(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  header:       { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 16 },
  title:        { fontSize: 20, fontWeight: '800', color: C.text },
  content:      { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10, marginTop: 4 },

  // Empty state
  emptyCard:    { backgroundColor: C.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  emptyIcon:    { fontSize: 48, marginBottom: 12 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText:    { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },

  // Available vehicles for self-assign
  availCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  availNo:      { fontSize: 16, fontWeight: '700', color: C.text },
  availType:    { fontSize: 12, color: C.muted, marginTop: 2 },
  takeBtn:      { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: 'center' },
  takeBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  noAvailBox:   { backgroundColor: '#fffbeb', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#fde68a' },
  noAvailText:  { color: '#92400e', fontSize: 13, textAlign: 'center' },

  // Vehicle card
  vehicleCard:  { backgroundColor: C.primaryLight, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.primary + '44' },
  vehicleLabel: { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  vehicleNo:    { fontSize: 26, fontWeight: '800', color: C.primary, marginBottom: 4 },
  vehicleType:  { fontSize: 14, color: C.text, fontWeight: '600' },
  assignedAt:   { fontSize: 12, color: C.muted, marginTop: 6 },

  // Location card
  locationCard:  { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  locationLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  locationText:  { fontSize: 15, color: C.text, fontWeight: '600', marginBottom: 4 },
  updatedAt:     { fontSize: 12, color: C.light, marginBottom: 10 },
  warningBox:    { backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fde68a' },
  warningText:   { color: '#92400e', fontSize: 13, lineHeight: 19 },
  setLocationBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  setLocationText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // Leave button
  leaveBtn:     { backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  leaveText:    { color: C.danger, fontWeight: '700', fontSize: 15 },
  // IN_TRIP block banner
  inTripBar:    { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  inTripText:   { color: '#92400e', fontWeight: '600', fontSize: 14, textAlign: 'center' },

  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  sectionLabel:  { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 8 },
  presetOption:  { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, backgroundColor: C.bg },
  presetSelected:{ backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.primary },
  presetName:    { fontSize: 14, fontWeight: '600', color: C.text },
  presetAddr:    { fontSize: 12, color: C.muted, marginTop: 2 },
  orText:        { textAlign: 'center', color: C.muted, fontSize: 12, marginVertical: 12 },
  input:         { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  saveBtn:       { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelModalBtn:{ backgroundColor: C.bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText:    { color: C.muted, fontWeight: '700', fontSize: 14 },
});
