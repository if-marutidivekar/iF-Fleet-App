import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';

export default function DriverProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const accessToken = useAuthStore(s => s.accessToken);

  const isMobilePin = (user as { authMethod?: string } | null)?.authMethod === 'MOBILE_PIN';

  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinDone, setPinDone] = useState(false);

  const changePin = useMutation({
    mutationFn: () =>
      api.post('/auth/driver/change-pin', { currentPin, newPin },
        { headers: { Authorization: `Bearer ${accessToken}` } }),
    onSuccess: () => { setPinDone(true); setCurrentPin(''); setNewPin(''); setConfirmPin(''); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setPinError(Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : 'Failed to change PIN'));
    },
  });

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { clearAuth(); router.replace('/(auth)/login'); } },
    ]);
  };

  const handlePinChange = () => {
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
    if (newPin.length !== 6) { setPinError('PIN must be 6 digits'); return; }
    setPinError('');
    changePin.mutate();
  };

  const mismatch = confirmPin.length === 6 && newPin !== confirmPin;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.headerArea, { paddingTop: insets.top + 16 }]}>
        <Text style={s.pageTitle}>Profile</Text>
      </View>

      {/* Avatar + name */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'D'}</Text>
        </View>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={s.rolePill}><Text style={s.roleText}>🚗 DRIVER</Text></View>
      </View>

      {/* Info */}
      <View style={s.card}>
        <InfoRow label="Email" value={user?.email ?? '—'} />
        <InfoRow label="Auth Method" value={isMobilePin ? 'Mobile + PIN' : 'Email OTP'} last />
      </View>

      {/* PIN change (MOBILE_PIN drivers only) */}
      {isMobilePin && (
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Change PIN</Text>
            <TouchableOpacity onPress={() => { setShowPinChange(!showPinChange); setPinDone(false); setPinError(''); }}>
              <Text style={s.toggle}>{showPinChange ? 'Cancel' : 'Change'}</Text>
            </TouchableOpacity>
          </View>

          {pinDone && (
            <View style={s.successBox}>
              <Text style={s.successText}>✓ PIN changed successfully</Text>
            </View>
          )}

          {showPinChange && !pinDone && (
            <>
              <Text style={s.inputLabel}>Current PIN</Text>
              <TextInput style={s.input} value={currentPin} onChangeText={c => { setCurrentPin(c.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} secureTextEntry keyboardType="numeric" maxLength={6} placeholder="6-digit PIN" placeholderTextColor={C.light} />
              <Text style={s.inputLabel}>New PIN</Text>
              <TextInput style={s.input} value={newPin} onChangeText={c => { setNewPin(c.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} secureTextEntry keyboardType="numeric" maxLength={6} placeholder="New 6-digit PIN" placeholderTextColor={C.light} />
              <Text style={s.inputLabel}>Confirm New PIN</Text>
              <TextInput style={[s.input, mismatch && s.inputError]} value={confirmPin} onChangeText={c => { setConfirmPin(c.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} secureTextEntry keyboardType="numeric" maxLength={6} placeholder="Repeat new PIN" placeholderTextColor={C.light} />
              {(mismatch || pinError) && <Text style={s.errText}>{mismatch ? 'PINs do not match' : pinError}</Text>}
              <TouchableOpacity
                style={[s.primaryBtn, (changePin.isPending || currentPin.length < 6 || newPin.length < 6 || mismatch) && s.btnDisabled]}
                onPress={handlePinChange}
                disabled={changePin.isPending || currentPin.length < 6 || newPin.length < 6 || mismatch}
              >
                {changePin.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Set New PIN</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.infoRow, !last && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerArea: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 0 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 18, fontWeight: '700', color: C.text },
  email: { fontSize: 13, color: C.muted, marginTop: 2, marginBottom: 8 },
  rolePill: { backgroundColor: C.successLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: C.success, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  toggle: { fontSize: 13, color: C.primary, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  infoLabel: { fontSize: 13, color: C.muted, fontWeight: '600' },
  infoValue: { fontSize: 13, color: C.text },
  inputLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 11, fontSize: 15, color: C.text, marginBottom: 12 },
  inputError: { borderColor: C.danger },
  errText: { color: C.danger, fontSize: 12, marginBottom: 8 },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  successBox: { backgroundColor: C.successLight, borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 4 },
  successText: { color: C.success, fontWeight: '700', fontSize: 13 },
  logoutBtn: { marginHorizontal: 16, backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  logoutText: { color: C.danger, fontWeight: '700', fontSize: 15 },
});
