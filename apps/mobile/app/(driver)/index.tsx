import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { AssignmentDecision } from '@if-fleet/domain';

interface Assignment {
  id: string;
  bookingId: string;
  decision: AssignmentDecision;
  assignedAt: string;
  booking: {
    pickupLabel: string;
    dropoffLabel: string;
    requestedAt: string;
  };
}

export default function DriverDashboard() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['driver-assignments'],
    queryFn: () => api.get<Assignment[]>('/assignments/mine').then((r) => r.data),
    refetchInterval: 30_000, // poll every 30s in case push is missed
  });

  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/assignments/${id}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-assignments'] }),
  });

  const decline = useMutation({
    mutationFn: (id: string) => api.post(`/assignments/${id}/decline`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-assignments'] }),
  });

  const pending = assignments?.filter((a) => a.decision === AssignmentDecision.PENDING) ?? [];
  const accepted = assignments?.filter((a) => a.decision === AssignmentDecision.ACCEPTED) ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Assignments</Text>

      {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}

      {pending.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>New — Action Required</Text>
          <FlatList
            data={pending}
            keyExtractor={(a) => a.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.route}>{item.booking.pickupLabel} → {item.booking.dropoffLabel}</Text>
                <Text style={styles.time}>{new Date(item.booking.requestedAt).toLocaleString()}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnAccept]}
                    onPress={() => accept.mutate(item.id)}
                  >
                    <Text style={styles.btnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnDecline]}
                    onPress={() => decline.mutate(item.id)}
                  >
                    <Text style={styles.btnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      {accepted.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Accepted</Text>
          <FlatList
            data={accepted}
            keyExtractor={(a) => a.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/(driver)/trip/${item.bookingId}`)}
              >
                <Text style={styles.route}>{item.booking.pickupLabel} → {item.booking.dropoffLabel}</Text>
                <Text style={styles.time}>{new Date(item.booking.requestedAt).toLocaleString()}</Text>
                <Text style={styles.tapHint}>Tap to open trip →</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {!isLoading && pending.length === 0 && accepted.length === 0 && (
        <Text style={styles.empty}>No active assignments</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  route: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  time: { fontSize: 13, color: '#64748b', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnAccept: { backgroundColor: '#16a34a' },
  btnDecline: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tapHint: { fontSize: 13, color: '#1d4ed8', marginTop: 8 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 60, fontSize: 15 },
});
