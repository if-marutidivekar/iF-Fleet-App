import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { C } from '../../lib/theme';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuthStore();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber ?? '');
  const [error, setError] = useState('');

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
      router.replace('/');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to save. Please try again.'));
    },
  });

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0
    && department.trim().length > 0 && mobileNumber.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.icon}>👤</Text>
          <Text style={s.title}>Complete Your Profile</Text>
          <Text style={s.subtitle}>
            Fill in your details to continue using iF Fleet.
          </Text>
        </View>

        {/* User Code */}
        {user?.userCode && (
          <View style={s.codeRow}>
            <Text style={s.codeLabel}>User Code</Text>
            <Text style={s.codeValue}>{String(user.userCode).padStart(6, '0')}</Text>
          </View>
        )}

        {/* Signed in as */}
        <View style={s.emailRow}>
          <Text style={s.emailLabel}>Signed in as  </Text>
          <Text style={s.emailValue}>{user?.email}</Text>
        </View>

        {/* Form */}
        <View style={s.card}>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={s.fieldLabel}>First Name *</Text>
              <TextInput
                style={s.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
                placeholderTextColor={C.light}
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Last Name *</Text>
              <TextInput
                style={s.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor={C.light}
                autoCapitalize="words"
              />
            </View>
          </View>

          <Text style={s.fieldLabel}>Employee ID</Text>
          <TextInput
            style={s.input}
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholder="EMP-1042 (leave blank to keep)"
            placeholderTextColor={C.light}
            autoCapitalize="characters"
          />

          <Text style={s.fieldLabel}>Department *</Text>
          <TextInput
            style={s.input}
            value={department}
            onChangeText={setDepartment}
            placeholder="e.g. Engineering, Operations"
            placeholderTextColor={C.light}
            autoCapitalize="words"
          />

          <Text style={s.fieldLabel}>Mobile Number *</Text>
          <TextInput
            style={s.input}
            value={mobileNumber}
            onChangeText={setMobileNumber}
            placeholder="+919876543210"
            placeholderTextColor={C.light}
            keyboardType="phone-pad"
          />

          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.btn, (!canSubmit || saveProfile.isPending) && s.btnDisabled]}
            onPress={() => { if (canSubmit) saveProfile.mutate(); }}
            disabled={!canSubmit || saveProfile.isPending}
          >
            {saveProfile.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Save &amp; Continue</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 20 },
  icon: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  codeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  codeLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  codeValue: { fontSize: 14, fontWeight: '700', color: C.text, fontVariant: ['tabular-nums'] },

  emailRow: {
    flexDirection: 'row', justifyContent: 'center', marginBottom: 16,
  },
  emailLabel: { fontSize: 13, color: C.muted },
  emailValue: { fontSize: 13, color: C.text, fontWeight: '600' },

  card: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },

  row: { flexDirection: 'row', marginBottom: 0 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 5, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 8,
    padding: 11, fontSize: 15, color: C.text, marginBottom: 4,
  },

  errorBox: {
    backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 4,
  },
  errorText: { color: C.danger, fontSize: 13 },

  btn: {
    backgroundColor: C.primary, borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 16,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
