import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../lib/theme';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={s.inner}>
        <View>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.sub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function LogoutButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.logout}>
      <Text style={s.logoutText}>Sign out</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12, paddingHorizontal: 16 },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  sub: { fontSize: 13, color: C.muted, marginTop: 1 },
  logout: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fef2f2', borderRadius: 8 },
  logoutText: { fontSize: 13, color: C.danger, fontWeight: '600' },
});
