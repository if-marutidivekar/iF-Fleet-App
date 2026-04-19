import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

interface Booking {
  id: string;
  transportType: string;
  status: string;
  requestedAt: string;
  createdAt: string;
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: '#d97706',
  APPROVED: '#2563eb',
  ASSIGNED: '#7c3aed',
  IN_TRIP: '#f97316',
  COMPLETED: '#059669',
  REJECTED: '#dc2626',
  CANCELLED: '#dc2626',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#64748b';
  return (
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
      {status.replace(/_/g, ' ')}
    </span>
  );
}

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

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      return res.data;
    },
  });

  const counts = {
    pending: bookings.filter((b) => b.status === 'PENDING_APPROVAL').length,
    approved: bookings.filter((b) => b.status === 'APPROVED' || b.status === 'ASSIGNED').length,
    inTrip: bookings.filter((b) => b.status === 'IN_TRIP').length,
    completed: bookings.filter((b) => b.status === 'COMPLETED').length,
  };

  const recent = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  // Steps 4-5: Internal scroll layout — header fixed, content scrolls
  return (
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
              Welcome back, {user?.name ?? 'Employee'}
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
              Here's a summary of your fleet bookings.
            </p>
          </div>
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
      </div>

      {/* Scrollable content area */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px' }}>

        {/* Stat Cards */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
          <StatCard label="Pending Approval"   count={counts.pending}   color="#d97706" />
          <StatCard label="Approved / Assigned" count={counts.approved}  color="#2563eb" />
          <StatCard label="In Progress"         count={counts.inTrip}    color="#f97316" />
          <StatCard label="Completed"           count={counts.completed} color="#059669" />
        </div>

        {/* Recent Bookings */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 15 }}>Recent Bookings</span>
            <button
              onClick={() => navigate('/employee/history')}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              View all →
            </button>
          </div>

          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : recent.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
              No bookings yet. Create your first booking!
            </div>
          ) : (
            recent.map((b, i) => {
              const pickup = b.pickupLabel || b.pickupCustomAddress || '—';
              const dropoff = b.dropoffLabel || b.dropoffCustomAddress || '—';
              return (
                <div
                  key={b.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < recent.length - 1 ? '1px solid #f1f5f9' : undefined,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                      {b.transportType}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {pickup} → {dropoff}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {new Date(b.requestedAt).toLocaleString()}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
