import { Tabs } from 'expo-router';
import { C } from '../../lib/theme';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.light,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} /> }}
      />
      <Tabs.Screen
        name="book"
        options={{ title: 'Book', tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} /> }}
      />
      <Tabs.Screen
        name="fleet"
        options={{ title: 'Fleet', tabBarIcon: ({ color }) => <TabIcon emoji="🚙" color={color} /> }}
      />
      <Tabs.Screen
        name="track"
        options={{ title: 'Track', tabBarIcon: ({ color }) => <TabIcon emoji="🗺️" color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color }) => <TabIcon emoji="📜" color={color} /> }}
      />
      <Tabs.Screen
        name="admin"
        options={{ title: 'Admin', tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
      {/* Hide old filenames from tab bar */}
      <Tabs.Screen name="queue" options={{ href: null }} />
      <Tabs.Screen name="trips" options={{ href: null }} />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 18, opacity: color === C.primary ? 1 : 0.45 }}>{emoji}</Text>;
}
