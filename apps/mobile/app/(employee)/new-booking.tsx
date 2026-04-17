import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { C } from '../../lib/theme';

interface PresetLocation { id: string; name: string; address: string; }

interface AvailableVehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string;
  model?: string;
  currentDriver?: {
    id: string;
    currentLocationText?: string;
    currentLocationPreset?: { name: string };
    user: { name: string };
  };
}

type Transport = 'PERSON' | 'PERSON_WITH_MATERIAL' | 'MATERIAL_ONLY';
type Step = 1 | 2 | 3 | 4;

const TRANSPORT_OPTIONS: { value: Transport; label: string; desc: string; emoji: string }[] = [
  { value: 'PERSON',               label: 'Person',            desc: 'Passenger transport only',        emoji: '👤' },
  { value: 'PERSON_WITH_MATERIAL', label: 'Person + Material', desc: 'Passengers with cargo',           emoji: '👤📦' },
  { value: 'MATERIAL_ONLY',        label: 'Material Only',     desc: 'Goods/cargo without passengers',  emoji: '📦' },
];

function formatDateTimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewBookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Transport Type
  const [transport, setTransport] = useState<Transport>('PERSON');
  const [passengerCount, setPassengerCount] = useState('1');
  const [materialDesc, setMaterialDesc] = useState('');

  // Step 2 — Pickup, Drop & Time
  // Start with null (no selection) so the user must explicitly choose — matches web behaviour.
  const [pickupPresetId, setPickupPresetId] = useState<string | null>(null);
  const [pickupCustom, setPickupCustom] = useState('');
  const [dropoffPresetId, setDropoffPresetId] = useState<string | null>(null);
  const [dropoffCustom, setDropoffCustom] = useState('');
  const [requestedAt, setRequestedAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1); d.setMinutes(0, 0, 0);
    return formatDateTimeLocal(d);
  });

  // Step 3 — Available Vehicles
  const [preferredVehicleId, setPreferredVehicleId] = useState<string | null>(null);

  // Step 38: Past datetime validation state
  const [requestedAtError, setRequestedAtError] = useState('');

  // Step 13/14: Reset vehicle preference whenever pickup changes so stale selections
  // are never silently carried forward to a different pickup location.
  useEffect(() => {
    setPreferredVehicleId(null);
  }, [pickupPresetId]);

  // Data fetching
  const { data: locations = [], isLoading: locLoading } = useQuery<PresetLocation[]>({
    queryKey: ['preset-locations'],
    queryFn: () => api.get<PresetLocation[]>('/fleet/locations?activeOnly=true').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const pickupPresetParam =
    pickupPresetId && pickupPresetId !== '__other__' ? pickupPresetId : undefined;

  const { data: availableVehicles = [], isLoading: vehiclesLoading } = useQuery<AvailableVehicle[]>({
    queryKey: ['available-with-driver', pickupPresetParam],
    queryFn: () => {
      const url = pickupPresetParam
        ? `/fleet/vehicles/available-with-driver?pickupPresetId=${pickupPresetParam}`
        : '/fleet/vehicles/available-with-driver';
      return api.get<AvailableVehicle[]>(url).then(r => r.data);
    },
    enabled: step === 3,
    staleTime: 60_000,
  });

  const resetForm = () => {
    setStep(1);
    setTransport('PERSON');
    setPassengerCount('1');
    setMaterialDesc('');
    setPickupPresetId(locations.length > 0 ? locations[0]!.id : null);
    setPickupCustom('');
    setDropoffPresetId(locations.length > 0 ? locations[0]!.id : null);
    setDropoffCustom('');
    const d = new Date(); d.setHours(d.getHours() + 1); d.setMinutes(0, 0, 0);
    setRequestedAt(formatDateTimeLocal(d));
    setPreferredVehicleId(null);
  };

  const createBooking = useMutation({
    mutationFn: (body: object) => api.post('/bookings', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-bookings'] });
      resetForm();
      Alert.alert('Booking Submitted!', 'Your booking request has been submitted.', [
        { text: 'OK', onPress: () => router.push('/(employee)') },
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
    if (pickupPresetId && pickupPresetId !== '__other__') payload['pickupPresetId'] = pickupPresetId;
    else payload['pickupCustomAddress'] = pickupCustom;
    if (dropoffPresetId && dropoffPresetId !== '__other__') payload['dropoffPresetId'] = dropoffPresetId;
    else payload['dropoffCustomAddress'] = dropoffCustom;
    if (preferredVehicleId) payload['preferredVehicleId'] = preferredVehicleId;
    createBooking.mutate(payload);
  };

  // Labels for review
  const pickupLabel  = (pickupPresetId && pickupPresetId !== '__other__')
    ? (locations.find(l => l.id === pickupPresetId)?.name  ?? 'Selected')
    : (pickupCustom  || 'Not set');
  const dropoffLabel = (dropoffPresetId && dropoffPresetId !== '__other__')
    ? (locations.find(l => l.id === dropoffPresetId)?.name ?? 'Selected')
    : (dropoffCustom || 'Not set');
  const vehicleLabel = preferredVehicleId
    ? availableVehicles.find(v => v.id === preferredVehicleId)?.vehicleNo ?? 'Selected'
    : 'No preference';

  // Step 38: Check if current requestedAt is in the past (with 60s grace)
  const isRequestedAtPast = (): boolean => {
    if (!requestedAt) return false;
    const d = new Date(requestedAt);
    return !isNaN(d.getTime()) && d.getTime() < Date.now() - 60_000;
  };

  const handleRequestedAtChange = (val: string) => {
    setRequestedAt(val);
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime()) && d.getTime() < Date.now() - 60_000) {
        setRequestedAtError('Booking date/time cannot be in the past. Please select a future time.');
      } else {
        setRequestedAtError('');
      }
    } else {
      setRequestedAtError('');
    }
  };

  // Validation — preset selected OR custom address typed, AND time is not in the past
  const canNext2 = (
      (pickupPresetId !== null && pickupPresetId !== '__other__') ||
      pickupCustom.trim().length > 2
    ) &&
    (
      (dropoffPresetId !== null && dropoffPresetId !== '__other__') ||
      dropoffCustom.trim().length > 2
    ) &&
    !!requestedAt &&
    !isRequestedAtPast();

  const STEPS = ['Transport', 'Locations & Time', 'Vehicle', 'Review'];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep((step - 1) as Step) : router.back()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>New Booking</Text>
          <Text style={s.stepLabel}>Step {step} of 4 — {STEPS[step - 1]}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progress}>
        {([1, 2, 3, 4] as Step[]).map(i => (
          <View key={i} style={[s.progressSeg, i <= step && s.progressActive]} />
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 88 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── STEP 1: Transport Type ─── */}
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
                <Text style={s.inputLabel}>Passengers</Text>
                <View style={s.counterRow}>
                  <TouchableOpacity style={s.counterBtn} onPress={() => setPassengerCount(c => String(Math.max(1, Number(c) - 1)))}>
                    <Text style={s.counterBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.counterVal}>{passengerCount}</Text>
                  <TouchableOpacity style={s.counterBtn} onPress={() => setPassengerCount(c => String(Math.min(8, Number(c) + 1)))}>
                    <Text style={s.counterBtnTxt}>+</Text>
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
                  placeholder="e.g. Lab equipment — 3 boxes, ~20 kg"
                  placeholderTextColor={C.light}
                  multiline
                  numberOfLines={3}
                />
              </>
            )}
          </>
        )}

        {/* ─── STEP 2: Pickup, Drop & Time ─── */}
        {step === 2 && (
          <>
            <Text style={s.stepTitle}>Pickup, Drop & Time</Text>
            <Text style={s.stepDesc}>Set all three on this screen.</Text>

            {locLoading && <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />}

            {/* Pickup */}
            <Text style={s.sectionHeader}>📍 Pickup Location</Text>
            {locations.map(loc => (
              <TouchableOpacity
                key={`p-${loc.id}`}
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
            {/* "Other address" — explicitly opt in */}
            <TouchableOpacity
              style={[s.locCard, pickupPresetId === '__other__' ? s.locCardActive : {}]}
              onPress={() => setPickupPresetId('__other__')}
            >
              <Text style={[s.locName, pickupPresetId === '__other__' ? { color: C.primary } : {}]}>📝 Other address</Text>
            </TouchableOpacity>
            {pickupPresetId === '__other__' && (
              <TextInput
                style={s.input}
                value={pickupCustom}
                onChangeText={setPickupCustom}
                placeholder="Enter pickup address"
                placeholderTextColor={C.light}
              />
            )}

            {/* Dropoff */}
            <Text style={[s.sectionHeader, { marginTop: 12 }]}>🏁 Dropoff Location</Text>
            {locations.map(loc => (
              <TouchableOpacity
                key={`d-${loc.id}`}
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
            {/* "Other address" — explicitly opt in */}
            <TouchableOpacity
              style={[s.locCard, dropoffPresetId === '__other__' ? s.locCardActive : {}]}
              onPress={() => setDropoffPresetId('__other__')}
            >
              <Text style={[s.locName, dropoffPresetId === '__other__' ? { color: C.primary } : {}]}>📝 Other address</Text>
            </TouchableOpacity>
            {dropoffPresetId === '__other__' && (
              <TextInput
                style={s.input}
                value={dropoffCustom}
                onChangeText={setDropoffCustom}
                placeholder="Enter dropoff address"
                placeholderTextColor={C.light}
              />
            )}

            {/* Date & Time */}
            <Text style={[s.sectionHeader, { marginTop: 12 }]}>🕐 Date & Time</Text>
            <TextInput
              style={[s.input, requestedAtError ? { borderColor: '#ef4444' } : {}]}
              value={requestedAt}
              onChangeText={handleRequestedAtChange}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor={C.light}
              keyboardType="numbers-and-punctuation"
            />
            {requestedAtError ? (
              <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 8, marginTop: -6 }}>
                ⚠ {requestedAtError}
              </Text>
            ) : null}
            <View style={s.quickRow}>
              {[1, 2, 4, 8].map(h => {
                const d = new Date(); d.setHours(d.getHours() + h); d.setMinutes(0, 0, 0);
                return (
                  <TouchableOpacity key={h} style={s.quickBtn} onPress={() => {
                    const val = formatDateTimeLocal(d);
                    setRequestedAt(val);
                    setRequestedAtError(''); // Quick shortcuts always set future time
                  }}>
                    <Text style={s.quickBtnTxt}>+{h}h</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ─── STEP 3: Available Vehicles ─── */}
        {step === 3 && (
          <>
            <Text style={s.stepTitle}>Available Vehicles</Text>
            <Text style={s.stepDesc}>
              {pickupPresetParam
                ? `Vehicles whose driver is at your pickup location.`
                : 'Select a vehicle with driver, or proceed without a preference.'}
            </Text>

            {/* Step 14: No Preference — ALWAYS shown first as the safe default */}
            <TouchableOpacity
              style={[s.vehicleCard, preferredVehicleId === null && s.vehicleCardSelected]}
              onPress={() => setPreferredVehicleId(null)}
            >
              <Text style={s.noPreferenceIcon}>🔀</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.vehicleNo, preferredVehicleId === null && { color: C.primary }]}>No Preference</Text>
                <Text style={s.vehicleType}>Admin will assign the best available vehicle</Text>
              </View>
              {preferredVehicleId === null && <Text style={s.check}>✓</Text>}
            </TouchableOpacity>

            {vehiclesLoading && <ActivityIndicator color={C.primary} style={{ margin: 24 }} />}

            {/* Step 13/14: context-aware empty state when no vehicles match pickup */}
            {!vehiclesLoading && availableVehicles.length === 0 && (
              <View style={s.noVehicleBox}>
                <Text style={s.noVehicleIcon}>🚗</Text>
                <Text style={s.noVehicleTitle}>
                  {pickupPresetParam
                    ? 'No Vehicles at This Location'
                    : 'No Vehicles Currently Available'}
                </Text>
                <Text style={s.noVehicleText}>
                  {pickupPresetParam
                    ? `No driver is currently stationed at this pickup. "No Preference" is selected — admin will assign the best vehicle.`
                    : 'No drivers have set their location yet. You can still submit your booking — admin will assign a vehicle.'}
                </Text>
              </View>
            )}

            {availableVehicles.map(v => {
              // Step 31: Use vehicle's own location as primary source (currentLocationPreset/Text)
              // Fall back to driver's location for legacy compatibility
              const location = (v as { currentLocationPreset?: { name: string }; currentLocationText?: string })?.currentLocationPreset?.name
                ?? (v as { currentLocationText?: string })?.currentLocationText
                ?? v.currentDriver?.currentLocationPreset?.name
                ?? v.currentDriver?.currentLocationText
                ?? '—';
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[s.vehicleCard, preferredVehicleId === v.id && s.vehicleCardSelected]}
                  onPress={() => setPreferredVehicleId(v.id)}
                >
                  <Text style={s.vehicleEmoji}>🚙</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.vehicleNo, preferredVehicleId === v.id && { color: C.primary }]}>
                      {v.vehicleNo}
                    </Text>
                    <Text style={s.vehicleType}>
                      {v.type.replace(/_/g, ' ')}{v.make ? ` · ${v.make}` : ''}
                    </Text>
                    {v.currentDriver && (
                      <>
                        <Text style={s.driverName}>👤 {v.currentDriver.user.name}</Text>
                        <Text style={s.driverLocation}>📍 {location}</Text>
                      </>
                    )}
                  </View>
                  {preferredVehicleId === v.id && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* ─── STEP 4: Review & Submit ─── */}
        {step === 4 && (
          <>
            <Text style={s.stepTitle}>Review & Confirm</Text>
            <Text style={s.stepDesc}>Please review before submitting.</Text>

            <View style={s.reviewCard}>
              <ReviewRow label="Transport"  value={transport.replace(/_/g, ' ')} />
              {transport !== 'MATERIAL_ONLY' && <ReviewRow label="Passengers" value={passengerCount} />}
              {transport !== 'PERSON'        && <ReviewRow label="Material"   value={materialDesc || '—'} />}
              <ReviewRow label="Pickup"      value={pickupLabel} />
              <ReviewRow label="Dropoff"     value={dropoffLabel} />
              <ReviewRow label="Date / Time" value={new Date(requestedAt).toLocaleString()} />
              <ReviewRow label="Vehicle"     value={vehicleLabel} last />
            </View>

            <View style={s.notice}>
              <Text style={s.noticeText}>
                Your request will be reviewed by an admin. Once approved, a driver will be assigned and you'll be notified.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Fixed footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step < 4 ? (
          <TouchableOpacity
            style={[s.nextBtn, (step === 2 && !canNext2) && s.btnDisabled]}
            onPress={() => setStep((step + 1) as Step)}
            disabled={step === 2 && !canNext2}
          >
            <Text style={s.nextBtnTxt}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.nextBtn, s.submitBtn, createBooking.isPending && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={createBooking.isPending}
          >
            {createBooking.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.nextBtnTxt}>Submit Booking Request</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[rS.row, !last && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
      <Text style={rS.label}>{label}</Text>
      <Text style={rS.value}>{value}</Text>
    </View>
  );
}

const rS = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14 },
  label: { fontSize: 13, color: C.muted, fontWeight: '600' },
  value: { fontSize: 13, color: C.text, flex: 1, textAlign: 'right', marginLeft: 8 },
});

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { marginRight: 12, padding: 4 },
  backText: { fontSize: 22, color: C.primary },
  title:   { fontSize: 16, fontWeight: '800', color: C.text },
  stepLabel: { fontSize: 11, color: C.muted, marginTop: 1 },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.surface },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border },
  progressActive: { backgroundColor: C.primary },
  scroll: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  stepDesc:  { fontSize: 13, color: C.muted, marginBottom: 16 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 8 },
  // Transport
  optionCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: C.border, gap: 12 },
  optionCardActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  optionEmoji: { fontSize: 24 },
  optionLabel:       { fontSize: 14, fontWeight: '700', color: C.text },
  optionLabelActive: { color: C.primary },
  optionDesc:  { fontSize: 12, color: C.muted, marginTop: 2 },
  check:       { fontSize: 16, color: C.primary, fontWeight: '800' },
  counterRow:  { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  counterBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 22, color: C.primary, fontWeight: '700', lineHeight: 26 },
  counterVal:  { fontSize: 24, fontWeight: '800', color: C.text, minWidth: 32, textAlign: 'center' },
  // Locations
  locCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: C.border },
  locCardActive: { borderColor: C.primary, backgroundColor: C.primaryLight },
  locName: { fontSize: 13, fontWeight: '700', color: C.text },
  locAddr: { fontSize: 11, color: C.muted, marginTop: 2 },
  input:    { borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 12, fontSize: 14, color: C.text, marginBottom: 8, backgroundColor: C.surface },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: C.muted, marginBottom: 6 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickBtn: { flex: 1, backgroundColor: C.primaryLight, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quickBtnTxt: { color: C.primary, fontWeight: '700', fontSize: 13 },
  // Vehicles
  noVehicleBox:   { backgroundColor: '#fffbeb', borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#fde68a', marginBottom: 12 },
  noVehicleIcon:  { fontSize: 44, marginBottom: 10 },
  noVehicleTitle: { fontSize: 15, fontWeight: '700', color: '#92400e', marginBottom: 6 },
  noVehicleText:  { fontSize: 13, color: '#92400e', textAlign: 'center', lineHeight: 19 },
  vehicleCard:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: C.border, gap: 10 },
  vehicleCardSelected: { borderColor: C.primary, backgroundColor: C.primaryLight },
  noPreferenceIcon: { fontSize: 22, marginTop: 2 },
  vehicleEmoji: { fontSize: 22, marginTop: 2 },
  vehicleNo:   { fontSize: 15, fontWeight: '700', color: C.text },
  vehicleType: { fontSize: 12, color: C.muted, marginTop: 2 },
  driverName:  { fontSize: 12, color: C.text, fontWeight: '600', marginTop: 4 },
  driverLocation: { fontSize: 12, color: C.muted, marginTop: 1 },
  // Review
  reviewCard: { backgroundColor: C.surface, borderRadius: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  notice:     { backgroundColor: C.primaryLight, borderRadius: 10, padding: 14 },
  noticeText: { fontSize: 13, color: C.primary, lineHeight: 20 },
  // Footer
  footer:     { backgroundColor: C.surface, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  nextBtn:    { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  submitBtn:  { backgroundColor: C.success },
  btnDisabled: { opacity: 0.5 },
  nextBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
