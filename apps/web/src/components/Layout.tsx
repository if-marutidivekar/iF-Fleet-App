import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { UserRole } from '@if-fleet/domain';
import { api } from '../lib/api';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: '🏠' },
  { label: 'Bookings', path: '/admin/bookings', icon: '📋' },
  { label: 'Fleet Map', path: '/admin/map', icon: '🗺️' },
  { label: 'Fleet Master', path: '/admin/fleet', icon: '🚗' },
  { label: 'Users', path: '/admin/users', icon: '👥' },
  { label: 'Reports', path: '/admin/reports', icon: '📊' },
  { label: 'Settings', path: '/admin/settings', icon: '⚙️' },
];

const EMPLOYEE_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/employee', icon: '🏠' },
  { label: 'New Booking', path: '/employee/book', icon: '➕' },
  { label: 'My Bookings', path: '/employee/history', icon: '📋' },
  { label: 'Trip Tracking', path: '/employee/trip', icon: '📍' },
  { label: 'Profile', path: '/employee/profile', icon: '👤' },
];

const DRIVER_NAV: NavItem[] = [
  { label: 'Dashboard', path: '/driver', icon: '🏠' },
  { label: 'My Vehicle', path: '/driver/fleet', icon: '🚗' },
  { label: 'My Assignments', path: '/driver/assignments', icon: '📋' },
  { label: 'Profile', path: '/driver/profile', icon: '👤' },
];

function getRoleColor(role: UserRole): string {
  if (role === UserRole.ADMIN) return '#7c3aed';
  if (role === UserRole.DRIVER) return '#059669';
  return '#2563eb';
}

function getRoleLabel(role: UserRole): string {
  if (role === UserRole.ADMIN) return 'Admin';
  if (role === UserRole.DRIVER) return 'Driver';
  return 'Employee';
}

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const lastActivity = useRef<number>(Date.now());

  const { data: sysConfig } = useQuery<{ sessionTimeoutMinutes: number }>({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: !!user,
  });
  const timeoutMs = (sysConfig?.sessionTimeoutMinutes ?? 30) * 60_000;

  const handleLogout = () => {
    const rt = localStorage.getItem('if-fleet-rt');
    if (rt) {
      // fire and forget
      fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      }).catch(() => {});
      localStorage.removeItem('if-fleet-rt');
    }
    clearAuth();
    navigate('/login');
  };

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      lastActivity.current = Date.now();
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > timeoutMs) {
        handleLogout();
      }
    }, 60_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeoutMs]);

  if (!user) return <>{children}</>;

  const navItems =
    user.role === UserRole.ADMIN
      ? ADMIN_NAV
      : user.role === UserRole.DRIVER
      ? DRIVER_NAV
      : EMPLOYEE_NAV;

  const roleColor = getRoleColor(user.role);
  const roleLabel = getRoleLabel(user.role);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img
              src="/android-chrome-192x192.png"
              alt="iF Fleet logo"
              style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              iF Fleet
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Fleet Management
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '0.75rem 0' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/admin' && item.path !== '/employee' && item.path !== '/driver' &&
               location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  width: '100%',
                  padding: '0.625rem 1.5rem',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? `3px solid ${roleColor}` : '3px solid transparent',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>
            {user.name}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: '0.75rem', wordBreak: 'break-all' }}>
            {user.email}
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.4rem 0.75rem',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              color: '#f87171',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header
          style={{
            height: 56,
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            gap: '0.75rem',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }} />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.625rem',
              background: `${roleColor}18`,
              color: roleColor,
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            {roleLabel}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{user.name}</span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
