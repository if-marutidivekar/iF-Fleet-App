import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth.store';
import { C } from '../../lib/theme';

export default function AdminProfile() {
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
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Profile</Text>

      <View style={s.avatar}>
        <Text style={s.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'A'}</Text>
      </View>
      <Text style={s.name}>{user?.name}</Text>
      <Text style={s.email}>{user?.email}</Text>

      <View style={s.rolePill}>
        <Text style={s.roleText}>🛡 ADMIN</Text>
      </View>

      <View style={s.infoCard}>
        <InfoRow label="Email" value={user?.email ?? '—'} />
        <InfoRow label="Role" value="Administrator" last />
      </View>

      <View style={s.notice}>
        <Text style={s.noticeText}>
          💡 Full admin controls are available on the web dashboard.{'\n'}
          Use this app for quick approvals and trip monitoring.
        </Text>
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 20, fontWeight: '800', color: C.text, alignSelf: 'flex-start', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: C.text },
  email: { fontSize: 14, color: C.muted, marginTop: 2, marginBottom: 12 },
  rolePill: { backgroundColor: C.purpleLight, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: 24 },
  roleText: { color: C.purple, fontWeight: '700', fontSize: 13 },
  infoCard: { width: '100%', backgroundColor: C.surface, borderRadius: 14, padding: 4, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel: { fontSize: 13, color: C.muted, fontWeight: '600' },
  infoValue: { fontSize: 13, color: C.text, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  notice: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 14, width: '100%', marginBottom: 24 },
  noticeText: { fontSize: 13, color: '#92400e', lineHeight: 20 },
  logoutBtn: { width: '100%', backgroundColor: C.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: C.danger, fontWeight: '700', fontSize: 15 },
});
