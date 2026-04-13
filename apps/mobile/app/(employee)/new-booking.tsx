import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';

interface PresetLocation { id: string; name: string; address: string; }

type Transport = 'PERSON' | 'PERSON_WITH_MATERIAL' | 'MATERIAL_ONLY';
type Step = 1 | 2 | 3 | 4 | 5;

const TRANSPORT_OPTIONS: { value: Transport; label: string; desc: string; emoji: string }[] = [
  { value: 'PERSON',               label: 'Person',           desc: 'Passenger transport only',    emoji: '👤' },
  { value: 'PERSON_WITH_MATERIAL', label: 'Person + Material', desc: 'Passengers with cargo',       emoji: '👤📦' },
  { value: 'MATERIAL_ONLY',        label: 'Material Only',    desc: 'Goods/cargo without passengers', emoji: '📦' },
];

function formatDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getMinDateTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  return formatDateTimeLocal(d);
}

export default function NewBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [transport, setTransport] = useState<Transport>('PERSON');
  const [passengerCount, setPassengerCount] = useState('1');
  const [materialDesc, setMaterialDesc] = useState('');
  const [pickupPresetId, setPickupPresetId] = useState<string | null>(null);
  const [pickupCustom, setPickupCustom] = useState('');
  const [dropoffPresetId, setDropoffPresetId] = useState<string | null>(null);
  const [dropoffCustom, setDropoffCustom] = useState('');
  const [requestedAt, setRequestedAt] = useState(getMinDateTime());

  const { data: locations = [], isLoading: locLoading } = useQuery<PresetLocation[]>({
    queryKey: ['preset-locations'],
    queryFn: () => api.get<PresetLocation[]>('/fleet/locations?activeOnly=true').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const createBooking = useMutation({
    mutationFn: (body: object) => api.post('/bookings', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-bookings'] });
      Alert.alert('Booking Submitted', 'Your booking request has been submitted for approval.', [
        { text: 'OK', onPress: () => { router.push('/(employee)'); } },
      ]);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      Alert.alert('Failed', Array.isArray(msg) ? msg.join('\n') : (typeof msg === 'string' ? msg : 'Could not create booking'));
    },
  });

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      transportType: transport,
      requestedAt: new Date(requestedAt).toISOString(),
    };
    if (transport !== 'MATERIAL_ONLY') payload['passengerCount'] = Number(passengerCount);
    if (transport !== 'PERSON') payload['materialDescription'] = materialDesc;
    if (pickupPresetId) payload['pickupPresetId'] = pickupPresetId;
    else payload['pickupCustomAddress'] = pickupCustom;
    if (dropoffPresetId) payload['dropoffPresetId'] = dropoffPresetId;
    else payload['dropoffCustomAddress'] = dropoffCustom;
    createBooking.mutate(payload);
  };

  const pickupLabel  = pickupPresetId  ? (locations.find(l => l.id === pickupPresetId)?.name  ?? 'Selected') : (pickupCustom  || 'Not set');
  const dropoffLabel = dropoffPresetId ? (locations.find(l => l.id === dropoffPresetId)?.name ?? 'Selected') : (dropoffCustom || 'Not set');

  const canNext1 = true;
  const canNext2 = pickupPresetId !== null || pickupCustom.trim().length > 2;
  const canNext3 = dropoffPresetId !== null || dropoffCustom.trim().length > 2;
  const canNext4 = !!requestedAt;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Fixed header + progress */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep((step - 1) as Step) : router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>New Booking</Text>
        <Text style={s.stepCount}>{step}/5</Text>
      </View>
      <View style={s.progress}>
        {([1,2,3,4,5] as Step[]).map(i => (
          <View key={i} style={[s.progressDot, i <= step && s.progressActive]} />
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }} keyboardShouldPersistTaps="handled">

        {/* Step 1: Transport type */}
        {step === 1 && (
          <>
            <Text style={s.stepTitle}>Transport Type</Text>
            <Text style={s.stepDesc}>What do you need to transport?</Text>
            {TRANSPORT_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.value}
                style={[s.optionCard, transport === o.value && s.optionCardActive]}
                onPress={() => setTransport(o.value)}
              >
                <Text style={s.optionEmoji}>{o.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, transport === o.value && s.optionLabelActive]}>{o.label}</Text>
                  <Text style={s.optionDesc}>{o.desc}</Text>
                </View>
                {transport === o.value && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}

            {transport !== 'MATERIAL_ONLY' && (
              <>
                <Text style={s.inputLabel}>Number of passengers</Text>
                <View style={s.counterRow}>
                  <TouchableOpacity style={s.counterBtn} onPress={() => setPassengerCount(c => String(Math.max(1, Number(c) - 1)))}>
                    <Text style={s.counterBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.counterValue}>{passengerCount}</Text>
                  <TouchableOpacity style={s.counterBtn} onPress={() => setPassengerCount(c => String(Math.min(8, Number(c) + 1)))}>
                    <Text style={s.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {transport !== 'PERSON' && (
              <>
                <Text style={s.inputLabel}>Material description *</Text>
                <TextInput
                  style={[s.input, s.multiline]}
                  value={materialDesc}
                  onChangeText={setMaterialDesc}
                  placeholder="e.g. Lab equipment — 3 boxes, approx 20 kg"
                  placeholderTextColor={C.light}
                  multiline
                  numberOfLines={3}
                />
              </>
            )}
          </>
        )}

        {/* Step 2: Pickup */}
        {step === 2 && (
          <>
            <Text style={s.stepTitle}>Pickup Location</Text>
            <Text style={s.stepDesc}>Where should the cab pick you up?</Text>

            {locLoading && <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />}

            {locations.map(loc => (
              <TouchableOpacity
                key={loc.id}
                style={[s.locCard, pickupPresetId === loc.id && s.locCardActive]}
                onPress={() => { setPickupPresetId(loc.id); setPickupCustom(''); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.locName, pickupPresetId === loc.id && { color: C.primary }]}>{loc.name}</Text>
                  <Text style={s.locAddr}>{loc.address}</Text>
                </View>
                {pickupPresetId === loc.id && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[s.locCard, pickupPresetId === null && pickupCustom.length > 0 ? s.locCardActive : {}]}
              onPress={() => setPickupPresetId(null)}
            >
              <Text style={[s.locName, pickupPresetId === null ? { color: C.primary } : {}]}>📝 Other (enter address)</Text>
            </TouchableOpacity>

            {pickupPresetId === null && (
              <TextInput
                style={s.input}
                value={pickupCustom}
                onChangeText={setPickupCustom}
                placeholder="Enter full pickup address"
                placeholderTextColor={C.light}
                autoFocus
              />
            )}
          </>
        )}

        {/* Step 3: Dropoff */}
        {step === 3 && (
          <>
            <Text style={s.stepTitle}>Dropoff Location</Text>
            <Text style={s.stepDesc}>Where should the cab drop you off?</Text>

            {locations.map(loc => (
              <TouchableOpacity
                key={loc.id}
                style={[s.locCard, dropoffPresetId === loc.id && s.locCardActive]}
                onPress={() => { setDropoffPresetId(loc.id); setDropoffCustom(''); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.locName, dropoffPresetId === loc.id && { color: C.primary }]}>{loc.name}</Text>
                  <Text style={s.locAddr}>{loc.address}</Text>
                </View>
                {dropoffPresetId === loc.id && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[s.locCard, dropoffPresetId === null && dropoffCustom.length > 0 ? s.locCardActive : {}]}
              onPress={() => setDropoffPresetId(null)}
            >
              <Text style={[s.locName, dropoffPresetId === null ? { color: C.primary } : {}]}>📝 Other (enter address)</Text>
            </TouchableOpacity>

            {dropoffPresetId === null && (
              <TextInput
                style={s.input}
                value={dropoffCustom}
                onChangeText={setDropoffCustom}
                placeholder="Enter full dropoff address"
                placeholderTextColor={C.light}
                autoFocus
              />
            )}
          </>
        )}

        {/* Step 4: Date & Time */}
        {step === 4 && (
          <>
            <Text style={s.stepTitle}>Date & Time</Text>
            <Text style={s.stepDesc}>When do you need the cab?</Text>
            <Text style={s.inputLabel}>Pickup date & time *</Text>
            <TextInput
              style={s.input}
              value={requestedAt}
              onChangeText={setRequestedAt}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor={C.light}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={s.inputHint}>Format: YYYY-MM-DD HH:MM (minimum 30 min from now)</Text>

            {/* Quick time shortcuts */}
            <Text style={[s.inputLabel, { marginTop: 12 }]}>Quick select</Text>
            <View style={s.quickRow}>
              {[1, 2, 4, 8].map(h => {
                const d = new Date();
                d.setHours(d.getHours() + h);
                d.setMinutes(0, 0, 0);
                return (
                  <TouchableOpacity key={h} style={s.quickBtn} onPress={() => setRequestedAt(formatDateTimeLocal(d))}>
                    <Text style={s.quickBtnText}>+{h}h</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <>
            <Text style={s.stepTitle}>Review & Confirm</Text>
            <Text style={s.stepDesc}>Please review your booking details before submitting.</Text>

            <View style={s.reviewCard}>
              <ReviewRow label="Transport" value={transport.replace(/_/g, ' ')} />
              {transport !== 'MATERIAL_ONLY' && <ReviewRow label="Passengers" value={passengerCount} />}
              {transport !== 'PERSON' && <ReviewRow label="Material" value={materialDesc || '—'} />}
              <ReviewRow label="Pickup"   value={pickupLabel} />
              <ReviewRow label="Dropoff"  value={dropoffLabel} />
              <ReviewRow label="Date/Time" value={new Date(requestedAt).toLocaleString()} last />
            </View>

            <View style={s.notice}>
              <Text style={s.noticeText}>
                Your request will be sent to an admin for approval. You'll be notified once approved and a driver is assigned.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Fixed bottom navigation */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step < 5 ? (
          <TouchableOpacity
            style={[s.nextBtn, !(step === 1 ? canNext1 : step === 2 ? canNext2 : step === 3 ? canNext3 : canNext4) && s.btnDisabled]}
            onPress={() => setStep((step + 1) as Step)}
            disabled={!(step === 1 ? canNext1 : step === 2 ? canNext2 : step === 3 ? canNext3 : canNext4)}
          >
            <Text style={s.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.nextBtn, s.submitBtn, createBooking.isPending && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={createBooking.isPending}
          >
            {createBooking.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.nextBtnText}>Submit Booking</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[reviewS.row, !last && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
      <Text style={reviewS.label}>{label}</Text>
      <Text style={reviewS.value}>{value}</Text>
    </View>
  );
}

const reviewS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  label: { fontSize: 13, color: C.muted, fontWeight: '600' },
  value: { fontSize: 13, color: C.text, flex: 1, textAlign: 'right', marginLeft: 8 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { marginRight: 10, padding: 4 },
  backText: { fontSize: 22, color: C.primary },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: C.text },
  stepCount: { fontSize: 13, color: C.muted, fontWeight: '600' },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.surface },
  progressDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border },
  progressActive: { backgroundColor: C.primary },
  scroll: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  stepDesc: { fontSize: 14, color: C.muted, marginBottom: 16 },
  // Transport options
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: C.border, gap: 12 },
  optionCardActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  optionEmoji: { fontSize: 24 },
  optionLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  optionLabelActive: { color: C.primary },
  optionDesc: { fontSize: 12, color: C.muted, marginTop: 2 },
  check: { fontSize: 16, color: C.primary, fontWeight: '800' },
  // Counter
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  counterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontSize: 22, color: C.primary, fontWeight: '700', lineHeight: 26 },
  counterValue: { fontSize: 24, fontWeight: '800', color: C.text, minWidth: 32, textAlign: 'center' },
  // Location cards
  locCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: C.border },
  locCardActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  locName: { fontSize: 14, fontWeight: '700', color: C.text },
  locAddr: { fontSize: 12, color: C.muted, marginTop: 2 },
  // Inputs
  inputLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6, marginTop: 4 },
  inputHint: { fontSize: 11, color: C.light, marginTop: -8, marginBottom: 12 },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 12, fontSize: 15, color: C.text, marginBottom: 12, backgroundColor: C.surface },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  // Quick time
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn: { flex: 1, backgroundColor: C.primaryLight, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quickBtnText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  // Review
  reviewCard: { backgroundColor: C.surface, borderRadius: 14, padding: 4, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  notice: { backgroundColor: C.primaryLight, borderRadius: 10, padding: 14 },
  noticeText: { fontSize: 13, color: C.primary, lineHeight: 20 },
  // Footer
  footer: { backgroundColor: C.surface, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  nextBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  submitBtn: { backgroundColor: C.success },
  btnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
