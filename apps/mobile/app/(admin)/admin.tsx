import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';

interface AppConfig {
  approvalMode: 'MANUAL' | 'AUTO';
  sessionTimeoutMinutes: number;
  companyEmailDomain: string;
  smtpConfigured: boolean;
}

export default function AdminSettings() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<AppConfig>({
    queryKey: ['admin-config'],
    queryFn: () => api.get<AppConfig>('/admin/config').then(r => r.data),
  });

  const [sessionTimeout, setSessionTimeout] = useState('');

  useEffect(() => {
    if (config) setSessionTimeout(String(config.sessionTimeoutMinutes));
  }, [config]);

  const approvalModeMutation = useMutation({
    mutationFn: (mode: 'MANUAL' | 'AUTO') =>
      api.put('/admin/config/approval-mode', { mode }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-config'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update'),
  });

  const sessionTimeoutMutation = useMutation({
    mutationFn: (minutes: number) =>
      api.put('/admin/config/session-timeout', { minutes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-config'] });
      Alert.alert('Saved', 'Session timeout updated');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update'),
  });

  const saveSessionTimeout = () => {
    const val = parseInt(sessionTimeout, 10);
    if (isNaN(val) || val < 5 || val > 1440) {
      Alert.alert('Invalid', 'Enter a value between 5 and 1440 minutes');
      return;
    }
    sessionTimeoutMutation.mutate(val);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>App Settings</Text>
        <Text style={s.subtitle}>Administrator controls</Text>
      </View>

      {/* Approval Mode */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Booking Approval</Text>
        <View style={s.card}>
          <View style={s.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>Auto-Approve Bookings</Text>
              <Text style={s.settingDesc}>
                {config?.approvalMode === 'AUTO'
                  ? 'Bookings are automatically approved'
                  : 'Admin must manually approve each booking'}
              </Text>
            </View>
            <Switch
              value={config?.approvalMode === 'AUTO'}
              onValueChange={val => approvalModeMutation.mutate(val ? 'AUTO' : 'MANUAL')}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
              disabled={approvalModeMutation.isPending}
            />
          </View>
        </View>
      </View>

      {/* Session Timeout */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Session Timeout</Text>
        <View style={s.card}>
          <Text style={s.settingLabel}>Timeout (minutes)</Text>
          <Text style={s.settingDesc}>Inactive sessions are signed out after this duration (5–1440 min)</Text>
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={sessionTimeout}
              onChangeText={setSessionTimeout}
              keyboardType="number-pad"
              placeholder="e.g. 60"
              placeholderTextColor={C.light}
            />
            <TouchableOpacity
              style={s.saveBtn}
              onPress={saveSessionTimeout}
              disabled={sessionTimeoutMutation.isPending}
            >
              {sessionTimeoutMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Company Info — read-only */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Company</Text>
        <View style={s.card}>
          <InfoRow label="Email Domain" value={config?.companyEmailDomain ?? '—'} />
          <InfoRow
            label="SMTP Status"
            value={config?.smtpConfigured ? '✅ Configured' : '❌ Not Configured'}
            last
          />
        </View>
        <Text style={s.notice}>Edit company domain and SMTP settings on the web portal.</Text>
      </View>
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
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  settingDesc: { fontSize: 12, color: C.muted, lineHeight: 17 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  input: { flex: 1, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  saveBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  infoLabel: { fontSize: 13, color: C.muted },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '600' },
  notice: { fontSize: 12, color: C.muted, marginTop: 8, fontStyle: 'italic' },
});
