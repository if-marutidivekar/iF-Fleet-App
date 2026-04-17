import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string;
  model?: string;
  year?: number;
  capacity: number;
  ownership: string;
  status: string;
  currentDriverId?: string | null;
  currentDriverAssignedAt?: string | null;
  currentDriver?: {
    id: string;
    currentLocationText?: string | null;
    locationUpdatedAt?: string | null;
    currentLocationPreset?: { id: string; name: string } | null;
    user: { id: string; name: string; email: string; mobileNumber?: string | null };
  } | null;
  // Last booking assignment — used as location fallback (Step 12)
  assignments?: Array<{ booking: { pickupLabel?: string | null } | null }>;
}

interface DriverProfile {
  id: string;
  licenseNumber: string;
  licenseExpiry: string;
  shiftReady: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    employeeId: string;
    mobileNumber?: string;
  };
}

interface PresetLocation {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
}

interface UserBasic {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  hasDriverProfile: boolean;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.625rem 1.25rem',
        background: active ? '#2563eb' : '#fff',
        color: active ? '#fff' : '#374151',
        border: '1.5px solid',
        borderColor: active ? '#2563eb' : '#e2e8f0',
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

const vehicleStatusColor: Record<string, string> = {
  AVAILABLE: '#059669',
  ASSIGNED: '#2563eb',
  IN_TRIP: '#d97706',
  MAINTENANCE: '#dc2626',
  INACTIVE: '#94a3b8',
};

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  border: '1.5px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  border: '1.5px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
};

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────

/** Compute vehicle's effective current location for the Fleet Master table.
 *  Priority: (1) driver's set location preset, (2) driver's free-text, (3) last booking pickup, (4) —
 */
function getVehicleCurrentLocation(v: Vehicle): string {
  if (v.currentDriver?.currentLocationPreset?.name) return v.currentDriver.currentLocationPreset.name;
  if (v.currentDriver?.currentLocationText) return v.currentDriver.currentLocationText;
  const lastPickup = v.assignments?.[0]?.booking?.pickupLabel;
  if (lastPickup) return lastPickup;
  return '—';
}

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'VAN', 'TRUCK', 'BUS'];
const OWNERSHIP_TYPES = ['OWNED', 'LEASED', 'HIRED'];
const VEHICLE_STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_TRIP', 'MAINTENANCE', 'INACTIVE'];

function VehiclesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleNo: '', type: 'SEDAN', make: '', model: '', year: '', capacity: '4', ownership: 'OWNED' });
  const [formError, setFormError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ make: '', model: '', year: '', capacity: '', ownership: 'OWNED', status: 'AVAILABLE', type: 'SEDAN' });
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignDriverProfileId, setAssignDriverProfileId] = useState('');
  const [assignError, setAssignError] = useState('');

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ['fleet-vehicles'],
    queryFn: () => api.get<Vehicle[]>('/fleet/vehicles').then((r) => r.data),
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ['fleet-drivers'],
    queryFn: () => api.get<DriverProfile[]>('/fleet/drivers').then((r) => r.data),
  });

  const assignDriverMutation = useMutation({
    mutationFn: ({ vehicleId, driverProfileId }: { vehicleId: string; driverProfileId: string }) =>
      api.patch(`/fleet/vehicles/${vehicleId}/assign-driver`, { driverProfileId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      setAssigningId(null);
      setAssignDriverProfileId('');
      setAssignError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAssignError(typeof msg === 'string' ? msg : 'Failed to assign driver');
    },
  });

  const unassignDriverMutation = useMutation({
    mutationFn: (vehicleId: string) => api.patch(`/fleet/vehicles/${vehicleId}/unassign-driver`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(typeof msg === 'string' ? msg : 'Failed to unassign driver');
    },
  });

  const createVehicle = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/fleet/vehicles', { ...data, year: data.year ? parseInt(data.year) : undefined, capacity: parseInt(data.capacity) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      setShowForm(false);
      setForm({ vehicleNo: '', type: 'SEDAN', make: '', model: '', year: '', capacity: '4', ownership: 'OWNED' });
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(typeof msg === 'string' ? msg : 'Failed to create vehicle');
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/fleet/vehicles/${id}`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }),
  });

  const editVehicle = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.patch(`/fleet/vehicles/${id}`, {
        ...data,
        year: data.year ? parseInt(data.year) : undefined,
        capacity: data.capacity ? parseInt(data.capacity) : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      setEditId(null);
    },
  });

  const startEdit = (v: Vehicle) => {
    setEditId(v.id);
    setEditForm({
      make: v.make ?? '',
      model: v.model ?? '',
      year: v.year ? String(v.year) : '',
      capacity: String(v.capacity),
      ownership: v.ownership,
      status: v.status,
      type: v.type,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add Vehicle'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: '0.875rem', color: '#0f172a' }}>New Vehicle</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem' }}>
            {([
              { label: 'Vehicle No', key: 'vehicleNo', placeholder: 'MH-12-AB-1234' },
              { label: 'Make', key: 'make', placeholder: 'Toyota' },
              { label: 'Model', key: 'model', placeholder: 'Innova' },
              { label: 'Year', key: 'year', placeholder: '2022' },
              { label: 'Capacity (seats)', key: 'capacity', placeholder: '7' },
            ] as { label: string; key: string; placeholder: string }[]).map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{f.label}</span>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Type</span>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={selectStyle}>
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Ownership</span>
              <select value={form.ownership} onChange={(e) => setForm((p) => ({ ...p, ownership: e.target.value }))} style={selectStyle}>
                {OWNERSHIP_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: '0.5rem' }}>{formError}</p>}
          <button onClick={() => createVehicle.mutate(form)} disabled={createVehicle.isPending || !form.vehicleNo} style={{ marginTop: '0.875rem', padding: '0.45rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {createVehicle.isPending ? 'Creating...' : 'Create Vehicle'}
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {['Vehicle No', 'Type', 'Make / Model', 'Capacity', 'Ownership', 'Current Location', 'Status', 'Assigned Driver', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => (
                <>
                  <tr key={v.id} style={{ borderBottom: (editId === v.id || assigningId === v.id) ? 'none' : (i < vehicles.length - 1 ? '1px solid #f1f5f9' : 'none') }}>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{v.vehicleNo}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{v.type}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{v.capacity}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#64748b' }}>{v.ownership}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#374151', maxWidth: 180 }}>
                      {getVehicleCurrentLocation(v) === '—'
                        ? <span style={{ color: '#cbd5e1' }}>—</span>
                        : <span title={getVehicleCurrentLocation(v)}>{getVehicleCurrentLocation(v)}</span>}
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: vehicleStatusColor[v.status] ?? '#64748b' }}>{v.status}</span>
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 13 }}>
                      {v.currentDriver ? (
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{v.currentDriver.user.name}</div>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: 12 }}>No driver</span>
                      )}
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => { editId === v.id ? setEditId(null) : startEdit(v); setAssigningId(null); }}
                        style={{ padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {editId === v.id ? 'Cancel' : 'Edit'}
                      </button>
                      {!v.currentDriver ? (
                        <button
                          onClick={() => { setAssigningId(assigningId === v.id ? null : v.id); setAssignDriverProfileId(''); setAssignError(''); setEditId(null); }}
                          style={{ padding: '0.2rem 0.5rem', background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {assigningId === v.id ? 'Cancel' : 'Assign Driver'}
                        </button>
                      ) : v.status === 'IN_TRIP' ? (
                        <span title="Vehicle is on an active trip — cannot unassign now" style={{ padding: '0.2rem 0.5rem', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'not-allowed' }}>
                          In Trip
                        </span>
                      ) : (
                        <button
                          onClick={() => unassignDriverMutation.mutate(v.id)}
                          disabled={unassignDriverMutation.isPending}
                          style={{ padding: '0.2rem 0.5rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Unassign
                        </button>
                      )}
                      {v.status === 'AVAILABLE' && !v.currentDriver && (
                        <button onClick={() => updateStatus.mutate({ id: v.id, status: 'MAINTENANCE' })} style={{ padding: '0.2rem 0.5rem', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          Maintenance
                        </button>
                      )}
                      {v.status === 'MAINTENANCE' && (
                        <button onClick={() => updateStatus.mutate({ id: v.id, status: 'AVAILABLE' })} style={{ padding: '0.2rem 0.5rem', background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                  {assigningId === v.id && (
                    <tr key={`${v.id}-assign`} style={{ borderBottom: i < vehicles.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#f0fdf4' }}>
                      <td colSpan={9} style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, minWidth: 240 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Select Shift-Ready Driver</span>
                            <select
                              value={assignDriverProfileId}
                              onChange={(e) => { setAssignDriverProfileId(e.target.value); setAssignError(''); }}
                              style={{ ...selectStyle, minWidth: 240 }}
                            >
                              <option value="">— Choose driver —</option>
                              {drivers.filter((d) => d.shiftReady).map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.user.name} ({d.user.employeeId ?? d.user.email})
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            onClick={() => assignDriverMutation.mutate({ vehicleId: v.id, driverProfileId: assignDriverProfileId })}
                            disabled={!assignDriverProfileId || assignDriverMutation.isPending}
                            style={{ padding: '0.4rem 1rem', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !assignDriverProfileId ? 0.5 : 1 }}
                          >
                            {assignDriverMutation.isPending ? 'Assigning…' : 'Confirm Assign'}
                          </button>
                          <button
                            onClick={() => { setAssigningId(null); setAssignDriverProfileId(''); setAssignError(''); }}
                            style={{ padding: '0.4rem 0.875rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                        {assignError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: '0.4rem' }}>{assignError}</p>}
                        {drivers.filter((d) => d.shiftReady).length === 0 && (
                          <p style={{ color: '#64748b', fontSize: 12, marginTop: '0.4rem' }}>
                            No shift-ready drivers available. Mark a driver as Ready in the Drivers tab first.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                  {editId === v.id && (
                    <tr key={`${v.id}-edit`} style={{ borderBottom: i < vehicles.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#f8fafc' }}>
                      <td colSpan={9} style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Make</span>
                            <input value={editForm.make} onChange={(e) => setEditForm((p) => ({ ...p, make: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Model</span>
                            <input value={editForm.model} onChange={(e) => setEditForm((p) => ({ ...p, model: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Year</span>
                            <input value={editForm.year} onChange={(e) => setEditForm((p) => ({ ...p, year: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Capacity</span>
                            <input value={editForm.capacity} onChange={(e) => setEditForm((p) => ({ ...p, capacity: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Type</span>
                            <select value={editForm.type} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))} style={selectStyle}>
                              {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Ownership</span>
                            <select value={editForm.ownership} onChange={(e) => setEditForm((p) => ({ ...p, ownership: e.target.value }))} style={selectStyle}>
                              {OWNERSHIP_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Status</span>
                            <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} style={selectStyle}>
                              {VEHICLE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                            </select>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem' }}>
                          <button
                            onClick={() => editVehicle.mutate({ id: v.id, data: editForm })}
                            disabled={editVehicle.isPending}
                            style={{ padding: '0.3rem 0.875rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {editVehicle.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            style={{ padding: '0.3rem 0.875rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {vehicles.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No vehicles registered</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Drivers Tab ──────────────────────────────────────────────────────────────

function DriversTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ licenseNumber: '', licenseExpiry: '' });
  const [formError, setFormError] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; name: string } | null>(null);
  const [editDriverId, setEditDriverId] = useState<string | null>(null);
  const [editDriverForm, setEditDriverForm] = useState({ licenseNumber: '', licenseExpiry: '', shiftReady: false });

  const { data: drivers = [], isLoading } = useQuery<DriverProfile[]>({
    queryKey: ['fleet-drivers'],
    queryFn: () => api.get<DriverProfile[]>('/fleet/drivers').then((r) => r.data),
  });

  const { data: allUsers = [] } = useQuery<UserBasic[]>({
    queryKey: ['all-users-for-driver'],
    queryFn: () => api.get<UserBasic[]>('/users').then((r) => r.data),
  });

  const createDriver = useMutation({
    mutationFn: (data: { userId: string; licenseNumber: string; licenseExpiry: string }) =>
      api.post('/fleet/drivers', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-drivers'] });
      setShowForm(false);
      setForm({ licenseNumber: '', licenseExpiry: '' });
      setDriverEmail('');
      setFoundUser(null);
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(typeof msg === 'string' ? msg : 'Failed to create driver profile');
    },
  });

  const toggleShiftReady = useMutation({
    mutationFn: ({ id, shiftReady }: { id: string; shiftReady: boolean }) => api.patch(`/fleet/drivers/${id}`, { shiftReady }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fleet-drivers'] }),
  });

  const editDriver = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editDriverForm }) =>
      api.patch(`/fleet/drivers/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-drivers'] });
      setEditDriverId(null);
    },
  });

  const handleEmailChange = (val: string) => {
    setDriverEmail(val);
    const match = allUsers.find((u) => u.email.toLowerCase() === val.toLowerCase());
    setFoundUser(match ? { id: match.id, name: match.name } : null);
  };

  const startEditDriver = (d: DriverProfile) => {
    setEditDriverId(d.id);
    setEditDriverForm({
      licenseNumber: d.licenseNumber,
      licenseExpiry: d.licenseExpiry.split('T')[0] ?? d.licenseExpiry,
      shiftReady: d.shiftReady,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add Driver Profile'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>New Driver Profile</h3>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: '0.75rem' }}>Type the user's email to look them up</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Email ID</span>
              <input
                type="email"
                placeholder="driver@ideaforgetech.com"
                value={driverEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                style={inputStyle}
              />
              {driverEmail && (
                <span style={{ fontSize: 11, fontWeight: 600, color: foundUser ? '#059669' : '#dc2626' }}>
                  {foundUser ? `✓ User found: ${foundUser.name}` : '✗ User not found'}
                </span>
              )}
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>License Number</span>
              <input
                type="text"
                placeholder="MH1220240012345"
                value={form.licenseNumber}
                onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>License Expiry</span>
              <input
                type="date"
                value={form.licenseExpiry}
                onChange={(e) => setForm((p) => ({ ...p, licenseExpiry: e.target.value }))}
                style={inputStyle}
              />
            </label>
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: '0.5rem' }}>{formError}</p>}
          <button
            onClick={() => {
              if (!foundUser) return;
              createDriver.mutate({ userId: foundUser.id, licenseNumber: form.licenseNumber, licenseExpiry: form.licenseExpiry });
            }}
            disabled={createDriver.isPending || !foundUser || !form.licenseNumber || !form.licenseExpiry}
            style={{ marginTop: '0.875rem', padding: '0.45rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: (!foundUser || !form.licenseNumber || !form.licenseExpiry) ? 0.5 : 1 }}
          >
            {createDriver.isPending ? 'Creating...' : 'Create Driver Profile'}
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {['Driver Name', 'Employee ID', 'Email', 'Phone', 'License No', 'Expiry', 'Shift Ready', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <>
                  <tr key={d.id} style={{ borderBottom: editDriverId === d.id ? 'none' : (i < drivers.length - 1 ? '1px solid #f1f5f9' : 'none') }}>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{d.user.name}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{d.user.employeeId}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{d.user.email}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#64748b' }}>{d.user.mobileNumber ?? '—'}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{d.licenseNumber}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#64748b' }}>{new Date(d.licenseExpiry).toLocaleDateString()}</td>
                    <td style={{ padding: '0.625rem 0.875rem' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: d.shiftReady ? '#059669' : '#94a3b8' }}>{d.shiftReady ? 'Yes' : 'No'}</span>
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => editDriverId === d.id ? setEditDriverId(null) : startEditDriver(d)}
                        style={{ padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {editDriverId === d.id ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={() => toggleShiftReady.mutate({ id: d.id, shiftReady: !d.shiftReady })}
                        style={{ padding: '0.2rem 0.5rem', background: d.shiftReady ? '#fef2f2' : '#f0fdf4', color: d.shiftReady ? '#dc2626' : '#059669', border: `1px solid ${d.shiftReady ? '#fecaca' : '#bbf7d0'}`, borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {d.shiftReady ? 'Mark Off-Shift' : 'Mark Ready'}
                      </button>
                    </td>
                  </tr>
                  {editDriverId === d.id && (
                    <tr key={`${d.id}-edit`} style={{ borderBottom: i < drivers.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#f8fafc' }}>
                      <td colSpan={8} style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>License Number</span>
                            <input value={editDriverForm.licenseNumber} onChange={(e) => setEditDriverForm((p) => ({ ...p, licenseNumber: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>License Expiry</span>
                            <input type="date" value={editDriverForm.licenseExpiry} onChange={(e) => setEditDriverForm((p) => ({ ...p, licenseExpiry: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Shift Ready</span>
                            <select value={editDriverForm.shiftReady ? 'true' : 'false'} onChange={(e) => setEditDriverForm((p) => ({ ...p, shiftReady: e.target.value === 'true' }))} style={selectStyle}>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem' }}>
                          <button
                            onClick={() => editDriver.mutate({ id: d.id, data: editDriverForm })}
                            disabled={editDriver.isPending}
                            style={{ padding: '0.3rem 0.875rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {editDriver.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditDriverId(null)}
                            style={{ padding: '0.3rem 0.875rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No driver profiles</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Locations Tab ────────────────────────────────────────────────────────────

function LocationsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '' });
  const [formError, setFormError] = useState('');
  const [editLocId, setEditLocId] = useState<string | null>(null);
  const [editLocForm, setEditLocForm] = useState({ name: '', address: '', latitude: '', longitude: '', isActive: true });

  const { data: locations = [], isLoading } = useQuery<PresetLocation[]>({
    queryKey: ['fleet-locations-all'],
    queryFn: () => api.get<PresetLocation[]>('/fleet/locations').then((r) => r.data),
  });

  const createLocation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/fleet/locations', { name: data.name, address: data.address, latitude: data.latitude ? parseFloat(data.latitude) : undefined, longitude: data.longitude ? parseFloat(data.longitude) : undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-locations-all'] });
      void qc.invalidateQueries({ queryKey: ['fleet-locations'] });
      setShowForm(false);
      setForm({ name: '', address: '', latitude: '', longitude: '' });
      setFormError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(typeof msg === 'string' ? msg : 'Failed to create location');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/fleet/locations/${id}`, { isActive }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-locations-all'] });
      void qc.invalidateQueries({ queryKey: ['fleet-locations'] });
    },
  });

  const editLocation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editLocForm }) =>
      api.patch(`/fleet/locations/${id}`, {
        name: data.name,
        address: data.address,
        latitude: data.latitude ? parseFloat(data.latitude) : undefined,
        longitude: data.longitude ? parseFloat(data.longitude) : undefined,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-locations-all'] });
      void qc.invalidateQueries({ queryKey: ['fleet-locations'] });
      setEditLocId(null);
    },
  });

  const startEditLoc = (loc: PresetLocation) => {
    setEditLocId(loc.id);
    setEditLocForm({
      name: loc.name,
      address: loc.address,
      latitude: loc.latitude ? String(loc.latitude) : '',
      longitude: loc.longitude ? String(loc.longitude) : '',
      isActive: loc.isActive,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ Add Location'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: '0.875rem', color: '#0f172a' }}>New Preset Location</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            {([
              { label: 'Name', key: 'name', placeholder: 'HQ Andheri' },
              { label: 'Address', key: 'address', placeholder: '123 Chakala, Andheri East, Mumbai' },
              { label: 'Latitude (optional)', key: 'latitude', placeholder: '19.1136' },
              { label: 'Longitude (optional)', key: 'longitude', placeholder: '72.8697' },
            ] as { label: string; key: string; placeholder: string }[]).map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{f.label}</span>
                <input type="text" placeholder={f.placeholder} value={form[f.key as keyof typeof form]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
              </label>
            ))}
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: '0.5rem' }}>{formError}</p>}
          <button onClick={() => createLocation.mutate(form)} disabled={createLocation.isPending || !form.name || !form.address} style={{ marginTop: '0.875rem', padding: '0.45rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {createLocation.isPending ? 'Creating...' : 'Create Location'}
          </button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {['Name', 'Address', 'Coordinates', 'Active', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => (
                <>
                  <tr key={loc.id} style={{ borderBottom: editLocId === loc.id ? 'none' : (i < locations.length - 1 ? '1px solid #f1f5f9' : 'none'), opacity: loc.isActive ? 1 : 0.55 }}>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{loc.name}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151', maxWidth: 280 }}>{loc.address}</td>
                    <td style={{ padding: '0.625rem 0.875rem', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                      {loc.latitude && loc.longitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : '—'}
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: loc.isActive ? '#059669' : '#94a3b8' }}>{loc.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => editLocId === loc.id ? setEditLocId(null) : startEditLoc(loc)}
                        style={{ padding: '0.2rem 0.5rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {editLocId === loc.id ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={() => toggleActive.mutate({ id: loc.id, isActive: !loc.isActive })}
                        style={{ padding: '0.2rem 0.5rem', background: loc.isActive ? '#fef2f2' : '#f0fdf4', color: loc.isActive ? '#dc2626' : '#059669', border: `1px solid ${loc.isActive ? '#fecaca' : '#bbf7d0'}`, borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {loc.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                  {editLocId === loc.id && (
                    <tr key={`${loc.id}-edit`} style={{ borderBottom: i < locations.length - 1 ? '1px solid #f1f5f9' : 'none', background: '#f8fafc' }}>
                      <td colSpan={5} style={{ padding: '0.875rem 1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'end' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Name</span>
                            <input value={editLocForm.name} onChange={(e) => setEditLocForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Address</span>
                            <input value={editLocForm.address} onChange={(e) => setEditLocForm((p) => ({ ...p, address: e.target.value }))} style={inputStyle} />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Latitude</span>
                            <input value={editLocForm.latitude} onChange={(e) => setEditLocForm((p) => ({ ...p, latitude: e.target.value }))} style={inputStyle} placeholder="19.1136" />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Longitude</span>
                            <input value={editLocForm.longitude} onChange={(e) => setEditLocForm((p) => ({ ...p, longitude: e.target.value }))} style={inputStyle} placeholder="72.8697" />
                          </label>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: '#374151' }}>Active</span>
                            <select value={editLocForm.isActive ? 'true' : 'false'} onChange={(e) => setEditLocForm((p) => ({ ...p, isActive: e.target.value === 'true' }))} style={selectStyle}>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem' }}>
                          <button
                            onClick={() => editLocation.mutate({ id: loc.id, data: editLocForm })}
                            disabled={editLocation.isPending}
                            style={{ padding: '0.3rem 0.875rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {editLocation.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditLocId(null)}
                            style={{ padding: '0.3rem 0.875rem', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {locations.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No preset locations</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'vehicles' | 'drivers' | 'locations';

export function FleetMasterPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('vehicles');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Page title — fixed */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.5rem 0.75rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Fleet Master Data
          </h1>
        </div>
      </div>

      {/* Tab bar — fixed */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem 0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <TabBtn label="Vehicles" active={activeTab === 'vehicles'} onClick={() => setActiveTab('vehicles')} />
            <TabBtn label="Drivers" active={activeTab === 'drivers'} onClick={() => setActiveTab('drivers')} />
            <TabBtn label="Preset Locations" active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} />
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem 1.5rem' }}>
          {activeTab === 'vehicles' && <VehiclesTab />}
          {activeTab === 'drivers' && <DriversTab />}
          {activeTab === 'locations' && <LocationsTab />}
        </div>
      </div>
    </div>
  );
}
