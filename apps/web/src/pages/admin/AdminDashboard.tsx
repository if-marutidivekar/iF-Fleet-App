import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface AdminConfig {
  smtpConfigured: boolean;
  companyDomain: string;
  approvalMode: 'MANUAL' | 'AUTO';
  sessionTimeoutMinutes: number;
}

interface Booking {
  id: string;
  status: string;
}

/** Maps each dashboard card to the BookingQueuePage tab value */
const BOOKING_TAB_VALUES = {
  ALL:              'ALL',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED:         'APPROVED',
  ASSIGNED:         'ASSIGNED',
  IN_TRIP:          'IN_TRIP',
  COMPLETED:        'COMPLETED',
} as const;

function StatCard({
  label,
  count,
  color,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '18px 20px',
        flex: 1,
        minWidth: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = color;
        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 3px ${color}22`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
      }}
    >
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 30, fontWeight: 700, color }}>{count}</span>
    </button>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();

  const { data: cfg } = useQuery<AdminConfig>({
    queryKey: ['admin-config'],
    queryFn: () => api.get<AdminConfig>('/admin/config').then((r) => r.data),
  });

  // Steps 1-3: Fetch bookings to compute card counts — same source as BookingQueuePage
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings-admin'],
    queryFn: () => api.get<Booking[]>('/bookings').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const counts = {
    all:             bookings.length,
    pendingApproval: bookings.filter((b) => b.status === 'PENDING_APPROVAL').length,
    approved:        bookings.filter((b) => b.status === 'APPROVED').length,
    assigned:        bookings.filter((b) => b.status === 'ASSIGNED').length,
    inTrip:          bookings.filter((b) => b.status === 'IN_TRIP').length,
    completed:       bookings.filter((b) => b.status === 'COMPLETED').length,
  };

  /** Navigate to BookingQueuePage and open the matching tab */
  const goToTab = (tab: string) =>
    navigate('/admin/bookings', { state: { initialTab: tab } });

  const tiles = [
    { label: 'Booking Queue', icon: '📋', path: '/admin/bookings' },
    { label: 'Fleet Map',     icon: '🗺️', path: '/admin/map' },
    { label: 'Fleet Master',  icon: '🚗', path: '/admin/fleet' },
    { label: 'Users',         icon: '👥', path: '/admin/users' },
    { label: 'Reports',       icon: '📊', path: '/admin/reports' },
    { label: 'Settings',      icon: '⚙️', path: '/admin/settings' },
  ];

  const isAuto = cfg?.approvalMode === 'AUTO';

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
        Admin Dashboard
      </h1>
      <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: 14 }}>
        {cfg?.companyDomain ? `Domain: @${cfg.companyDomain}` : ''}
      </p>

      {/* ── System Status Bar ─────────────────────────────── */}
      {cfg && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div
            onClick={() => navigate('/admin/settings')}
            title="Click to change in Settings"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0.5rem 1rem',
              background: isAuto ? '#eff6ff' : '#f0fdf4',
              border: `1.5px solid ${isAuto ? '#bfdbfe' : '#bbf7d0'}`,
              borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: isAuto ? '#1d4ed8' : '#166534', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 16 }}>{isAuto ? '⚡' : '🔒'}</span>
            <span>
              Booking Approval:{' '}
              <span style={{ fontWeight: 700 }}>
                {isAuto ? 'Auto Approve — Drivers Self-Assign' : 'Manual Approve / Reject'}
              </span>
            </span>
            <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4 }}>⚙ Change</span>
          </div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0.5rem 1rem', background: '#f8fafc',
              border: '1.5px solid #e2e8f0', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: '#475569',
            }}
          >
            <span style={{ fontSize: 16 }}>⏱</span>
            Session Timeout:{' '}
            <span style={{ fontWeight: 700 }}>{cfg.sessionTimeoutMinutes} min</span>
          </div>
        </div>
      )}

      {/* ── First-time SMTP warning ───────────────────────── */}
      {cfg && !cfg.smtpConfigured && (
        <div
          onClick={() => navigate('/admin/settings')}
          style={{
            background: '#fefce8', border: '1px solid #fde047', borderRadius: 8,
            padding: '0.875rem 1rem', marginBottom: '1.5rem', cursor: 'pointer',
            color: '#713f12', fontSize: 14,
          }}
        >
          ⚠ <strong>First-time setup required</strong> — SMTP not configured. Click here to set up
          email so users can receive OTP codes. Until then, OTPs appear in the server terminal.
        </div>
      )}

      {/* ── Booking Status Cards (Steps 1-3) ─────────────── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
          Bookings Overview
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="All"              count={counts.all}             color="#0f172a" onClick={() => goToTab(BOOKING_TAB_VALUES.ALL)} />
          <StatCard label="Pending Approval" count={counts.pendingApproval} color="#d97706" onClick={() => goToTab(BOOKING_TAB_VALUES.PENDING_APPROVAL)} />
          <StatCard label="Approved"         count={counts.approved}        color="#2563eb" onClick={() => goToTab(BOOKING_TAB_VALUES.APPROVED)} />
          <StatCard label="Assigned"         count={counts.assigned}        color="#7c3aed" onClick={() => goToTab(BOOKING_TAB_VALUES.ASSIGNED)} />
          <StatCard label="In Trip"          count={counts.inTrip}          color="#f97316" onClick={() => goToTab(BOOKING_TAB_VALUES.IN_TRIP)} />
          <StatCard label="Completed"        count={counts.completed}       color="#059669" onClick={() => goToTab(BOOKING_TAB_VALUES.COMPLETED)} />
        </div>
      </div>

      {/* ── Navigation tiles ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
        {tiles.map((t) => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            style={{
              background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12,
              padding: '1.5rem 1rem', cursor: 'pointer', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'border-color 0.15s',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
