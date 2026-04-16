import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PresetLocation {
  id: string;
  name: string;
  address: string;
}

interface DriverProfile {
  id: string;
  shiftReady: boolean;
  licenseNumber: string;
  currentLocationText?: string | null;
  locationUpdatedAt?: string | null;
  currentLocationPreset?: { id: string; name: string; address: string } | null;
  assignedVehicle?: {
    id: string;
    vehicleNo: string;
    type: string;
    make?: string | null;
    model?: string | null;
    status: string;
    currentDriverAssignedAt?: string | null;
  } | null;
}

interface AvailableVehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string | null;
  model?: string | null;
  capacity: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function badge(text: string, color: string) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        background: color + '1a',
        color,
        fontWeight: 700,
        fontSize: 12,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap' as const,
      }}
    >
      {text}
    </span>
  );
}

// ── Location modal ─────────────────────────────────────────────────────────────

function LocationModal({
  presets,
  onSave,
  onClose,
  saving,
}: {
  presets: PresetLocation[];
  onSave: (presetId: string | null, customAddress: string | null) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  const canSave =
    (mode === 'preset' && selectedPreset !== '') ||
    (mode === 'custom' && customAddress.trim().length > 2);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1.25rem', fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
          Set My Current Location
        </h2>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem' }}>
          {(['preset', 'custom'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                border: '1.5px solid',
                borderColor: mode === m ? '#2563eb' : '#e2e8f0',
                background: mode === m ? '#eff6ff' : '#fff',
                color: mode === m ? '#2563eb' : '#475569',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {m === 'preset' ? 'Preset Location' : 'Custom Address'}
            </button>
          ))}
        </div>

        {mode === 'preset' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
            {presets.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPreset(p.id)}
                style={{
                  padding: '0.75rem 1rem',
                  border: '2px solid',
                  borderColor: selectedPreset === p.id ? '#2563eb' : '#e2e8f0',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: selectedPreset === p.id ? '#eff6ff' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>📍</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: selectedPreset === p.id ? '#2563eb' : '#0f172a' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{p.address}</div>
                </div>
                {selectedPreset === p.id && (
                  <span style={{ fontSize: 16, color: '#2563eb', fontWeight: 800 }}>✓</span>
                )}
              </div>
            ))}
          </div>
        )}

        {mode === 'custom' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Enter address
            </label>
            <input
              type="text"
              autoFocus
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
              placeholder="e.g. Gate 4, Production Block C"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1.5px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box' as const,
                outline: 'none',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#475569',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!canSave || saving}
            onClick={() => {
              if (mode === 'preset') {
                onSave(selectedPreset, null);
              } else {
                onSave(null, customAddress.trim());
              }
            }}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: canSave && !saving ? '#2563eb' : '#94a3b8',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: canSave && !saving ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save Location'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function DriverFleetPage() {
  const qc = useQueryClient();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [selfAssignId, setSelfAssignId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile>({
    queryKey: ['my-driver-profile'],
    queryFn: () => api.get<DriverProfile>('/fleet/drivers/me').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: presets = [] } = useQuery<PresetLocation[]>({
    queryKey: ['fleet-locations'],
    queryFn: () => api.get<PresetLocation[]>('/fleet/locations?activeOnly=true').then((r) => r.data),
  });

  const { data: availableVehicles = [], isLoading: vehiclesLoading } = useQuery<AvailableVehicle[]>({
    queryKey: ['available-vehicles-driver'],
    queryFn: () => api.get<AvailableVehicle[]>('/fleet/vehicles/available').then((r) => r.data),
    enabled: !profile?.assignedVehicle,
  });

  const setLocation = useMutation({
    mutationFn: (body: { presetId?: string; customAddress?: string }) =>
      api.patch('/fleet/drivers/my-location', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-driver-profile'] });
      setShowLocationModal(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(typeof msg === 'string' ? msg : 'Failed to update location');
    },
  });

  const releaseVehicle = useMutation({
    mutationFn: (vehicleId: string) =>
      api.patch(`/fleet/vehicles/${vehicleId}/unassign-driver`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-driver-profile'] });
      void qc.invalidateQueries({ queryKey: ['available-vehicles-driver'] });
      setReleaseConfirm(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(typeof msg === 'string' ? msg : 'Failed to release vehicle');
    },
  });

  const selfAssign = useMutation({
    mutationFn: (vehicleId: string) =>
      api.patch(`/fleet/vehicles/${vehicleId}/self-assign`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-driver-profile'] });
      void qc.invalidateQueries({ queryKey: ['available-vehicles-driver'] });
      setSelfAssignId(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setActionError(typeof msg === 'string' ? msg : 'Failed to self-assign vehicle');
    },
  });

  const handleSaveLocation = (presetId: string | null, customAddress: string | null) => {
    setActionError('');
    if (presetId) {
      setLocation.mutate({ presetId });
    } else if (customAddress) {
      setLocation.mutate({ customAddress });
    }
  };

  const locationLabel =
    profile?.currentLocationPreset?.name ??
    profile?.currentLocationText ??
    null;

  if (profileLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading fleet info…
      </div>
    );
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 24px', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
        My Vehicle &amp; Fleet
      </h1>
      <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: 14 }}>
        View your assigned vehicle, update your location, and manage availability.
      </p>

      {actionError && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '0.75rem 1rem', color: '#dc2626', fontSize: 13, marginBottom: '1rem',
        }}>
          {actionError}
          <button onClick={() => setActionError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── My Vehicle card ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
          My Vehicle
        </h2>

        {!profile?.assignedVehicle ? (
          <div style={{
            background: '#fff',
            border: '1.5px dashed #e2e8f0',
            borderRadius: 12,
            padding: '2rem',
            textAlign: 'center',
            color: '#94a3b8',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚙</div>
            <p style={{ fontWeight: 600, color: '#475569', margin: '0 0 4px' }}>No vehicle assigned</p>
            <p style={{ fontSize: 13, margin: 0 }}>Admin hasn't assigned you a vehicle, or you can self-assign below.</p>
          </div>
        ) : (
          <div style={{
            background: '#fff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
          }}>
            {/* Vehicle header */}
            <div style={{ background: '#eff6ff', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>🚗</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                  {profile.assignedVehicle.vehicleNo}
                </div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  {profile.assignedVehicle.type.replace(/_/g, ' ')}
                  {profile.assignedVehicle.make ? ` · ${profile.assignedVehicle.make}` : ''}
                  {profile.assignedVehicle.model ? ` ${profile.assignedVehicle.model}` : ''}
                </div>
              </div>
              {badge('MY VEHICLE', '#2563eb')}
            </div>

            {/* Location section */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                    Current Location
                  </div>
                  {locationLabel ? (
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginTop: 4 }}>
                      📍 {locationLabel}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 14, color: '#d97706', fontWeight: 600 }}>
                        ⚠️ Location not set
                      </span>
                    </div>
                  )}
                  {profile.locationUpdatedAt && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Updated {new Date(profile.locationUpdatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setShowLocationModal(true); setActionError(''); }}
                  style={{
                    padding: '7px 16px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {locationLabel ? 'Update Location' : 'Set Location'}
                </button>
              </div>
            </div>

            {/* Release vehicle — blocked while a trip is active (Step 5) */}
            <div style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {profile.assignedVehicle.status === 'IN_TRIP' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>🚦 Trip in progress</span>
                  <span style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 10px' }}>
                    Cannot leave vehicle during an active trip
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Leave this vehicle? It will become available to other drivers.
                  </div>
                  {releaseConfirm ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          setActionError('');
                          releaseVehicle.mutate(profile.assignedVehicle!.id);
                        }}
                        disabled={releaseVehicle.isPending}
                        style={{
                          padding: '6px 14px',
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 7,
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {releaseVehicle.isPending ? 'Releasing…' : 'Confirm Release'}
                      </button>
                      <button
                        onClick={() => setReleaseConfirm(false)}
                        style={{
                          padding: '6px 14px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: 7,
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReleaseConfirm(true)}
                      style={{
                        padding: '6px 16px',
                        background: '#fff',
                        color: '#dc2626',
                        border: '1px solid #dc2626',
                        borderRadius: 7,
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Leave Vehicle
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Available vehicles (only when no vehicle assigned) ── */}
      {!profile?.assignedVehicle && (
        <div>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            Available Vehicles
          </h2>

          {!profile?.shiftReady && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 10,
              padding: '0.75rem 1rem',
              fontSize: 13,
              color: '#92400e',
              marginBottom: '1rem',
            }}>
              <strong>Shift-Ready required.</strong> Your profile is not marked shift-ready. Contact an admin to enable it before self-assigning.
            </div>
          )}

          {vehiclesLoading && (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Loading available vehicles…</div>
          )}

          {!vehiclesLoading && availableVehicles.length === 0 && (
            <div style={{
              background: '#fff',
              border: '1.5px dashed #e2e8f0',
              borderRadius: 12,
              padding: '2rem',
              textAlign: 'center',
              color: '#94a3b8',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🅿️</div>
              <p style={{ fontWeight: 600, color: '#475569', margin: '0 0 4px' }}>No available vehicles</p>
              <p style={{ fontSize: 13, margin: 0 }}>All vehicles are currently assigned. Check back later.</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {availableVehicles.map((v) => (
              <div
                key={v.id}
                style={{
                  background: '#fff',
                  border: '1.5px solid',
                  borderColor: selfAssignId === v.id ? '#2563eb' : '#e2e8f0',
                  borderRadius: 12,
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                }}
              >
                <span style={{ fontSize: '1.75rem' }}>🚙</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{v.vehicleNo}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {v.type.replace(/_/g, ' ')}
                    {v.make ? ` · ${v.make}` : ''}
                    {v.model ? ` ${v.model}` : ''}
                    {' · '}Capacity {v.capacity}
                  </div>
                  {badge('AVAILABLE', '#059669')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {selfAssignId === v.id ? (
                    <>
                      <button
                        onClick={() => {
                          setActionError('');
                          selfAssign.mutate(v.id);
                        }}
                        disabled={selfAssign.isPending || !profile?.shiftReady}
                        style={{
                          padding: '7px 16px',
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        {selfAssign.isPending ? 'Assigning…' : 'Confirm Assign'}
                      </button>
                      <button
                        onClick={() => setSelfAssignId(null)}
                        style={{
                          padding: '5px 12px',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelfAssignId(v.id)}
                      disabled={!profile?.shiftReady}
                      style={{
                        padding: '7px 16px',
                        background: profile?.shiftReady ? '#059669' : '#94a3b8',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: profile?.shiftReady ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      Take This Vehicle
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location modal */}
      {showLocationModal && (
        <LocationModal
          presets={presets}
          onSave={handleSaveLocation}
          onClose={() => setShowLocationModal(false)}
          saving={setLocation.isPending}
        />
      )}
    </div>
  );
}
