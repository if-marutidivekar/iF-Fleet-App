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

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'VAN', 'TRUCK', 'BUS'];
const OWNERSHIP_TYPES = ['OWNED', 'LEASED', 'HIRED'];

function VehiclesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicleNo: '', type: 'SEDAN', make: '', model: '', year: '', capacity: '4', ownership: 'OWNED' });
  const [formError, setFormError] = useState('');

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ['fleet-vehicles'],
    queryFn: () => api.get<Vehicle[]>('/fleet/vehicles').then((r) => r.data),
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
                  style={{ padding: '0.4rem 0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Type</span>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} style={{ padding: '0.4rem 0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Ownership</span>
              <select value={form.ownership} onChange={(e) => setForm((p) => ({ ...p, ownership: e.target.value }))} style={{ padding: '0.4rem 0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, background: '#fff' }}>
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
                {['Vehicle No', 'Type', 'Make / Model', 'Capacity', 'Ownership', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, i) => (
                <tr key={v.id} style={{ borderBottom: i < vehicles.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{v.vehicleNo}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{v.type}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{v.capacity}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#64748b' }}>{v.ownership}</td>
                  <td style={{ padding: '0.625rem 0.875rem' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: vehicleStatusColor[v.status] ?? '#64748b' }}>{v.status}</span>
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem' }}>
                    {v.status === 'AVAILABLE' && (
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
              ))}
              {vehicles.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No vehicles registered</td></tr>
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
  const [form, setForm] = useState({ userId: '', licenseNumber: '', licenseExpiry: '' });
  const [formError, setFormError] = useState('');

  const { data: drivers = [], isLoading } = useQuery<DriverProfile[]>({
    queryKey: ['fleet-drivers'],
    queryFn: () => api.get<DriverProfile[]>('/fleet/drivers').then((r) => r.data),
  });

  const createDriver = useMutation({
    mutationFn: (data: typeof form) => api.post('/fleet/drivers', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fleet-drivers'] });
      setShowForm(false);
      setForm({ userId: '', licenseNumber: '', licenseExpiry: '' });
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
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: '0.75rem' }}>User must exist. Copy the User ID from the Users page.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem' }}>
            {([
              { label: 'User ID (UUID)', key: 'userId', placeholder: 'user-uuid', type: 'text' },
              { label: 'License Number', key: 'licenseNumber', placeholder: 'MH1220240012345', type: 'text' },
              { label: 'License Expiry', key: 'licenseExpiry', placeholder: '', type: 'date' },
            ] as { label: string; key: string; placeholder: string; type: string }[]).map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{f.label}</span>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key as keyof typeof form]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} style={{ padding: '0.4rem 0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
              </label>
            ))}
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: '0.5rem' }}>{formError}</p>}
          <button onClick={() => createDriver.mutate(form)} disabled={createDriver.isPending || !form.userId || !form.licenseNumber || !form.licenseExpiry} style={{ marginTop: '0.875rem', padding: '0.45rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
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
                {['Driver Name', 'Employee ID', 'License No', 'Expiry', 'Shift Ready', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < drivers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{d.user.name}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{d.user.employeeId}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151' }}>{d.licenseNumber}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 12, color: '#64748b' }}>{new Date(d.licenseExpiry).toLocaleDateString()}</td>
                  <td style={{ padding: '0.625rem 0.875rem' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: d.shiftReady ? '#059669' : '#94a3b8' }}>{d.shiftReady ? 'Yes' : 'No'}</span>
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem' }}>
                    <button onClick={() => toggleShiftReady.mutate({ id: d.id, shiftReady: !d.shiftReady })} style={{ padding: '0.2rem 0.5rem', background: d.shiftReady ? '#fef2f2' : '#f0fdf4', color: d.shiftReady ? '#dc2626' : '#059669', border: `1px solid ${d.shiftReady ? '#fecaca' : '#bbf7d0'}`, borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {d.shiftReady ? 'Mark Off-Shift' : 'Mark Ready'}
                    </button>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No driver profiles</td></tr>
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
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['fleet-locations-all'] }); void qc.invalidateQueries({ queryKey: ['fleet-locations'] }); },
  });

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
                <input type="text" placeholder={f.placeholder} value={form[f.key as keyof typeof form]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} style={{ padding: '0.4rem 0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
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
                <tr key={loc.id} style={{ borderBottom: i < locations.length - 1 ? '1px solid #f1f5f9' : 'none', opacity: loc.isActive ? 1 : 0.55 }}>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{loc.name}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 13, color: '#374151', maxWidth: 280 }}>{loc.address}</td>
                  <td style={{ padding: '0.625rem 0.875rem', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {loc.latitude && loc.longitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : '—'}
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: loc.isActive ? '#059669' : '#94a3b8' }}>{loc.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '0.625rem 0.875rem' }}>
                    <button onClick={() => toggleActive.mutate({ id: loc.id, isActive: !loc.isActive })} style={{ padding: '0.2rem 0.5rem', background: loc.isActive ? '#fef2f2' : '#f0fdf4', color: loc.isActive ? '#dc2626' : '#059669', border: `1px solid ${loc.isActive ? '#fecaca' : '#bbf7d0'}`, borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {loc.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
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
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>
        Fleet Master Data
      </h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <TabBtn label="Vehicles" active={activeTab === 'vehicles'} onClick={() => setActiveTab('vehicles')} />
        <TabBtn label="Drivers" active={activeTab === 'drivers'} onClick={() => setActiveTab('drivers')} />
        <TabBtn label="Preset Locations" active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} />
      </div>

      {activeTab === 'vehicles' && <VehiclesTab />}
      {activeTab === 'drivers' && <DriversTab />}
      {activeTab === 'locations' && <LocationsTab />}
    </div>
  );
}
