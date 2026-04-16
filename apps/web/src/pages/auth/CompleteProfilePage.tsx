import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuthStore();

  // Redirect away if not authenticated or already completed
  useEffect(() => {
    if (!isAuthenticated()) { navigate('/login', { replace: true }); return; }
    if (user?.profileCompleted) { navigate('/', { replace: true }); }
  }, [isAuthenticated, user, navigate]);

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber ?? '');
  const [error, setError] = useState('');

  const saveProfile = useMutation({
    mutationFn: () =>
      api.patch<{
        id: string; userCode: number; firstName: string; lastName: string;
        name: string; email: string; department: string; mobileNumber: string;
        profileCompleted: boolean;
      }>('/users/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(employeeId.trim() && { employeeId: employeeId.trim() }),
        ...(department.trim() && { department: department.trim() }),
        ...(mobileNumber.trim() && { mobileNumber: mobileNumber.trim() }),
      }),
    onSuccess: ({ data }) => {
      updateUser({
        firstName: data.firstName,
        lastName: data.lastName,
        name: data.name,
        department: data.department,
        mobileNumber: data.mobileNumber,
        profileCompleted: data.profileCompleted,
        userCode: data.userCode,
      });
      navigate('/', { replace: true });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to save profile. Please try again.'));
    },
  });

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0
    && department.trim().length > 0 && mobileNumber.trim().length > 0;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#0f172a',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '36px 32px',
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Complete Your Profile
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Please fill in your details to continue using iF Fleet.
          </p>
        </div>

        {/* User Code display (if available) */}
        {user?.userCode && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 14px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>User Code</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
              {String(user.userCode).padStart(6, '0')}
            </span>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); if (canSubmit) saveProfile.mutate(); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              First Name *
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                required
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Last Name *
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                style={inputStyle}
              />
            </label>
          </div>

          <label style={labelStyle}>
            Employee ID
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP-1042 (leave blank to keep existing)"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Department *
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering, Operations"
              required
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Mobile Number *
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+919876543210"
              required
              style={inputStyle}
            />
          </label>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || saveProfile.isPending}
            style={{
              padding: '13px',
              background: canSubmit ? '#2563eb' : '#94a3b8',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              marginTop: 4,
              transition: 'background 0.2s',
            }}
          >
            {saveProfile.isPending ? 'Saving…' : 'Save & Continue'}
          </button>

          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: 0 }}>
            Signed in as <strong>{user?.email}</strong>
          </p>
        </form>
      </div>
    </div>
  );
}
