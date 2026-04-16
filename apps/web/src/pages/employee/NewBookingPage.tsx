import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface PresetLocation {
  id: string;
  name: string;
  address: string;
}

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
    user: { name: string; mobileNumber?: string };
  };
}

type TransportType = 'PERSON' | 'PERSON_WITH_MATERIAL' | 'MATERIAL_ONLY';

interface LocationPickerProps {
  label: string;
  locations: PresetLocation[];
  selectedPresetId: string;
  customAddress: string;
  onPresetChange: (id: string) => void;
  onCustomChange: (val: string) => void;
}

function LocationPicker({
  label,
  locations,
  selectedPresetId,
  customAddress,
  onPresetChange,
  onCustomChange,
}: LocationPickerProps) {
  const isOther = selectedPresetId === '__other__';

  return (
    <div>
      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 4 }}>
        {label}
      </label>
      <select
        value={selectedPresetId}
        onChange={(e) => onPresetChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.6rem 0.75rem',
          border: '1.5px solid #e2e8f0',
          borderRadius: 8,
          fontSize: 14,
          background: '#fff',
          color: selectedPresetId ? '#0f172a' : '#94a3b8',
        }}
      >
        <option value="">Select location...</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name} — {loc.address}
          </option>
        ))}
        <option value="__other__">Other — enter address manually</option>
      </select>

      {isOther && (
        <input
          type="text"
          placeholder="Enter full address..."
          value={customAddress}
          onChange={(e) => onCustomChange(e.target.value)}
          style={{
            width: '100%',
            marginTop: '0.5rem',
            padding: '0.6rem 0.75rem',
            border: '1.5px solid #e2e8f0',
            borderRadius: 8,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      )}

      {!isOther && selectedPresetId && (
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          {locations.find((l) => l.id === selectedPresetId)?.address ?? ''}
        </p>
      )}
    </div>
  );
}

// 4-step progress bar
function StepBar({ step }: { step: number }) {
  const steps = ['Transport Type', 'Pickup & Drop', 'Available Vehicles', 'Review'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '2rem' }}>
      {steps.map((s, i) => {
        const num = i + 1;
        const active = num === step;
        const done = num < step;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: done ? '#059669' : active ? '#2563eb' : '#e2e8f0',
                  color: done || active ? '#fff' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {done ? '✓' : num}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: active ? '#2563eb' : done ? '#059669' : '#94a3b8',
                  whiteSpace: 'nowrap',
                }}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? '#059669' : '#e2e8f0',
                  margin: '0 0.5rem',
                  marginBottom: 20,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const TRANSPORT_OPTIONS = [
  { type: 'PERSON' as const, icon: '👤', title: 'Person', desc: 'Passenger transport only' },
  { type: 'PERSON_WITH_MATERIAL' as const, icon: '👤📦', title: 'Person + Material', desc: 'Passengers and cargo' },
  { type: 'MATERIAL_ONLY' as const, icon: '📦', title: 'Material Only', desc: 'Cargo / goods transport' },
];

export function NewBookingPage() {
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(1);
  const [transportType, setTransportType] = useState<TransportType | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [materialDescription, setMaterialDescription] = useState('');
  const [pickupPresetId, setPickupPresetId] = useState('');
  const [pickupCustom, setPickupCustom] = useState('');
  const [dropoffPresetId, setDropoffPresetId] = useState('');
  const [dropoffCustom, setDropoffCustom] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [preferredVehicleId, setPreferredVehicleId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: locations = [] } = useQuery<PresetLocation[]>({
    queryKey: ['fleet-locations'],
    queryFn: () => api.get<PresetLocation[]>('/fleet/locations?activeOnly=true').then((r) => r.data),
  });

  // Resolved pickup preset ID (null when step < 3 or custom address)
  const pickupPresetParam =
    pickupPresetId && pickupPresetId !== '__other__' ? pickupPresetId : undefined;

  const { data: availableVehicles = [], isLoading: vehiclesLoading } = useQuery<AvailableVehicle[]>({
    queryKey: ['available-with-driver', pickupPresetParam],
    queryFn: () => {
      const url = pickupPresetParam
        ? `/fleet/vehicles/available-with-driver?pickupPresetId=${pickupPresetParam}`
        : '/fleet/vehicles/available-with-driver';
      return api.get<AvailableVehicle[]>(url).then((r) => r.data);
    },
    enabled: step === 3,
    staleTime: 60_000,
  });

  // Step 13/14: Reset vehicle preference whenever pickup location changes so a stale
  // selection from a previous pickup is never silently carried forward.
  useEffect(() => {
    setPreferredVehicleId(null);
  }, [pickupPresetId]);

  const createBooking = useMutation({
    mutationFn: (body: object) => api.post('/bookings', body),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/employee/history'), 1800);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join('; ') : typeof msg === 'string' ? msg : 'Failed to submit booking');
    },
  });

  const handleSubmit = () => {
    if (!transportType || !dateValue || !timeValue) return;
    const requestedAt = new Date(`${dateValue}T${timeValue}:00`).toISOString();

    const body: Record<string, unknown> = { transportType, requestedAt };

    if (transportType !== 'MATERIAL_ONLY') body.passengerCount = passengerCount;
    if (transportType !== 'PERSON' && materialDescription) body.materialDescription = materialDescription;

    if (pickupPresetId && pickupPresetId !== '__other__') {
      body.pickupPresetId = pickupPresetId;
    } else {
      body.pickupCustomAddress = pickupCustom;
    }

    if (dropoffPresetId && dropoffPresetId !== '__other__') {
      body.dropoffPresetId = dropoffPresetId;
    } else {
      body.dropoffCustomAddress = dropoffCustom;
    }

    if (preferredVehicleId) body.preferredVehicleId = preferredVehicleId;

    createBooking.mutate(body);
  };

  const pickupLabel =
    pickupPresetId && pickupPresetId !== '__other__'
      ? (locations.find((l) => l.id === pickupPresetId)?.name ?? pickupPresetId)
      : pickupCustom || '(not set)';

  const dropoffLabel =
    dropoffPresetId && dropoffPresetId !== '__other__'
      ? (locations.find((l) => l.id === dropoffPresetId)?.name ?? dropoffPresetId)
      : dropoffCustom || '(not set)';

  const vehicleLabel = preferredVehicleId
    ? availableVehicles.find((v) => v.id === preferredVehicleId)?.vehicleNo ?? 'Selected'
    : 'No preference';

  // Step 2 validation
  const step2Valid =
    (pickupPresetId && pickupPresetId !== '__other__') ||
    (pickupPresetId === '__other__' && pickupCustom.trim().length > 2);
  const step2DropValid =
    (dropoffPresetId && dropoffPresetId !== '__other__') ||
    (dropoffPresetId === '__other__' && dropoffCustom.trim().length > 2);

  if (success) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>Booking submitted!</h2>
        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Redirecting to your bookings...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>
        New Booking Request
      </h1>

      <StepBar step={step} />

      <div
        style={{
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 12,
          padding: '1.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}
      >
        {/* ── Step 1: Transport Type ── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
              What do you need to transport?
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {TRANSPORT_OPTIONS.map((opt) => (
                <div
                  key={opt.type}
                  onClick={() => setTransportType(opt.type)}
                  style={{
                    padding: '1rem 1.25rem',
                    border: '2px solid',
                    borderColor: transportType === opt.type ? '#2563eb' : '#e2e8f0',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: transportType === opt.type ? '#eff6ff' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '1.75rem' }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{opt.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                  {transportType === opt.type && (
                    <span style={{ fontSize: 18, color: '#2563eb', fontWeight: 800 }}>✓</span>
                  )}
                </div>
              ))}
            </div>

            {transportType && transportType !== 'MATERIAL_ONLY' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Number of passengers
                </label>
                <select
                  value={passengerCount}
                  onChange={(e) => setPassengerCount(parseInt(e.target.value))}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 14,
                    background: '#fff',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} passenger{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {transportType && transportType !== 'PERSON' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Material description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Lab equipment — 3 cartons, approx 50 kg"
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    fontSize: 14,
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep(2)}
                disabled={!transportType}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: transportType ? 'pointer' : 'not-allowed',
                  opacity: transportType ? 1 : 0.5,
                }}
              >
                Next: Pickup &amp; Drop
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Pickup & Drop + Date/Time ── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
              Where to and from?
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <LocationPicker
                label="Pickup Location"
                locations={locations}
                selectedPresetId={pickupPresetId}
                customAddress={pickupCustom}
                onPresetChange={setPickupPresetId}
                onCustomChange={setPickupCustom}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: 18, color: '#94a3b8' }}>↓</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>
              <LocationPicker
                label="Dropoff Location"
                locations={locations}
                selectedPresetId={dropoffPresetId}
                customAddress={dropoffCustom}
                onPresetChange={setDropoffPresetId}
                onCustomChange={setDropoffCustom}
              />
            </div>

            {/* Date & Time */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>
                🕐 When do you need the vehicle?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Date</span>
                  <input
                    type="date"
                    value={dateValue}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDateValue(e.target.value)}
                    style={{ padding: '0.6rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Time</span>
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    style={{ padding: '0.6rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#f1f5f9',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!step2Valid || !step2DropValid || !dateValue || !timeValue}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  opacity: (!step2Valid || !step2DropValid || !dateValue || !timeValue) ? 0.5 : 1,
                }}
              >
                Next: Available Vehicles
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Available Vehicles ── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              Select vehicle preference
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: '1.25rem' }}>
              {pickupPresetParam
                ? `Showing vehicles whose driver is currently at your pickup location.`
                : 'Choose a vehicle with an assigned driver, or proceed without a preference.'}
            </p>

            {/* ── No Preference — ALWAYS shown first (Step 14: safe fallback) ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1rem' }}>
              <div
                onClick={() => setPreferredVehicleId(null)}
                style={{
                  padding: '0.875rem 1.125rem',
                  border: '2px solid',
                  borderColor: preferredVehicleId === null ? '#2563eb' : '#e2e8f0',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: preferredVehicleId === null ? '#eff6ff' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🔀</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: preferredVehicleId === null ? '#2563eb' : '#0f172a' }}>
                    No Preference
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Admin will assign the best available vehicle</div>
                </div>
                {preferredVehicleId === null && (
                  <span style={{ fontSize: 16, color: '#2563eb', fontWeight: 800 }}>✓</span>
                )}
              </div>

              {vehiclesLoading && (
                <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>Loading available vehicles...</div>
              )}

              {/* Step 13/14: context-aware empty state — No Preference stays selected */}
              {!vehiclesLoading && availableVehicles.length === 0 && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 10,
                    padding: '1rem 1.25rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    {pickupPresetParam
                      ? `No vehicles available at this pickup location`
                      : 'No vehicles currently available'}
                  </div>
                  <div style={{ fontSize: 13, color: '#92400e' }}>
                    {pickupPresetParam
                      ? `No driver is currently stationed at ${locations.find(l => l.id === pickupPresetParam)?.name ?? 'this pickup'}. "No Preference" is selected — admin will assign the best vehicle.`
                      : 'No drivers have set their location yet. You can still submit your booking — admin will assign a vehicle.'}
                  </div>
                </div>
              )}

              {availableVehicles.map((v) => {
                const driverLocation =
                  v.currentDriver?.currentLocationPreset?.name ??
                  v.currentDriver?.currentLocationText ??
                  null;
                return (
                  <div
                    key={v.id}
                    onClick={() => setPreferredVehicleId(v.id)}
                    style={{
                      padding: '0.875rem 1.125rem',
                      border: '2px solid',
                      borderColor: preferredVehicleId === v.id ? '#2563eb' : '#e2e8f0',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: preferredVehicleId === v.id ? '#eff6ff' : '#fff',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.875rem',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem', marginTop: 2 }}>🚙</span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 15, fontWeight: 700, color: preferredVehicleId === v.id ? '#2563eb' : '#0f172a' }}
                      >
                        {v.vehicleNo}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {v.type.replace(/_/g, ' ')}{v.make ? ` · ${v.make}` : ''}
                      </div>
                      {v.currentDriver && (
                        <>
                          <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontWeight: 600 }}>
                            👤 {v.currentDriver.user.name}
                          </div>
                          {driverLocation && (
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              📍 {driverLocation}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {preferredVehicleId === v.id && (
                      <span style={{ fontSize: 16, color: '#2563eb', fontWeight: 800 }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#f1f5f9',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Next: Review
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Submit ── */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
              Review & confirm your booking
            </h2>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '1rem 1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#64748b',
                  marginBottom: '0.625rem',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Booking Summary
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <SummaryRow label="Transport" value={transportType?.replace(/_/g, ' ') ?? ''} />
                {transportType !== 'MATERIAL_ONLY' && <SummaryRow label="Passengers" value={String(passengerCount)} />}
                {materialDescription && <SummaryRow label="Material" value={materialDescription} />}
                <SummaryRow label="Pickup" value={pickupLabel} />
                <SummaryRow label="Dropoff" value={dropoffLabel} />
                {dateValue && timeValue && (
                  <SummaryRow label="Requested" value={`${dateValue} at ${timeValue}`} />
                )}
                <SummaryRow label="Vehicle" value={vehicleLabel} />
              </div>
            </div>

            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '0.75rem 1rem',
                fontSize: 13,
                color: '#1d4ed8',
                marginBottom: '1rem',
              }}
            >
              Your request will be reviewed by an admin. Once approved, a driver will be assigned and you'll be notified.
            </div>

            {submitError && (
              <p style={{ color: '#dc2626', fontSize: 13, marginBottom: '0.75rem' }}>{submitError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setStep(3)}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#f1f5f9',
                  color: '#374151',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={createBooking.isPending || !dateValue || !timeValue}
                style={{
                  padding: '0.6rem 1.75rem',
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  opacity: (!dateValue || !timeValue) ? 0.5 : 1,
                }}
              >
                {createBooking.isPending ? 'Submitting...' : 'Submit Booking Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: 13 }}>
      <span style={{ fontWeight: 600, color: '#374151', minWidth: 90 }}>{label}:</span>
      <span style={{ color: '#0f172a' }}>{value}</span>
    </div>
  );
}
