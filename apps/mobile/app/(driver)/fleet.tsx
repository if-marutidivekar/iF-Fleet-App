import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, FlatList, TextInput, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { C } from '../../lib/theme';

interface PresetLocation {
  id: string;
  name: string;
  address: string;
}

interface DriverProfile {
  id: string;
  currentLocationText?: string;
  locationUpdatedAt?: string;
  currentLocationPreset?: { id: string; name: string; address: string };
}

interface Vehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string;
  model?: string;
  status: string;
  currentDriverId?: string;
  currentDriverAssignedAt?: string;
  currentDriver?: {
    id: string;
    user: { id: string };
  };
}

export default function DriverFleet() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [locationModal, setLocationModal] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const { data: vehicles = [], isLoading: loadingV, refetch: refetchV } = useQuery<Vehicle[]>({
    queryKey: ['driver-vehicles'],
    queryFn: () => api.get<Vehicle[]>('/fleet/vehicles').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: drivers = [], isLoading: loadingD, refetch: refetchD } = useQuery<DriverProfile[]>({
    queryKey: ['driver-profiles'],
    queryFn: () => api.get<DriverProfile[]>('/fleet/drivers').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: presets = [] } = useQuery<PresetLocation[]>({
    queryKey: ['presets-active'],
    queryFn: () => api.get<PresetLocation[]>('/fleet/locations?activeOnly=true').then(r => r.data),
  });

  // Find my driver profile
  const myProfile = drivers.find(d => (d as any).userId === user?.id) as (DriverProfile & { userId?: string } & any) | undefined;

  // Find my assigned vehicle
  const myVehicle = vehicles.find(v => v.currentDriver?.user?.id === user?.id);

  const setLocationMutation = useMutation({
    mutationFn: (payload: { presetId?: string; customAddress?: string }) =>
      api.patch('/fleet/drivers/my-location', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-vehicles'] });
      qc.invalidateQueries({ queryKey: ['driver-profiles'] });
      setLocationModal(false);
      setCustomAddress('');
      setSelectedPresetId(null);
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to set location'),
  });

  const leaveVehicleMutation = useMutation({
    mutationFn: (vehicleId: string) =>
      api.patch(`/fleet/vehicles/${vehicleId}/unassign-driver`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-vehicles'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to leave vehicle'),
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
    if (!myVehicle) return;
    Alert.alert(
      'Leave Vehicle',
      `Are you sure you want to leave ${myVehicle.vehicleNo}? The vehicle will become available.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveVehicleMutation.mutate(myVehicle.id) },
      ],
    );
  };

  const isLoading = loadingV || loadingD;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { refetchV(); refetchD(); }} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>My Vehicle</Text>
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && !myVehicle && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🚙</Text>
          <Text style={s.emptyTitle}>No Vehicle Assigned</Text>
          <Text style={s.emptyText}>Contact your admin to get a vehicle assigned to you.</Text>
        </View>
      )}

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
            {myProfile?.currentLocationText ? (
              <>
                <Text style={s.locationText}>📍 {myProfile.currentLocationText}</Text>
                {myProfile.locationUpdatedAt && (
                  <Text style={s.updatedAt}>
                    Updated {new Date(myProfile.locationUpdatedAt).toLocaleString()}
                  </Text>
                )}
              </>
            ) : (
              <View style={s.warningBox}>
                <Text style={s.warningText}>⚠️ Location not set. Set your location so employees can see you in the Available Vehicles screen.</Text>
              </View>
            )}
            <TouchableOpacity style={s.setLocationBtn} onPress={() => setLocationModal(true)}>
              <Text style={s.setLocationText}>
                {myProfile?.currentLocationText ? '📍 Update Location' : '📍 Set My Location'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Leave Vehicle */}
          <TouchableOpacity
            style={s.leaveBtn}
            onPress={handleLeaveVehicle}
            disabled={leaveVehicleMutation.isPending}
          >
            {leaveVehicleMutation.isPending
              ? <ActivityIndicator color={C.danger} size="small" />
              : <Text style={s.leaveText}>Leave Vehicle</Text>}
          </TouchableOpacity>
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
            <TouchableOpacity style={s.cancelBtn} onPress={() => setLocationModal(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  content: { paddingHorizontal: 16 },
  vehicleCard: { backgroundColor: C.primaryLight, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.primary + '44' },
  vehicleLabel: { fontSize: 11, fontWeight: '700', color: C.primary, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  vehicleNo: { fontSize: 26, fontWeight: '800', color: C.primary, marginBottom: 4 },
  vehicleType: { fontSize: 14, color: C.text, fontWeight: '600' },
  assignedAt: { fontSize: 12, color: C.muted, marginTop: 6 },
  locationCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  locationLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  locationText: { fontSize: 15, color: C.text, fontWeight: '600', marginBottom: 4 },
  updatedAt: { fontSize: 12, color: C.light, marginBottom: 10 },
  warningBox: { backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#fde68a' },
  warningText: { color: '#92400e', fontSize: 13, lineHeight: 19 },
  setLocationBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  setLocationText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  leaveBtn: { backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  leaveText: { color: C.danger, fontWeight: '700', fontSize: 15 },
  empty: { marginTop: 80, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 8 },
  presetOption: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, backgroundColor: C.bg },
  presetSelected: { backgroundColor: C.primaryLight, borderWidth: 1, borderColor: C.primary },
  presetName: { fontSize: 14, fontWeight: '600', color: C.text },
  presetAddr: { fontSize: 12, color: C.muted, marginTop: 2 },
  orText: { textAlign: 'center', color: C.muted, fontSize: 12, marginVertical: 12 },
  input: { backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  saveBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { backgroundColor: C.bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText: { color: C.muted, fontWeight: '700', fontSize: 14 },
});
