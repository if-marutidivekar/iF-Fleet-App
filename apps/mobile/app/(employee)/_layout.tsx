import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../lib/theme';

export default function EmployeeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.light,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index"       options={{ title: 'Home',    tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }} />
      <Tabs.Screen name="new-booking" options={{ title: 'Book',    tabBarIcon: ({ color }) => <TabIcon emoji="➕" color={color} /> }} />
      <Tabs.Screen name="track"       options={{ title: 'Track',   tabBarIcon: ({ color }) => <TabIcon emoji="🗺️" color={color} /> }} />
      <Tabs.Screen name="history"     options={{ title: 'History', tabBarIcon: ({ color }) => <TabIcon emoji="📜" color={color} /> }} />
      <Tabs.Screen name="profile"     options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, opacity: color === C.primary ? 1 : 0.45 }}>{emoji}</Text>;
}
