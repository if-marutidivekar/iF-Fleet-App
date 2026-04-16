import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface Booking {
  id: string;
  bookingNo: number;
  transportType: string;
  passengerCount?: number;
  materialDescription?: string;
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
  requestedAt: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  requester: { id: string; name: string; email: string; employeeId: string };
  assignment?: {
    id: string;
    vehicle: { vehicleNo: string };
    driver: { user: { name: string } };
    decision: string;
  } | null;
}

interface Vehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string;
  model?: string;
  capacity: number;
  status: string;
}

interface DriverProfile {
  id: string;
  licenseNumber: string;
  shiftReady: boolean;
  user: { id: string; name: string; email: string; employeeId: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: '#d97706',
  APPROVED: '#2563eb',
  ASSIGNED: '#7c3aed',
  'ASSIGNED–PENDING': '#7c3aed',
  'ASSIGNED–ACCEPTED': '#059669',
  'ASSIGNED–DECLINED': '#dc2626',
  IN_TRIP: '#f97316',
  COMPLETED: '#059669',
  REJECTED: '#dc2626',
  CANCELLED: '#6b7280',
};

function getEffectiveStatus(booking: Booking): string {
  if (booking.status === 'ASSIGNED' && booking.assignment) {
    const d = booking.assignment.decision;
    if (d === 'PENDING') return 'ASSIGNED–PENDING';
    if (d === 'ACCEPTED') return 'ASSIGNED–ACCEPTED';
    if (d === 'DECLINED') return 'ASSIGNED–DECLINED';
  }
  return booking.status;
}

const TABS = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In Trip', value: 'IN_TRIP' },
  { label: 'Completed', value: 'COMPLETED' },
];

function StatusBadge({ booking }: { booking: Booking }) {
  const eff = getEffectiveStatus(booking);
  const color = STATUS_COLORS[eff] ?? '#64748b';
  return (
    <div>
      <span
        style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 12,
          background: color + '1a',
          color,
          fontWeight: 600,
          fontSize: 12,
          border: `1px solid ${color}44`,
          whiteSpace: 'nowrap',
        }}
      >
        {eff.replace(/_/g, ' ')}
      </span>
      {booking.status === 'REJECTED' && booking.rejectionReason && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{booking.rejectionReason}</div>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  vehicles,
  drivers,
}: {
  booking: Booking;
  vehicles: Vehicle[];
  drivers: DriverProfile[];
}) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignVehicle, setReassignVehicle] = useState('');
  const [reassignDriver, setReassignDriver] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${booking.id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings-admin'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${booking.id}/reject`, { rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings-admin'] });
      setRejecting(false);
      setRejectionReason('');
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      api.post('/assignments', {
        bookingId: booking.id,
        vehicleId: selectedVehicle,
        driverId: selectedDriver,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings-admin'] });
      setAssigning(false);
      setSelectedVehicle('');
      setSelectedDriver('');
    },
  });

  const reassignMutation = useMutation({
    mutationFn: () => api.patch(`/assignments/${booking.assignment?.id}/reassign`, { vehicleId: reassignVehicle, driverId: reassignDriver }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bookings-admin'] });
      setReassigning(false);
      setReassignVehicle('');
      setReassignDriver('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${booking.id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings-admin'] });
      setCancelling(false);
    },
  });

  const pickup = booking.pickupLabel || booking.pickupCustomAddress || '—';
  const dropoff = booking.dropoffLabel || booking.dropoffCustomAddress || '—';
  const availableVehicles = vehicles.filter((v) => v.status === 'AVAILABLE');
  const readyDrivers = drivers.filter((d) => d.shiftReady);

  return (
    <>
      <tr
        style={{
          borderBottom: '1px solid #f1f5f9',
          background: '#fff',
          verticalAlign: 'top',
        }}
      >
        {/* Booking No */}
        <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
          #{booking.bookingNo}
        </td>

        {/* Requester */}
        <td style={{ padding: '14px 16px', fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{booking.requester.name}</div>
          <div style={{ color: '#64748b', fontSize: 12 }}>{booking.requester.email}</div>
          {booking.requester.employeeId && (
            <div style={{ color: '#94a3b8', fontSize: 11 }}>#{booking.requester.employeeId}</div>
          )}
        </td>

        {/* Transport */}
        <td style={{ padding: '14px 16px', fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
          {booking.transportType}
          {booking.passengerCount != null && (
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              {booking.passengerCount} pax
            </div>
          )}
          {booking.materialDescription && (
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              {booking.materialDescription}
            </div>
          )}
        </td>

        {/* Route */}
        <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>
          <div>{pickup}</div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>→ {dropoff}</div>
        </td>

        {/* Requested At */}
        <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569', whiteSpace: 'nowrap' }}>
          {new Date(booking.requestedAt).toLocaleString()}
        </td>

        {/* Status */}
        <td style={{ padding: '14px 16px' }}>
          <StatusBadge booking={booking} />
        </td>

        {/* Assignment */}
        <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>
          {booking.assignment ? (
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                {booking.assignment.vehicle.vehicleNo}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {booking.assignment.driver.user.name}
              </div>
            </div>
          ) : (
            <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
          )}
        </td>

        {/* Actions */}
        <td style={{ padding: '14px 16px' }}>
          {booking.status === 'PENDING_APPROVAL' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  style={{
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {approveMutation.isPending ? '...' : 'Approve'}
                </button>
                <button
                  onClick={() => setRejecting((v) => !v)}
                  style={{
                    background: '#fff',
                    color: '#dc2626',
                    border: '1px solid #dc2626',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Reject
                </button>
              </div>
              {rejecting && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    type="text"
                    placeholder="Rejection reason..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 5,
                      fontSize: 12,
                      outline: 'none',
                      minWidth: 180,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => rejectMutation.mutate()}
                      disabled={rejectMutation.isPending || !rejectionReason.trim()}
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 10px',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        opacity: !rejectionReason.trim() ? 0.5 : 1,
                      }}
                    >
                      {rejectMutation.isPending ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => {
                        setRejecting(false);
                        setRejectionReason('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {booking.status === 'ASSIGNED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => { setReassigning((v) => !v); setCancelling(false); }}
                  style={{
                    background: '#f97316',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Reassign
                </button>
                <button
                  onClick={() => { setCancelling((v) => !v); setReassigning(false); }}
                  style={{
                    background: '#fff',
                    color: '#dc2626',
                    border: '1px solid #dc2626',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Cancel
                </button>
              </div>
              {cancelling && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#dc2626' }}>Cancel this booking?</span>
                  <button
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    {cancelMutation.isPending ? '...' : 'Confirm'}
                  </button>
                  <button onClick={() => setCancelling(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>No</button>
                </div>
              )}
              {reassigning && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200, marginTop: 6 }}>
                  <select
                    value={reassignVehicle}
                    onChange={(e) => setReassignVehicle(e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12, outline: 'none', background: '#fff' }}
                  >
                    <option value="">Select vehicle...</option>
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNo} — {v.type} {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                  <select
                    value={reassignDriver}
                    onChange={(e) => setReassignDriver(e.target.value)}
                    style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 12, outline: 'none', background: '#fff' }}
                  >
                    <option value="">Select driver...</option>
                    {readyDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.user.name} ({d.licenseNumber})
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => reassignMutation.mutate()}
                      disabled={reassignMutation.isPending || !reassignVehicle || !reassignDriver}
                      style={{
                        background: '#f97316',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 5,
                        padding: '5px 10px',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        opacity: !reassignVehicle || !reassignDriver ? 0.5 : 1,
                      }}
                    >
                      {reassignMutation.isPending ? '...' : 'Confirm Reassign'}
                    </button>
                    <button
                      onClick={() => setReassigning(false)}
                      style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                  {reassignMutation.isError && (
                    <div style={{ color: '#dc2626', fontSize: 11 }}>Reassign failed. Check availability.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {booking.status === 'APPROVED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => { setAssigning((v) => !v); setCancelling(false); }}
                  style={{
                    background: '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Assign
                </button>
                <button
                  onClick={() => { setCancelling((v) => !v); setAssigning(false); }}
                  style={{
                    background: '#fff',
                    color: '#dc2626',
                    border: '1px solid #dc2626',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Cancel
                </button>
              </div>
              {cancelling && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#dc2626' }}>Cancel this booking?</span>
                  <button
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    {cancelMutation.isPending ? '...' : 'Confirm'}
                  </button>
                  <button onClick={() => setCancelling(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>No</button>
                </div>
              )}
              {assigning && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                  <select
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 5,
                      fontSize: 12,
                      outline: 'none',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select vehicle...</option>
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNo} — {v.type} {v.make} {v.model} (cap: {v.capacity})
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 5,
                      fontSize: 12,
                      outline: 'none',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select driver...</option>
                    {readyDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.user.name} ({d.user.employeeId})
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => assignMutation.mutate()}
                      disabled={
                        assignMutation.isPending || !selectedVehicle || !selectedDriver
                      }
                      style={{
                        background: '#7c3aed',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 5,
                        padding: '5px 12px',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                        opacity: !selectedVehicle || !selectedDriver ? 0.5 : 1,
                      }}
                    >
                      {assignMutation.isPending ? '...' : 'Submit'}
                    </button>
                    <button
                      onClick={() => {
                        setAssigning(false);
                        setSelectedVehicle('');
                        setSelectedDriver('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {assignMutation.isError && (
                    <div style={{ color: '#dc2626', fontSize: 11 }}>Assignment failed. Try again.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </td>
      </tr>
    </>
  );
}

export function BookingQueuePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ALL');

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['bookings-admin'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      return res.data;
    },
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['fleet-vehicles'],
    queryFn: async () => {
      const res = await api.get('/fleet/vehicles');
      return res.data;
    },
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ['fleet-drivers'],
    queryFn: async () => {
      const res = await api.get('/fleet/drivers');
      return res.data;
    },
  });

  const filtered =
    activeTab === 'ALL'
      ? bookings
      : bookings.filter((b) => b.status === activeTab);

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 24px' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
          Booking Queue
        </h1>
        <button
          onClick={() => navigate('/employee/book')}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + New Booking
        </button>
      </div>

      {/* Tab filters */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          marginBottom: 16,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: 4,
          width: 'fit-content',
        }}
      >
        {TABS.map((tab) => {
          const count =
            tab.value === 'ALL'
              ? bookings.length
              : bookings.filter((b) => b.status === tab.value).length;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                background: isActive ? '#2563eb' : 'transparent',
                color: isActive ? '#fff' : '#475569',
                border: 'none',
                borderRadius: 7,
                padding: '6px 14px',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'background 0.15s',
              }}
            >
              {tab.label}
              <span
                style={{
                  background: isActive ? '#ffffff33' : '#e2e8f0',
                  color: isActive ? '#fff' : '#64748b',
                  borderRadius: 10,
                  padding: '0 7px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'auto',
        }}
      >
        {bookingsLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No bookings found for this filter.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {[
                  'Req #',
                  'Requester',
                  'Transport',
                  'Pickup → Dropoff',
                  'Requested At',
                  'Status',
                  'Assigned',
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                      borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  vehicles={vehicles}
                  drivers={drivers}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
