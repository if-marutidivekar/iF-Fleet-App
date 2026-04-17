import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface User {
  id: string;
  userCode?: number;
  employeeId: string;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  email: string;
  department?: string | null;
  role: string;
  status: string;
  authMethod: string;
  mobileNumber?: string;
  pinMustChange?: boolean;
  profileCompleted: boolean;
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
  email: '',
  firstName: '',
  lastName: '',
  employeeId: '',
  department: '',
  role: 'EMPLOYEE',
  authMethod: 'EMAIL_OTP',
  mobileNumber: '',
  initialPin: '',
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

// ─── CSV Import Panel ─────────────────────────────────────────────────────────

interface BulkResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

function CsvImportPanel({ onDone }: { onDone: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<BulkResult | null>(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importCsv = useMutation({
    mutationFn: (text: string) =>
      api.post<BulkResult>('/users/bulk-import', { csvText: text }),
    onSuccess: ({ data }) => {
      setResult(data);
      setImportError('');
      onDone(); // refresh user list
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setImportError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Import failed'));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) ?? '');
    reader.readAsText(file);
  };

  const sampleCsv = `email,firstName,lastName,employeeId,department,role,authMethod,mobileNumber,initialPin
jane.doe@company.com,Jane,Doe,EMP-1001,Engineering,EMPLOYEE,,
john.driver@company.com,John,Driver,DRV-2001,Operations,DRIVER,MOBILE_PIN,+919876543210,123456`;

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Bulk Import Users (CSV)</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: '1rem' }}>
        Upload a CSV file or paste CSV text. <strong>Email is the upsert key</strong> — existing users are updated, new users are created.
      </p>

      {/* Sample CSV */}
      <details style={{ marginBottom: '1rem' }}>
        <summary style={{ fontSize: 13, color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>View sample CSV format</summary>
        <pre style={{ marginTop: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.75rem', fontSize: 11, overflowX: 'auto', color: '#0f172a' }}>
          {sampleCsv}
        </pre>
      </details>

      {/* File picker */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '0.4rem 1rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
        >
          📂 Choose File
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />
        {csvText && <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ File loaded ({csvText.split('\n').length - 1} data rows)</span>}
      </div>

      {/* Text area */}
      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder="Or paste CSV content here..."
        rows={5}
        style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
      />

      {importError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 4 }}>{importError}</p>}

      {/* Result */}
      {result && (
        <div style={{ marginTop: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
            Import Complete — {result.total} processed
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#374151' }}>
            <span>✅ Created: <strong>{result.created}</strong></span>
            <span>✏ Updated: <strong>{result.updated}</strong></span>
            <span style={{ color: result.failed > 0 ? '#dc2626' : '#374151' }}>❌ Failed: <strong>{result.failed}</strong></span>
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Errors:</div>
              {result.errors.map((err, i) => (
                <div key={i} style={{ fontSize: 12, color: '#dc2626', padding: '2px 0' }}>
                  Row {err.row} ({err.email}): {err.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem' }}>
        <button
          onClick={() => importCsv.mutate(csvText)}
          disabled={importCsv.isPending || !csvText.trim()}
          style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: !csvText.trim() || importCsv.isPending ? 0.6 : 1 }}
        >
          {importCsv.isPending ? 'Importing…' : 'Import CSV'}
        </button>
        <button
          onClick={() => { setCsvText(''); setResult(null); setImportError(''); }}
          style={{ padding: '0.5rem 1rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function UsersPage() {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ ...emptyAdd });
  const [addError, setAddError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', employeeId: '', department: '',
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
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      employeeId: user.employeeId ?? '',
      department: user.department ?? '',
      authMethod: user.authMethod,
      mobileNumber: user.mobileNumber ?? '',
      initialPin: '',
    });
  };

  const handleSaveEdit = () => {
    if (!editId) return;
    const data: Record<string, string> = {};
    if (editForm.firstName)  data['firstName']  = editForm.firstName;
    if (editForm.lastName)   data['lastName']   = editForm.lastName;
    if (editForm.employeeId) data['employeeId'] = editForm.employeeId;
    if (editForm.department) data['department'] = editForm.department;
    data['authMethod'] = editForm.authMethod;
    if (editForm.authMethod === 'MOBILE_PIN') {
      if (editForm.mobileNumber) data['mobileNumber'] = editForm.mobileNumber;
      if (editForm.initialPin)   data['initialPin']   = editForm.initialPin;
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Header — fixed */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.5rem 0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>User Management</h1>
              <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{users.length} users registered</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowCsvImport(!showCsvImport); setShowAddForm(false); }}
                style={{ padding: '0.5rem 1rem', background: '#f0fdf4', color: '#059669', border: '1.5px solid #bbf7d0', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                {showCsvImport ? 'Close Import' : '📂 Import CSV'}
              </button>
              <button
                onClick={() => { setShowAddForm(!showAddForm); setShowCsvImport(false); }}
                style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                {showAddForm ? 'Cancel' : '+ Add User'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem 1.5rem' }}>

      {/* CSV Import Panel */}
      {showCsvImport && (
        <CsvImportPanel onDone={() => { void qc.invalidateQueries({ queryKey: ['admin-users'] }); }} />
      )}

      {/* Add User Form */}
      {showAddForm && (
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Add New User</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {[
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'jane@company.com' },
              { label: 'First Name', key: 'firstName', type: 'text', placeholder: 'Jane' },
              { label: 'Last Name',  key: 'lastName',  type: 'text', placeholder: 'Doe' },
              { label: 'Employee ID (optional)', key: 'employeeId', type: 'text', placeholder: 'Auto-assigned if blank' },
              { label: 'Department', key: 'department', type: 'text', placeholder: 'Engineering' },
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
            disabled={createUser.isPending || !addForm.email}
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
                {['Code', 'Name', 'Email / Mobile', 'Dept.', 'Role', 'Auth', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.75rem 0.85rem', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 0.5 }}>
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
                    {/* User Code */}
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
                      {user.userCode ? String(user.userCode).padStart(6, '0') : '—'}
                    </td>
                    {/* Name */}
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                      <div>{user.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        {user.employeeId}
                        {user.hasDriverProfile && <span style={{ marginLeft: 6, color: '#059669', fontWeight: 700 }}>DRV</span>}
                        {user.pinMustChange && <span style={{ marginLeft: 6, color: '#dc2626', fontWeight: 700 }}>PIN↑</span>}
                        {!user.profileCompleted && <span style={{ marginLeft: 6, color: '#d97706', fontWeight: 700 }}>PROFILE!</span>}
                      </div>
                    </td>
                    {/* Email / Mobile */}
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: 13, color: '#374151' }}>
                      <div>{user.email}</div>
                      {user.mobileNumber && <div style={{ color: '#64748b', fontSize: 12 }}>{user.mobileNumber}</div>}
                    </td>
                    {/* Department */}
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: 13, color: '#374151' }}>
                      {user.department ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    {/* Role */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        style={{ padding: '0.2rem 0.4rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, background: '#fff', color: roleColor[user.role] ?? '#374151', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    {/* Auth */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      {user.role === 'DRIVER' ? <AuthMethodBadge method={user.authMethod} /> : <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <StatusBadge status={user.status} />
                    </td>
                    {/* Joined */}
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: 12, color: '#94a3b8' }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '0.75rem 0.85rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
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
                      <td colSpan={9} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          {[
                            { label: 'First Name', key: 'firstName', w: 130 },
                            { label: 'Last Name',  key: 'lastName',  w: 130 },
                            { label: 'Employee ID', key: 'employeeId', w: 120 },
                            { label: 'Department',  key: 'department', w: 130 },
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
                      <td colSpan={9} style={{ padding: '12px 16px' }}>
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
                <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

        </div>
      </div>
    </div>
  );
}
