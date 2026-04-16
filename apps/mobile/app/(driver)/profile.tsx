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
  const updateUser = useAuthStore(s => s.updateUser);
  const accessToken = useAuthStore(s => s.accessToken);

  const isMobilePin = (user as { authMethod?: string } | null)?.authMethod === 'MOBILE_PIN';

  // ─── Profile edit ─────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber ?? '');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // ─── PIN change ───────────────────────────────────────────────────────────
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinDone, setPinDone] = useState(false);

  const saveProfile = useMutation({
    mutationFn: () =>
      api.patch<{
        firstName: string; lastName: string; name: string;
        department: string; mobileNumber: string; profileCompleted: boolean; userCode: number;
      }>('/users/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(employeeId.trim() && { employeeId: employeeId.trim() }),
        ...(department.trim() && { department: department.trim() }),
        ...(mobileNumber.trim() && { mobileNumber: mobileNumber.trim() }),
      }),
    onSuccess: ({ data }) => {
      updateUser({
        firstName: data.firstName,
        lastName: data.lastName,
        name: data.name,
        department: data.department,
        mobileNumber: data.mobileNumber,
        profileCompleted: data.profileCompleted,
        userCode: data.userCode,
      });
      setEditSuccess('Profile updated successfully.');
      setEditError('');
      setEditing(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setEditError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to save.'));
    },
  });

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

  const startEdit = () => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setEmployeeId('');
    setDepartment(user?.department ?? '');
    setMobileNumber(user?.mobileNumber ?? '');
    setEditError('');
    setEditSuccess('');
    setEditing(true);
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

      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(user?.firstName ?? user?.name ?? 'D').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.email}>{user?.email}</Text>
        {user?.userCode && (
          <Text style={s.userCode}>Code: {String(user.userCode).padStart(6, '0')}</Text>
        )}
        <View style={s.rolePill}><Text style={s.roleText}>🚗 DRIVER</Text></View>
      </View>

      {/* Info / Edit */}
      <View style={s.card}>
        {!editing ? (
          <>
            <InfoRow label="First Name"  value={user?.firstName ?? '—'} />
            <InfoRow label="Last Name"   value={user?.lastName  ?? '—'} />
            <InfoRow label="Email"       value={user?.email ?? '—'} />
            <InfoRow label="Department"  value={user?.department ?? '—'} />
            <InfoRow label="Mobile"      value={user?.mobileNumber ?? '—'} />
            <InfoRow label="Auth Method" value={isMobilePin ? 'Mobile + PIN' : 'Email OTP'} last />

            {editSuccess ? (
              <View style={s.successBox}>
                <Text style={s.successText}>✓ {editSuccess}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={s.editBtn} onPress={startEdit}>
              <Text style={s.editBtnText}>✏ Edit Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={s.fieldRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={s.fieldLabel}>First Name *</Text>
                <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Jane" placeholderTextColor={C.light} autoCapitalize="words" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Last Name *</Text>
                <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Doe" placeholderTextColor={C.light} autoCapitalize="words" />
              </View>
            </View>
            <Text style={s.fieldLabel}>Employee ID <Text style={{ fontWeight: '400', color: C.light }}>(leave blank to keep)</Text></Text>
            <TextInput style={s.input} value={employeeId} onChangeText={setEmployeeId} placeholder="EMP-1042" placeholderTextColor={C.light} />
            <Text style={s.fieldLabel}>Department *</Text>
            <TextInput style={s.input} value={department} onChangeText={setDepartment} placeholder="Operations" placeholderTextColor={C.light} autoCapitalize="words" />
            <Text style={s.fieldLabel}>Mobile Number</Text>
            <TextInput style={s.input} value={mobileNumber} onChangeText={setMobileNumber} placeholder="+919876543210" placeholderTextColor={C.light} keyboardType="phone-pad" />

            {!!editError && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{editError}</Text>
              </View>
            )}

            <View style={s.btnRow}>
              <TouchableOpacity
                style={[s.saveBtn, (!firstName.trim() || !lastName.trim() || saveProfile.isPending) && s.btnDisabled]}
                onPress={() => saveProfile.mutate()}
                disabled={!firstName.trim() || !lastName.trim() || saveProfile.isPending}
              >
                {saveProfile.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditing(false); setEditError(''); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
              <Text style={s.fieldLabel}>Current PIN</Text>
              <TextInput style={s.input} value={currentPin} onChangeText={c => { setCurrentPin(c.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} secureTextEntry keyboardType="numeric" maxLength={6} placeholder="6-digit PIN" placeholderTextColor={C.light} />
              <Text style={s.fieldLabel}>New PIN</Text>
              <TextInput style={s.input} value={newPin} onChangeText={c => { setNewPin(c.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} secureTextEntry keyboardType="numeric" maxLength={6} placeholder="New 6-digit PIN" placeholderTextColor={C.light} />
              <Text style={s.fieldLabel}>Confirm New PIN</Text>
              <TextInput style={[s.input, mismatch && s.inputError]} value={confirmPin} onChangeText={c => { setConfirmPin(c.replace(/\D/g, '').slice(0, 6)); setPinError(''); }} secureTextEntry keyboardType="numeric" maxLength={6} placeholder="Repeat new PIN" placeholderTextColor={C.light} />
              {(mismatch || pinError) && <Text style={s.errText}>{mismatch ? 'PINs do not match' : pinError}</Text>}
              <TouchableOpacity
                style={[s.saveBtn, (changePin.isPending || currentPin.length < 6 || newPin.length < 6 || mismatch) && s.btnDisabled]}
                onPress={handlePinChange}
                disabled={changePin.isPending || currentPin.length < 6 || newPin.length < 6 || mismatch}
              >
                {changePin.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Set New PIN</Text>}
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
  headerArea: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pageTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 18, fontWeight: '700', color: C.text },
  email: { fontSize: 13, color: C.muted, marginTop: 2 },
  userCode: { fontSize: 11, color: C.light, marginTop: 2, fontVariant: ['tabular-nums'] },
  rolePill: { backgroundColor: C.successLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  roleText: { color: C.success, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  toggle: { fontSize: 13, color: C.primary, fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  infoLabel: { fontSize: 13, color: C.muted, fontWeight: '600' },
  infoValue: { fontSize: 13, color: C.text },
  editBtn: { backgroundColor: C.successLight, borderRadius: 8, padding: 11, alignItems: 'center', marginTop: 10 },
  editBtnText: { color: C.success, fontWeight: '700', fontSize: 14 },
  fieldRow: { flexDirection: 'row', marginBottom: 0 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 5, marginTop: 8 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 14, color: C.text, marginBottom: 2 },
  inputError: { borderColor: C.danger },
  errText: { color: C.danger, fontSize: 12, marginBottom: 6 },
  errorBox: { backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 10, marginTop: 6 },
  errorText: { color: C.danger, fontSize: 12 },
  successBox: { backgroundColor: C.successLight, borderRadius: 8, padding: 10, marginTop: 8, alignItems: 'center' },
  successText: { color: C.success, fontWeight: '700', fontSize: 13 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  saveBtn: { flex: 1, backgroundColor: C.primary, borderRadius: 8, padding: 11, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: { paddingHorizontal: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 11, alignItems: 'center' },
  cancelBtnText: { color: C.muted, fontSize: 14 },
  logoutBtn: { marginHorizontal: 16, backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  logoutText: { color: C.danger, fontWeight: '700', fontSize: 15 },
});
