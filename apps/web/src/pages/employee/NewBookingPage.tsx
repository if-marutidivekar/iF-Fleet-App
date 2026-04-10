import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface PresetLocation {
  id: string;
  name: string;
  address: string;
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

// Step indicator
function StepBar({ step }: { step: number }) {
  const steps = ['Transport Type', 'Pickup & Drop', 'Date & Time'];
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
              <span style={{ fontSize: 11, fontWeight: 600, color: active ? '#2563eb' : done ? '#059669' : '#94a3b8', whiteSpace: 'nowrap' }}>
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#059669' : '#e2e8f0', margin: '0 0.5rem', marginBottom: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const { data: locations = [] } = useQuery<PresetLocation[]>({
    queryKey: ['fleet-locations'],
    queryFn: () =>
      api.get<PresetLocation[]>('/fleet/locations?activeOnly=true').then((r) => r.data),
  });

  const createBooking = useMutation({
    mutationFn: (body: object) => api.post('/bookings', body),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => navigate('/employee/history'), 1800);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(typeof msg === 'string' ? msg : 'Failed to submit booking');
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
    <div style={{ padding: '2rem', maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>
        New Booking Request
      </h1>

      <StepBar step={step} />

      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>

        {/* Step 1: Transport Type */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
              What needs to be transported?
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {([
                { type: 'PERSON' as const, icon: '🧑', title: 'Persons', desc: 'Passenger transport only' },
                { type: 'PERSON_WITH_MATERIAL' as const, icon: '🧑📦', title: 'Persons + Material', desc: 'Passengers and cargo' },
                { type: 'MATERIAL_ONLY' as const, icon: '📦', title: 'Material Only', desc: 'Cargo / goods transport' },
              ]).map((opt) => (
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
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{opt.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                  </div>
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
                  style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#fff' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} passenger{n > 1 ? 's' : ''}</option>
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
                  placeholder="e.g. Lab equipment — 3 cartons, approx 50kg"
                  value={materialDescription}
                  onChange={(e) => setMaterialDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep(2)}
                disabled={!transportType}
                style={{ padding: '0.6rem 1.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: transportType ? 'pointer' : 'not-allowed', opacity: transportType ? 1 : 0.5 }}
              >
                Next: Pickup &amp; Drop
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pickup & Drop */}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
              <button onClick={() => setStep(1)} style={{ padding: '0.6rem 1.25rem', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={
                  (!pickupPresetId || (pickupPresetId === '__other__' && !pickupCustom)) ||
                  (!dropoffPresetId || (dropoffPresetId === '__other__' && !dropoffCustom))
                }
                style={{
                  padding: '0.6rem 1.5rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  opacity: (!pickupPresetId || !dropoffPresetId) ? 0.5 : 1,
                }}
              >
                Next: Date &amp; Time
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Date & Time + Summary */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
              When do you need the vehicle?
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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

            {/* Summary */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
              </div>
            </div>

            {submitError && (
              <p style={{ color: '#dc2626', fontSize: 13, marginBottom: '0.75rem' }}>{submitError}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep(2)} style={{ padding: '0.6rem 1.25rem', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={createBooking.isPending || !dateValue || !timeValue}
                style={{ padding: '0.6rem 1.75rem', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (!dateValue || !timeValue) ? 0.5 : 1 }}
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
