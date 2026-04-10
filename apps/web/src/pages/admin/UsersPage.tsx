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
  createdAt: string;
  hasDriverProfile: boolean;
}

const ROLES = ['EMPLOYEE', 'DRIVER', 'ADMIN'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.5rem',
        background: `${statusColor[status] ?? '#64748b'}18`,
        color: statusColor[status] ?? '#64748b',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.5rem',
        background: `${roleColor[role] ?? '#64748b'}18`,
        color: roleColor[role] ?? '#64748b',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {role}
    </span>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    employeeId: '',
    role: 'EMPLOYEE',
    phone: '',
  });
  const [addError, setAddError] = useState('');

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
  });

  const createUser = useMutation({
    mutationFn: (body: typeof addForm) => api.post('/users', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAddForm(false);
      setAddForm({ name: '', email: '', employeeId: '', role: 'EMPLOYEE', phone: '' });
      setAddError('');
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAddError(typeof msg === 'string' ? msg : 'Failed to create user');
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; role?: string } }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const handleStatusToggle = (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    updateUser.mutate({ id: user.id, data: { status: newStatus } });
  };

  const handleRoleChange = (user: User, newRole: string) => {
    updateUser.mutate({ id: user.id, data: { role: newRole } });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            User Management
          </h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            {users.length} users registered
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '0.5rem 1.25rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div
          style={{
            background: '#fff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
            Add New User
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Jane Doe' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@ideaforgetech.com' },
              { label: 'Employee ID', key: 'employeeId', type: 'text', placeholder: 'EMP-1042' },
              { label: 'Phone', key: 'phone', type: 'text', placeholder: '+91-9876543210' },
            ].map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{f.label}</span>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={addForm[f.key as keyof typeof addForm]}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  style={{
                    padding: '0.45rem 0.75rem',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#374151' }}>Role</span>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value }))}
                style={{
                  padding: '0.45rem 0.75rem',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          {addError && (
            <p style={{ color: '#dc2626', fontSize: 13, marginTop: '0.5rem' }}>{addError}</p>
          )}
          <button
            onClick={() => createUser.mutate(addForm)}
            disabled={createUser.isPending || !addForm.name || !addForm.email || !addForm.employeeId}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.25rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              opacity: createUser.isPending ? 0.7 : 1,
            }}
          >
            {createUser.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      )}

      {/* Users Table */}
      <div
        style={{
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading users...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                {['Name', 'Email', 'Employee ID', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#64748b',
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none',
                    transition: 'background 0.1s',
                  }}
                >
                  <td style={{ padding: '0.75rem 1rem', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                    {user.name}
                    {user.hasDriverProfile && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#059669', fontWeight: 700 }}>
                        DRV
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: 13, color: '#374151' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: 13, color: '#64748b', fontFamily: 'monospace' }}>
                    {user.employeeId}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user, e.target.value)}
                      style={{
                        padding: '0.2rem 0.4rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: 12,
                        background: '#fff',
                        color: roleColor[user.role] ?? '#374151',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <StatusBadge status={user.status} />
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: 12, color: '#94a3b8' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button
                      onClick={() => handleStatusToggle(user)}
                      style={{
                        padding: '0.25rem 0.625rem',
                        background: user.status === 'ACTIVE' ? '#fef2f2' : '#f0fdf4',
                        color: user.status === 'ACTIVE' ? '#dc2626' : '#059669',
                        border: `1px solid ${user.status === 'ACTIVE' ? '#fecaca' : '#bbf7d0'}`,
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
