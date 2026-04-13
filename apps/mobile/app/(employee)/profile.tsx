import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth.store';
import { C } from '../../lib/theme';

export default function EmployeeProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const clearAuth = useAuthStore(s => s.clearAuth);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { clearAuth(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[s.headerArea, { paddingTop: insets.top + 16 }]}>
        <Text style={s.pageTitle}>Profile</Text>
      </View>

      {/* Avatar */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'E'}</Text>
        </View>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.email}>{user?.email}</Text>
        <View style={s.rolePill}><Text style={s.roleText}>👤 EMPLOYEE</Text></View>
      </View>

      {/* Info */}
      <View style={s.card}>
        <InfoRow label="Name"  value={user?.name  ?? '—'} />
        <InfoRow label="Email" value={user?.email ?? '—'} last />
      </View>

      <View style={s.notice}>
        <Text style={s.noticeText}>
          💡 Need to update your profile details? Contact your admin or use the web portal.
        </Text>
      </View>

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
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  name: { fontSize: 18, fontWeight: '700', color: C.text },
  email: { fontSize: 13, color: C.muted, marginTop: 2, marginBottom: 8 },
  rolePill: { backgroundColor: C.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: C.primary, fontWeight: '700', fontSize: 12 },
  card: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  infoLabel: { fontSize: 13, color: C.muted, fontWeight: '600' },
  infoValue: { fontSize: 13, color: C.text },
  notice: { marginHorizontal: 16, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 14, marginBottom: 24 },
  noticeText: { fontSize: 13, color: '#92400e', lineHeight: 20 },
  logoutBtn: { marginHorizontal: 16, backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: C.danger, fontWeight: '700', fontSize: 15 },
});
