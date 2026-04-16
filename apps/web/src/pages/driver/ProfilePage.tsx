import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

export function DriverProfilePage() {
  const { user, clearAuth, updateUser } = useAuthStore();
  const navigate = useNavigate();

  // ─── Profile edit state ────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber ?? '');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // ─── PIN change state ──────────────────────────────────────────────────────
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const accessToken = useAuthStore((s) => s.accessToken);

  const isMobilePin = (user as { authMethod?: string } | null)?.authMethod === 'MOBILE_PIN';

  const saveProfile = useMutation({
    mutationFn: () =>
      api.patch<{
        firstName: string; lastName: string; name: string;
        department: string; mobileNumber: string; profileCompleted: boolean; userCode: number;
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
      setEditSuccess('Profile updated successfully.');
      setEditError('');
      setEditing(false);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setEditError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to save.'));
    },
  });

  const changePinMutation = useMutation({
    mutationFn: () =>
      api.post('/auth/change-pin', { currentPin, newPin }),
    onSuccess: () => {
      setPinSuccess('PIN changed successfully.');
      setPinError('');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setPinError(Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : 'Failed to change PIN.'));
      setPinSuccess('');
    },
  });

  const handleChangePin = () => {
    setPinError('');
    setPinSuccess('');
    if (newPin.length < 4) { setPinError('New PIN must be at least 4 digits.'); return; }
    if (newPin !== confirmPin) { setPinError('New PIN and Confirm PIN do not match.'); return; }
    changePinMutation.mutate();
  };

  const handleLogout = () => {
    const rt = localStorage.getItem('if-fleet-rt');
    if (rt) {
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

  const startEdit = () => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setEmployeeId('');
    setDepartment(user?.department ?? '');
    setMobileNumber(user?.mobileNumber ?? '');
    setEditError('');
    setEditSuccess('');
    setEditing(true);
  };

  if (!user) return null;
  const initials = (user.firstName ? user.firstName[0] : user.name[0] ?? 'D').toUpperCase();

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 7,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#0f172a',
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
        My Profile
      </h1>

      <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Profile card */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          {/* Avatar header */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            padding: '28px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 800,
              color: '#fff',
              flexShrink: 0,
              border: '3px solid rgba(255,255,255,0.4)',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{user.name}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{user.email}</div>
              {user.userCode && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontFamily: 'monospace' }}>
                  Code: {String(user.userCode).padStart(6, '0')}
                </div>
              )}
              <span style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '2px 10px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
              }}>
                DRIVER
              </span>
            </div>
          </div>

          {/* Details / Edit */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!editing ? (
              <>
                <InfoRow label="First Name"    value={user.firstName ?? '—'} />
                <InfoRow label="Last Name"     value={user.lastName  ?? '—'} />
                <InfoRow label="Email"         value={user.email} />
                <InfoRow label="Department"    value={user.department ?? '—'} />
                <InfoRow label="Mobile Number" value={user.mobileNumber ?? '—'} />
                <InfoRow label="Auth Method"   value={isMobilePin ? 'Mobile + PIN' : 'Email OTP'} />

                {editSuccess && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: '#059669' }}>
                    {editSuccess}
                  </div>
                )}

                <button
                  onClick={startEdit}
                  style={{ padding: '9px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#059669', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✏ Edit Profile
                </button>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    First Name *
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={inputStyle} placeholder="Jane" />
                  </label>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Last Name *
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required style={inputStyle} placeholder="Doe" />
                  </label>
                </div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Employee ID <span style={{ fontWeight: 400, color: '#94a3b8' }}>(leave blank to keep)</span>
                  <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={inputStyle} placeholder="EMP-1042" />
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Department *
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} required style={inputStyle} placeholder="Operations" />
                </label>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Mobile Number
                  <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} style={inputStyle} placeholder="+919876543210" />
                </label>

                {editError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: '#dc2626' }}>
                    {editError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    type="submit"
                    disabled={saveProfile.isPending || !firstName.trim() || !lastName.trim()}
                    style={{ flex: 1, padding: '9px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saveProfile.isPending ? 0.7 : 1 }}
                  >
                    {saveProfile.isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setEditError(''); }}
                    style={{ padding: '9px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <button
              onClick={handleLogout}
              style={{ marginTop: 8, padding: '10px 0', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Change PIN card (MOBILE_PIN drivers only) */}
        {isMobilePin && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              🔒 Change PIN
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(['Current PIN', 'New PIN', 'Confirm New PIN'] as const).map((label, idx) => {
                const vals = [currentPin, newPin, confirmPin];
                const setters = [setCurrentPin, setNewPin, setConfirmPin];
                const placeholders = ['Enter current PIN', 'New 6-digit PIN', 'Repeat new PIN'];
                return (
                  <div key={label}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>{label}</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder={placeholders[idx]}
                      value={vals[idx]}
                      onChange={(e) => (setters[idx] as (v: string) => void)(e.target.value)}
                      maxLength={8}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                );
              })}

              {pinError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 12px', fontSize: 13, color: '#dc2626' }}>
                  {pinError}
                </div>
              )}
              {pinSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '10px 12px', fontSize: 13, color: '#059669' }}>
                  {pinSuccess}
                </div>
              )}

              <button
                onClick={handleChangePin}
                disabled={changePinMutation.isPending || !currentPin || !newPin || !confirmPin}
                style={{ padding: '10px 0', background: '#059669', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !currentPin || !newPin || !confirmPin ? 0.5 : 1 }}
              >
                {changePinMutation.isPending ? 'Changing...' : 'Change PIN'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
