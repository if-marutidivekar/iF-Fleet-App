import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface AdminConfig {
  smtpConfigured: boolean;
  companyDomain: string;
  approvalMode: 'MANUAL' | 'AUTO';
  sessionTimeoutMinutes: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { data: cfg } = useQuery<AdminConfig>({
    queryKey: ['admin-config'],
    queryFn: () => api.get<AdminConfig>('/admin/config').then((r) => r.data),
  });

  const tiles = [
    { label: 'Booking Queue', icon: '📋', path: '/admin/bookings' },
    { label: 'Fleet Map', icon: '🗺️', path: '/admin/map' },
    { label: 'Fleet Master', icon: '🚗', path: '/admin/fleet' },
    { label: 'Users', icon: '👥', path: '/admin/users' },
    { label: 'Reports', icon: '📊', path: '/admin/reports' },
    { label: 'Settings', icon: '⚙️', path: '/admin/settings' },
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
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          {/* Booking Approval Mode badge */}
          <div
            onClick={() => navigate('/admin/settings')}
            title="Click to change in Settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0.5rem 1rem',
              background: isAuto ? '#eff6ff' : '#f0fdf4',
              border: `1.5px solid ${isAuto ? '#bfdbfe' : '#bbf7d0'}`,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: isAuto ? '#1d4ed8' : '#166534',
              userSelect: 'none',
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

          {/* Session timeout badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0.5rem 1rem',
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
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
