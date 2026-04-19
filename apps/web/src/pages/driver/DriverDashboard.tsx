import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface Assignment {
  id: string;
  decision: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  assignedAt: string;
  decisionAt?: string;
  booking: {
    bookingNo: number;
    transportType: string;
    pickupLabel?: string;
    pickupCustomAddress?: string;
    dropoffLabel?: string;
    dropoffCustomAddress?: string;
    requestedAt: string;
    status: string;
  };
  vehicle: { vehicleNo: string; type: string; make?: string; model?: string; capacity: number };
  driver: { shiftReady: boolean; licenseNumber: string };
  trip?: { id: string; status: string } | null;
}

interface DriverProfile {
  id: string;
  currentLocationText?: string | null;
  locationUpdatedAt?: string | null;
  currentLocationPreset?: { id: string; name: string } | null;
  assignedVehicle?: {
    id: string; vehicleNo: string; type: string;
    make?: string | null; model?: string | null;
  } | null;
}

/** Colors for the decision badge in the "Current / Next Assignment" preview */
const DECISION_COLORS: Record<string, string> = {
  PENDING: '#d97706',
  ACCEPTED: '#2563eb',
  DECLINED: '#dc2626',
};

const TRIP_ACTIVE_STATUSES = ['STARTED', 'IN_PROGRESS'];

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '20px 24px',
        flex: 1,
        minWidth: 140,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color }}>{count}</span>
    </div>
  );
}

export function DriverDashboard() {
  const navigate = useNavigate();

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments'],
    queryFn: async () => {
      const res = await api.get('/assignments');
      return res.data;
    },
  });

  const { data: profile } = useQuery<DriverProfile>({
    queryKey: ['my-driver-profile'],
    queryFn: () => api.get<DriverProfile>('/fleet/drivers/me').then((r) => r.data),
    retry: false,
  });

  // ── Dashboard counts aligned with booking/trip lifecycle ──────────────────
  const counts = {
    // Awaiting driver accept/decline — only ASSIGNED bookings (not yet accepted/declined)
    pending: assignments.filter(
      (a) => a.booking.status === 'ASSIGNED' && a.decision === 'PENDING',
    ).length,

    // Driver accepted; booking is ASSIGNED; trip has NOT started yet — ready to drive.
    // Count goes to 0 once trip starts (moves to In Progress) or completes.
    assigned: assignments.filter(
      (a) =>
        a.booking.status === 'ASSIGNED' &&
        a.decision === 'ACCEPTED' &&
        (!a.trip || !TRIP_ACTIVE_STATUSES.includes(a.trip.status)),
    ).length,

    // Trip is actively running (STARTED or IN_PROGRESS)
    inProgress: assignments.filter(
      (a) =>
        a.decision === 'ACCEPTED' &&
        a.trip != null &&
        TRIP_ACTIVE_STATUSES.includes(a.trip.status),
    ).length,

    // Trip completed OR driver declined (excluding requester-cancelled bookings)
    completedDeclined: assignments.filter(
      (a) =>
        a.booking.status === 'COMPLETED' ||
        (a.decision === 'DECLINED' && a.booking.status !== 'CANCELLED'),
    ).length,
  };

  // Current / Next Assignment: active items only (Steps 1-3, 6-7)
  // Only ASSIGNED (pre-trip) and IN_TRIP booking states qualify.
  // Excludes COMPLETED, DECLINED, CANCELLED — no historical items.
  const current = assignments
    .filter((a) =>
      (a.booking.status === 'ASSIGNED' || a.booking.status === 'IN_TRIP') &&
      (a.decision === 'PENDING' || a.decision === 'ACCEPTED'),
    )
    .sort((a, b) => {
      // Priority: IN_TRIP (3) > ACCEPTED pre-trip (2) > PENDING (1)
      const score = (x: typeof a): number => {
        if (x.trip && TRIP_ACTIVE_STATUSES.includes(x.trip.status)) return 3;
        if (x.booking.status === 'ASSIGNED' && x.decision === 'ACCEPTED') return 2;
        if (x.booking.status === 'ASSIGNED' && x.decision === 'PENDING') return 1;
        return 0;
      };
      return score(b) - score(a);
    })[0] ?? null;

  return (
    // Steps 6-10: Internal scroll layout
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Fixed page header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
              Driver Dashboard
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
              Manage your trip assignments.
            </p>
          </div>
          <button
            onClick={() => navigate('/driver/assignments')}
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
            Go to Trip Tracking
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px' }}>

        {/* My Vehicle Banner */}
        {profile !== undefined && (
          <div
            onClick={() => navigate('/driver/fleet')}
            style={{
              background: profile?.assignedVehicle ? '#eff6ff' : '#fffbeb',
              border: `1.5px solid ${profile?.assignedVehicle ? '#bfdbfe' : '#fde68a'}`,
              borderRadius: 12,
              padding: '14px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '1.75rem' }}>
              {profile?.assignedVehicle ? '🚗' : '🚙'}
            </span>
            <div style={{ flex: 1 }}>
              {profile?.assignedVehicle ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    {profile.assignedVehicle.vehicleNo} &nbsp;·&nbsp;
                    {profile.assignedVehicle.type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                    {profile.currentLocationPreset?.name ?? profile.currentLocationText ?? (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ Location not set — click to update</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>No vehicle assigned</div>
                  <div style={{ fontSize: 13, color: '#92400e', marginTop: 2 }}>
                    Click to view available vehicles →
                  </div>
                </>
              )}
            </div>
            <span style={{ fontSize: 20, color: '#94a3b8' }}>›</span>
          </div>
        )}

        {/* Stat Cards — Steps 1-3: Aligned with booking/trip lifecycle */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <StatCard label="Pending Assignments" count={counts.pending}           color="#d97706" />
          <StatCard label="Assigned"             count={counts.assigned}          color="#2563eb" />
          <StatCard label="In Progress"          count={counts.inProgress}        color="#f97316" />
          <StatCard label="Completed / Declined" count={counts.completedDeclined} color="#059669" />
        </div>

        {/* Current / Next Assignment Preview */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
            Current / Next Assignment
          </h2>

          {isLoading ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              Loading...
            </div>
          ) : !current ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              No active or pending assignments right now.
            </div>
          ) : (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Decision + trip-status badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 12px',
                    borderRadius: 12,
                    background: (DECISION_COLORS[current.decision] ?? '#64748b') + '1a',
                    color: DECISION_COLORS[current.decision] ?? '#64748b',
                    fontWeight: 700,
                    fontSize: 12,
                    border: `1px solid ${(DECISION_COLORS[current.decision] ?? '#64748b')}44`,
                  }}
                >
                  {current.decision}
                </span>
                {current.trip && TRIP_ACTIVE_STATUSES.includes(current.trip.status) && (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 12px',
                      borderRadius: 12,
                      background: '#fff7ed',
                      color: '#f97316',
                      fontWeight: 700,
                      fontSize: 12,
                      border: '1px solid #fed7aa',
                    }}
                  >
                    IN PROGRESS
                  </span>
                )}
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  Assigned {new Date(current.assignedAt).toLocaleString()}
                </span>
              </div>

              {/* Route */}
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>
                  Req #{current.booking.bookingNo}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {current.booking.transportType}
                </div>
                <div style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
                  {current.booking.pickupLabel || current.booking.pickupCustomAddress || '—'}
                  {' → '}
                  {current.booking.dropoffLabel || current.booking.dropoffCustomAddress || '—'}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  Requested: {new Date(current.booking.requestedAt).toLocaleString()}
                </div>
              </div>

              {/* Vehicle */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  gap: 24,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                    Vehicle
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {current.vehicle.vehicleNo}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {current.vehicle.make} {current.vehicle.model} — {current.vehicle.type}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                    Capacity
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {current.vehicle.capacity}
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/driver/assignments')}
                style={{
                  alignSelf: 'flex-start',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                View All Assignments →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
