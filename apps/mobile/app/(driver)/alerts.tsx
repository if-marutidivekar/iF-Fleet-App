import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';

interface Notification {
  id: string;
  title: string;
  body: string;
  channel: string;
  deliveryState: string;
  readAt?: string;
  createdAt: string;
}

export default function DriverAlerts() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ['driver-notifications'],
    queryFn: () => api.get<Notification[]>('/notifications').then(r => r.data),
    refetchInterval: 15_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-notifications'] }),
  });

  const unreadCount = notifications.filter(n => n.deliveryState !== 'READ').length;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>Alerts</Text>
        {unreadCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unreadCount} new</Text>
          </View>
        )}
      </View>

      {isLoading && <ActivityIndicator color={C.primary} style={{ margin: 32 }} />}

      {!isLoading && notifications.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>No Alerts</Text>
          <Text style={s.emptyText}>Notifications from the fleet system will appear here</Text>
        </View>
      )}

      <View style={s.list}>
        {notifications.map(n => {
          const isUnread = n.deliveryState !== 'READ';
          return (
            <TouchableOpacity
              key={n.id}
              style={[s.card, isUnread && s.cardUnread]}
              onPress={() => {
                if (isUnread) markReadMutation.mutate(n.id);
              }}
              activeOpacity={isUnread ? 0.7 : 1}
            >
              <View style={s.cardRow}>
                <View style={s.iconWrap}>
                  <Text style={s.icon}>{n.channel === 'IN_APP' ? '🔔' : '📧'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.titleRow}>
                    <Text style={[s.notifTitle, isUnread && s.notifTitleBold]}>{n.title}</Text>
                    {isUnread && <View style={s.dot} />}
                  </View>
                  <Text style={s.notifBody}>{n.body}</Text>
                  <Text style={s.time}>{new Date(n.createdAt).toLocaleString()}</Text>
                </View>
              </View>
              {isUnread && (
                <Text style={s.tapHint}>Tap to mark as read</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: C.text },
  badge: { backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  list: { marginHorizontal: 16 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: C.primary, backgroundColor: C.primaryLight },
  cardRow: { flexDirection: 'row', gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  icon: { fontSize: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  notifTitle: { fontSize: 14, color: C.text, fontWeight: '500', flex: 1 },
  notifTitleBold: { fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  notifBody: { fontSize: 13, color: C.muted, lineHeight: 18, marginBottom: 4 },
  time: { fontSize: 11, color: C.light },
  tapHint: { fontSize: 11, color: C.primary, marginTop: 6, textAlign: 'right' },
  empty: { marginTop: 80, alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: 'center' },
});
