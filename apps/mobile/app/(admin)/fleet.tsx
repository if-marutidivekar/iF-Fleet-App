import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, FlatList, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';
import { Badge } from '../../components/Badge';

interface DriverProfile {
  id: string;
  licenseNumber: string;
  shiftReady: boolean;
  currentLocationText?: string;
  locationUpdatedAt?: string;
  user: { id: string; name: string; email: string; mobileNumber?: string };
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
    user: { id: string; name: string };
  };
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: C.success, ASSIGNED: C.primary, IN_TRIP: C.orange,
  MAINTENANCE: C.warning, INACTIVE: C.muted,
};

export default function AdminFleet() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'vehicles' | 'drivers'>('vehicles');
  const [assignModalVehicle, setAssignModalVehicle] = useState<Vehicle | null>(null);

  const { data: vehicles = [], isLoading: loadingV, refetch: refetchV } = useQuery<Vehicle[]>({
    queryKey: ['admin-vehicles'],
    queryFn: () => api.get<Vehicle[]>('/fleet/vehicles').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: drivers = [], isLoading: loadingD, refetch: refetchD } = useQuery<DriverProfile[]>({
    queryKey: ['admin-drivers'],
    queryFn: () => api.get<DriverProfile[]>('/fleet/drivers').then(r => r.data),
    refetchInterval: 30_000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ vehicleId, driverProfileId }: { vehicleId: string; driverProfileId: string }) =>
      api.patch(`/fleet/vehicles/${vehicleId}/assign-driver`, { driverProfileId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vehicles'] });
      qc.invalidateQueries({ queryKey: ['admin-drivers'] });
      setAssignModalVehicle(null);
    },
    onError: (e: any) => {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to assign driver');
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (vehicleId: string) =>
      api.patch(`/fleet/vehicles/${vehicleId}/unassign-driver`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-vehicles'] });
      qc.invalidateQueries({ queryKey: ['admin-drivers'] });
    },
    onError: (e: any) => {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to unassign driver');
    },
  });

  const shiftReadyMutation = useMutation({
    mutationFn: ({ id, shiftReady }: { id: string; shiftReady: boolean }) =>
      api.patch(`/fleet/drivers/${id}`, { shiftReady }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-drivers'] }),
    onError: (e: any) => {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update driver');
    },
  });

  const handleUnassign = (vehicle: Vehicle) => {
    Alert.alert(
      'Unassign Driver',
      `Remove ${vehicle.currentDriver?.user.name} from ${vehicle.vehicleNo}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unassign', style: 'destructive', onPress: () => unassignMutation.mutate(vehicle.id) },
      ],
    );
  };

  const availableDrivers = drivers.filter(d => d.shiftReady && !vehicles.some(v => v.currentDriverId === d.id));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Fleet</Text>
        <Text style={s.subtitle}>{vehicles.length} vehicles · {drivers.length} drivers</Text>
      </View>

      {/* Tab Switcher */}
      <View style={s.tabRow}>
        {(['vehicles', 'drivers'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'vehicles' ? `🚙 Vehicles (${vehicles.length})` : `👤 Drivers (${drivers.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={tab === 'vehicles' ? loadingV : loadingD}
            onRefresh={tab === 'vehicles' ? refetchV : refetchD}
            tintColor={C.primary}
          />
        }
      >
        {tab === 'vehicles' && (
          <>
            {loadingV && <ActivityIndicator color={C.primary} style={{ margin: 24 }} />}
            {vehicles.map(v => (
              <View key={v.id} style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.vehicleNo}>{v.vehicleNo}</Text>
                  <Badge label={v.status} color={STATUS_COLOR[v.status] ?? C.muted} />
                </View>
                <Text style={s.vehicleType}>{v.type.replace(/_/g, ' ')}{v.make ? ` · ${v.make} ${v.model ?? ''}` : ''}</Text>
                <View style={s.driverRow}>
                  {v.currentDriver ? (
                    <>
                      <Text style={s.driverName}>👤 {v.currentDriver.user.name}</Text>
                      <TouchableOpacity
                        style={s.unassignBtn}
                        onPress={() => handleUnassign(v)}
                        disabled={unassignMutation.isPending}
                      >
                        <Text style={s.unassignText}>Unassign</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={s.noDriver}>No driver assigned</Text>
                      <TouchableOpacity
                        style={s.assignBtn}
                        onPress={() => setAssignModalVehicle(v)}
                      >
                        <Text style={s.assignText}>Assign</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {tab === 'drivers' && (
          <>
            {loadingD && <ActivityIndicator color={C.primary} style={{ margin: 24 }} />}
            {drivers.map(d => (
              <View key={d.id} style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.vehicleNo}>{d.user.name}</Text>
                  <TouchableOpacity
                    style={[s.shiftBtn, d.shiftReady ? s.shiftOn : s.shiftOff]}
                    onPress={() => shiftReadyMutation.mutate({ id: d.id, shiftReady: !d.shiftReady })}
                    disabled={shiftReadyMutation.isPending}
                  >
                    <Text style={s.shiftText}>{d.shiftReady ? 'On Shift' : 'Off Shift'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={s.vehicleType}>🪪 {d.licenseNumber}</Text>
                {d.currentLocationText ? (
                  <Text style={s.locationText}>📍 {d.currentLocationText}</Text>
                ) : (
                  <Text style={s.noLocation}>📍 Location not set</Text>
                )}
                {d.locationUpdatedAt && (
                  <Text style={s.updatedAt}>Updated {new Date(d.locationUpdatedAt).toLocaleString()}</Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Assign Driver Modal */}
      <Modal
        visible={!!assignModalVehicle}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVehicle(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.modalTitle}>Assign Driver to {assignModalVehicle?.vehicleNo}</Text>
            {availableDrivers.length === 0 ? (
              <Text style={s.noDriverModal}>No shift-ready, unassigned drivers available.</Text>
            ) : (
              <FlatList
                data={availableDrivers}
                keyExtractor={d => d.id}
                renderItem={({ item: d }) => (
                  <TouchableOpacity
                    style={s.driverOption}
                    onPress={() => {
                      if (assignModalVehicle) {
                        assignMutation.mutate({ vehicleId: assignModalVehicle.id, driverProfileId: d.id });
                      }
                    }}
                    disabled={assignMutation.isPending}
                  >
                    <Text style={s.driverOptionName}>{d.user.name}</Text>
                    <Text style={s.driverOptionDetail}>{d.licenseNumber}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAssignModalVehicle(null)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTextActive: { color: C.primary },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  vehicleNo: { fontSize: 15, fontWeight: '700', color: C.text },
  vehicleType: { fontSize: 12, color: C.muted, marginBottom: 8 },
  driverRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverName: { fontSize: 13, color: C.text, fontWeight: '600' },
  noDriver: { fontSize: 13, color: C.light, fontStyle: 'italic' },
  assignBtn: { backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  assignText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  unassignBtn: { backgroundColor: C.dangerLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  unassignText: { color: C.danger, fontWeight: '700', fontSize: 12 },
  shiftBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  shiftOn: { backgroundColor: C.successLight },
  shiftOff: { backgroundColor: '#f1f5f9' },
  shiftText: { fontSize: 12, fontWeight: '700' },
  locationText: { fontSize: 12, color: C.text, marginTop: 4 },
  noLocation: { fontSize: 12, color: C.warning, marginTop: 4 },
  updatedAt: { fontSize: 11, color: C.light, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  noDriverModal: { color: C.muted, fontSize: 13, textAlign: 'center', marginVertical: 24 },
  driverOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  driverOptionName: { fontSize: 14, fontWeight: '600', color: C.text },
  driverOptionDetail: { fontSize: 12, color: C.muted, marginTop: 2 },
  cancelBtn: { marginTop: 16, backgroundColor: C.bg, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: C.muted, fontWeight: '700', fontSize: 14 },
});
