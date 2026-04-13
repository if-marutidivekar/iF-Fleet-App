import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  authMethod: string;
  mobileNumber?: string;
  pinMustChange?: boolean;
  createdAt: string;
  hasDriverProfile: boolean;
}

const ROLES = ['EMPLOYEE', 'DRIVER', 'ADMIN'];

const statusColor: Record<string, string> = {
  ACTIVE: '#059669',
  SUSPENDED: '#d97706',
  INACTIVE: '#94a3b8',
};
const roleColor: Record<string, string> = {
  ADMIN: '#7c3aed',
  DRIVER: '#059669',
  EMPLOYEE: '#2563eb',
};

const emptyAdd = {
  name: '', email: '', employeeId: '', role: 'EMPLOYEE', phone: '',
  authMethod: 'EMAIL_OTP', mobileNumber: '', initialPin: '',
};

type AddForm = typeof emptyAdd;

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0.2rem 0.5rem',
      background: `${statusColor[status] ?? '#64748b'}18`,
      color: statusColor[status] ?? '#64748b',
      borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>
      {status}
    </span>
  );
}

function AuthMethodBadge({ method }: { method: string }) {
  const color = method === 'MOBILE_PIN' ? '#ea580c' : '#0891b2';
  return (
    <span style={{
      display: 'inline-block', padding: '0.15rem 0.45rem',
      background: `${color}18`, color, borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
    }}>
      {method === 'MOBILE_PIN' ? '📱 PIN' : '✉ OTP'}
    </span>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ ...emptyAdd });
  const [addError, setAddError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', phone: '', employeeId: '',
    authMethod: 'EMAIL_OTP', mobileNumber: '', initialPin: '',
  });
  const [editError, setEditError] = useState('');

  const [resetPinId, setResetPinId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState('');
  const [resetPinError, setResetPinError] = useState('');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
  });

  const createUser = useMutation({
    mutationFn: (body: AddForm) => api.post('/users', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAddForm(false);
      setAddForm({ ...emptyAdd });
      setAddError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setAddError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create user'));
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEditId(null);
      setEditError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setEditError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to update user'));
    },
  });

  const resetDriverPin = useMutation({
    mutationFn: ({ id, newPin }: { id: string; newPin: string }) =>
      api.post(`/admin/drivers/${id}/reset-pin`, { newPin }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      setResetPinId(null);
      setResetPin('');
      setResetPinError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setResetPinError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to reset PIN'));
    },
  });

  const handleStatusToggle = (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    updateUser.mutate({ id: user.id, data: { status: newStatus } });
  };

  const handleRoleChange = (user: User, newRole: string) => {
    updateUser.mutate({ id: user.id, data: { role: newRole } });
  };

  const startEdit = (user: User) => {
    setEditId(user.id);
    setEditError('');
    setEditForm({
      name: user.name,
      phone: user.phone ?? '',
      employeeId: user.employeeId ?? '',
      authMethod: user.authMethod,
      mobileNumber: user.mobileNumber ?? '',
      initialPin: '',
    });
  };

  const handleSaveEdit = () => {
    if (!editId) return;
    const data: Record<string, string> = {};
    if (editForm.name) data['name'] = editForm.name;
    if (editForm.phone) data['phone'] = editForm.phone;
    if (editForm.employeeId) data['employeeId'] = editForm.employeeId;
    data['authMethod'] = editForm.authMethod;
    if (editForm.authMethod === 'MOBILE_PIN') {
      if (editForm.mobileNumber) data['mobileNumber'] = editForm.mobileNumber;
      if (editForm.initialPin) data['initialPin'] = editForm.initialPin;
    }
    updateUser.mutate({ id: editId, data });
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.45rem 0.75rem', border: '1.5px solid #e2e8f0',
    borderRadius: 6, fontSize: 14, outline: 'none',
  };

  const addIsDriver = addForm.role === 'DRIVER';
  const editUser = users.find((u) => u.id === editId);
  const editIsDriver = editUser?.role === 'DRIVER';

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>User Management</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{users.length} users registered</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          {showAddForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Add New User</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {[
              { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Jane Doe' },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'jane@ideaforgetech.com' },
              { label: 'Employee ID (optional)', key: 'employeeId', type: 'text', placeholder: 'Auto-assigned if blank' },
              { label: 'Phone', key: 'phone', type: 'text', placeholder: '+91-9876543210' },
            ].map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{f.label}</span>
                <input
                  type={f.type} placeholder={f.placeholder}
                  value={addForm[f.key as keyof AddForm]}
                  onChange={(e) => setAddForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Role</span>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value, authMethod: 'EMAIL_OTP' }))}
                style={{ ...inputStyle, background: '#fff' }}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>

            {/* Driver auth method selector */}
            {addIsDriver && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Driver Login Method</span>
                <select
                  value={addForm.authMethod}
                  onChange={(e) => setAddForm((p) => ({ ...p, authMethod: e.target.value }))}
                  style={{ ...inputStyle, background: '#fff' }}
                >
                  <option value="EMAIL_OTP">Email OTP (company email)</option>
                  <option value="MOBILE_PIN">Mobile + PIN</option>
                </select>
              </label>
            )}

            {/* MOBILE_PIN extra fields */}
            {addIsDriver && addForm.authMethod === 'MOBILE_PIN' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Mobile Number *</span>
                  <input
                    type="tel" placeholder="+919876543210"
                    value={addForm.mobileNumber}
                    onChange={(e) => setAddForm((p) => ({ ...p, mobileNumber: e.target.value }))}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Initial PIN * <span style={{ fontWeight: 400, color: '#94a3b8' }}>(6 digits, driver must change)</span></span>
                  <input
                    type="password" placeholder="6-digit PIN" maxLength={6}
                    value={addForm.initialPin}
                    onChange={(e) => setAddForm((p) => ({ ...p, initialPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    style={inputStyle}
                  />
                </label>
              </>
            )}
          </div>

          {addIsDriver && addForm.authMethod === 'MOBILE_PIN' && (
            <p style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.5rem 0.75rem', marginTop: '0.75rem' }}>
              ⚠ Driver will be forced to change this PIN at first login before accessing the app.
            </p>
          )}

          {addError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: '0.5rem' }}>{addError}</p>}
          <button
            onClick={() => createUser.mutate(addForm)}
            disabled={createUser.isPending || !addForm.name || !addForm.email}
            style={{ marginTop: '1rem', padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: createUser.isPending ? 0.7 : 1 }}
          >
            {createUser.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      )}

      {/* Users Table */}
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading users...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {['Name', 'Email / Mobile', 'Role', 'Auth', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <>
                  <tr
                    key={user.id}
                    style={{ borderBottom: editId === user.id ? 'none' : i < users.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                      {user.name}
                      {user.hasDriverProfile && <span style={{ marginLeft: 6, fontSize: 10, color: '#059669', fontWeight: 700 }}>DRV</span>}
                      {user.pinMustChange && <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>PIN↑</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: 13, color: '#374151' }}>
                      <div>{user.email}</div>
                      {user.mobileNumber && <div style={{ color: '#64748b', fontSize: 12 }}>{user.mobileNumber}</div>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        style={{ padding: '0.2rem 0.4rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, background: '#fff', color: roleColor[user.role] ?? '#374151', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {user.role === 'DRIVER' ? <AuthMethodBadge method={user.authMethod} /> : <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <StatusBadge status={user.status} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: 12, color: '#94a3b8' }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => editId === user.id ? setEditId(null) : startEdit(user)}
                        style={{ padding: '0.25rem 0.625rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {editId === user.id ? 'Cancel' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleStatusToggle(user)}
                        style={{ padding: '0.25rem 0.625rem', background: user.status === 'ACTIVE' ? '#fef2f2' : '#f0fdf4', color: user.status === 'ACTIVE' ? '#dc2626' : '#059669', border: `1px solid ${user.status === 'ACTIVE' ? '#fecaca' : '#bbf7d0'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                      {user.role === 'DRIVER' && user.authMethod === 'MOBILE_PIN' && (
                        <button
                          onClick={() => { setResetPinId(user.id); setResetPin(''); setResetPinError(''); }}
                          style={{ padding: '0.25rem 0.625rem', background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Reset PIN
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {editId === user.id && (
                    <tr key={`${user.id}-edit`} style={{ background: '#f8fafc', borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td colSpan={7} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          {[
                            { label: 'Name', key: 'name', w: 160 },
                            { label: 'Phone', key: 'phone', w: 150 },
                            { label: 'Employee ID', key: 'employeeId', w: 120 },
                          ].map((f) => (
                            <label key={f.key} style={{ fontSize: 13 }}>
                              <span style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 }}>{f.label}</span>
                              <input
                                type="text"
                                value={editForm[f.key as keyof typeof editForm]}
                                onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                                style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, width: f.w }}
                              />
                            </label>
                          ))}

                          {/* Auth method change for drivers */}
                          {editIsDriver && (
                            <label style={{ fontSize: 13 }}>
                              <span style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 }}>Login Method</span>
                              <select
                                value={editForm.authMethod}
                                onChange={(e) => setEditForm((p) => ({ ...p, authMethod: e.target.value, initialPin: '', mobileNumber: e.target.value === 'MOBILE_PIN' ? p.mobileNumber : '' }))}
                                style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, background: '#fff' }}
                              >
                                <option value="EMAIL_OTP">Email OTP</option>
                                <option value="MOBILE_PIN">Mobile + PIN</option>
                              </select>
                            </label>
                          )}

                          {editIsDriver && editForm.authMethod === 'MOBILE_PIN' && (
                            <>
                              <label style={{ fontSize: 13 }}>
                                <span style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 }}>Mobile Number</span>
                                <input type="tel" value={editForm.mobileNumber} onChange={(e) => setEditForm((p) => ({ ...p, mobileNumber: e.target.value }))}
                                  placeholder="+919876543210" style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, width: 150 }} />
                              </label>
                              {editForm.authMethod !== user.authMethod && (
                                <label style={{ fontSize: 13 }}>
                                  <span style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 }}>Initial PIN *</span>
                                  <input type="password" maxLength={6} value={editForm.initialPin}
                                    onChange={(e) => setEditForm((p) => ({ ...p, initialPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                    placeholder="6 digits" style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, width: 100 }} />
                                </label>
                              )}
                            </>
                          )}
                        </div>

                        {editForm.authMethod !== user.authMethod && (
                          <p style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.4rem 0.6rem', marginTop: '0.5rem' }}>
                            ⚠ Changing login method will immediately revoke all active sessions for this driver.
                          </p>
                        )}
                        {editError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{editError}</p>}
                        <div style={{ display: 'flex', gap: 6, marginTop: '0.625rem' }}>
                          <button onClick={handleSaveEdit} disabled={updateUser.isPending}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                            {updateUser.isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={() => setEditId(null)}
                            style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Inline Reset PIN row */}
                  {resetPinId === user.id && (
                    <tr key={`${user.id}-pin`} style={{ background: '#fff7ed', borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <td colSpan={7} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <label style={{ fontSize: 13 }}>
                            <span style={{ fontWeight: 600, color: '#374151', display: 'block', marginBottom: 2 }}>New PIN (6 digits) *</span>
                            <input type="password" maxLength={6} value={resetPin}
                              onChange={(e) => setResetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit PIN"
                              style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, width: 120 }} />
                          </label>
                        </div>
                        <p style={{ fontSize: 12, color: '#92400e', marginTop: 4 }}>
                          Driver will be forced to change this PIN at next login. All active sessions will be revoked.
                        </p>
                        {resetPinError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{resetPinError}</p>}
                        <div style={{ display: 'flex', gap: 6, marginTop: '0.5rem' }}>
                          <button
                            onClick={() => resetDriverPin.mutate({ id: user.id, newPin: resetPin })}
                            disabled={resetDriverPin.isPending || resetPin.length !== 6}
                            style={{ background: '#ea580c', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: resetPin.length !== 6 ? 0.6 : 1 }}>
                            {resetDriverPin.isPending ? 'Resetting...' : 'Reset PIN'}
                          </button>
                          <button onClick={() => { setResetPinId(null); setResetPin(''); setResetPinError(''); }}
                            style={{ background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
