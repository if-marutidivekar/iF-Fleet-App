import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { data: cfg } = useQuery({
    queryKey: ['admin-config'],
    queryFn: () => api.get<{ smtpConfigured: boolean; companyDomain: string }>('/admin/config').then((r) => r.data),
  });

  const tiles = [
    { label: 'Booking Queue', icon: '📋', path: '/admin/bookings' },
    { label: 'Fleet Map', icon: '🗺️', path: '/admin/map' },
    { label: 'Fleet Master', icon: '🚗', path: '/admin/fleet' },
    { label: 'Reports', icon: '📊', path: '/admin/reports' },
    { label: 'Settings', icon: '⚙️', path: '/admin/settings' },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
        Admin Dashboard
      </h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: 14 }}>
        {cfg?.companyDomain ? `Domain: @${cfg.companyDomain}` : ''}
      </p>

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
