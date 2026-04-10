import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

interface SystemConfig {
  smtp: SmtpConfig | null;
  companyDomain: string;
  smtpConfigured: boolean;
}

const defaultSmtp: SmtpConfig = {
  host: '', port: 587, secure: false, user: '', password: '', from: '',
};

export function SettingsPage() {
  const { data: cfg, refetch } = useQuery<SystemConfig>({
    queryKey: ['admin-config'],
    queryFn: () => api.get<SystemConfig>('/admin/config').then((r) => r.data),
  });

  const [smtp, setSmtp] = useState<SmtpConfig>(defaultSmtp);
  const [domain, setDomain] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // Populate form once data loads (only first time)
  if (cfg && smtp.host === '' && cfg.smtp) {
    setSmtp({ ...cfg.smtp, password: '' }); // never pre-fill password
  }
  if (cfg && domain === '') {
    setDomain(cfg.companyDomain);
  }

  const saveSmtp = useMutation({
    mutationFn: (s: SmtpConfig) => api.put('/admin/config/smtp', s),
    onSuccess: () => { refetch(); alert('SMTP configuration saved!'); },
  });

  const testSmtp = useMutation({
    mutationFn: (s: SmtpConfig) =>
      api.post<{ ok: boolean; error?: string }>('/admin/config/smtp/test', s).then((r) => r.data),
    onSuccess: (res) => setTestResult(res),
  });

  const saveDomain = useMutation({
    mutationFn: (d: string) => api.put('/admin/config/domain', { domain: d }),
    onSuccess: () => { refetch(); alert('Company domain saved!'); },
  });

  const field = (
    label: string,
    key: keyof SmtpConfig,
    type = 'text',
  ) => (
    <label style={s.label}>
      {label}
      <input
        type={type}
        style={s.input}
        value={String(smtp[key])}
        onChange={(e) =>
          setSmtp((p) => ({
            ...p,
            [key]: type === 'number' ? Number(e.target.value) : e.target.value,
          }))
        }
      />
    </label>
  );

  return (
    <div style={s.page}>
      <h1 style={s.title}>System Settings</h1>

      {/* Bootstrap notice */}
      {cfg && !cfg.smtpConfigured && (
        <div style={s.notice}>
          <strong>⚠ SMTP not configured</strong> — OTPs are currently printed to the server
          terminal. Configure SMTP below so users receive OTP emails.
        </div>
      )}

      {/* ── Company Domain ─────────────────────────────────────────────── */}
      <section style={s.card}>
        <h2 style={s.cardTitle}>Company Email Domain</h2>
        <p style={s.hint}>Only emails from this domain can log in (e.g. ideaforgetech.com).</p>
        <label style={s.label}>
          Domain (without @)
          <input
            type="text"
            style={s.input}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ideaforgetech.com"
          />
        </label>
        <button
          style={s.btn}
          onClick={() => saveDomain.mutate(domain)}
          disabled={saveDomain.isPending}
        >
          {saveDomain.isPending ? 'Saving…' : 'Save Domain'}
        </button>
      </section>

      {/* ── SMTP Configuration ─────────────────────────────────────────── */}
      <section style={s.card}>
        <h2 style={s.cardTitle}>
          SMTP Email Configuration
          {cfg?.smtpConfigured && (
            <span style={s.badge}>✓ Configured</span>
          )}
        </h2>
        <p style={s.hint}>Used to send OTP emails to employees.</p>

        <div style={s.grid}>
          {field('SMTP Host', 'host')}
          {field('Port', 'port', 'number')}
          {field('Username', 'user')}
          {field('Password', 'password', 'password')}
          {field('From address', 'from')}
        </div>

        <label style={{ ...s.label, flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            type="checkbox"
            checked={smtp.secure}
            onChange={(e) => setSmtp((p) => ({ ...p, secure: e.target.checked }))}
          />
          Use SSL/TLS (port 465)
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            style={s.btnOutline}
            onClick={() => testSmtp.mutate(smtp)}
            disabled={testSmtp.isPending}
          >
            {testSmtp.isPending ? 'Testing…' : 'Test Connection'}
          </button>
          <button
            style={s.btn}
            onClick={() => saveSmtp.mutate(smtp)}
            disabled={saveSmtp.isPending}
          >
            {saveSmtp.isPending ? 'Saving…' : 'Save SMTP'}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              background: testResult.ok ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`,
              color: testResult.ok ? '#166534' : '#991b1b',
              fontSize: 14,
            }}
          >
            {testResult.ok ? '✓ SMTP connection successful!' : `✗ ${testResult.error}`}
          </div>
        )}
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 720, margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' },
  notice: {
    background: '#fefce8', border: '1px solid #fde047', borderRadius: 8,
    padding: '0.875rem 1rem', marginBottom: '1.5rem', color: '#713f12', fontSize: 14,
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '1.5rem',
    marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)',
    border: '1px solid #e2e8f0',
  },
  cardTitle: { fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  hint: { fontSize: 13, color: '#64748b', marginBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 13, fontWeight: 500, color: '#374151' },
  input: { padding: '0.6rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 14, outline: 'none' },
  btn: { padding: '0.6rem 1.25rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  btnOutline: { padding: '0.6rem 1.25rem', background: 'transparent', color: '#1d4ed8', border: '1.5px solid #1d4ed8', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  badge: { fontSize: 12, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 99, padding: '0.15rem 0.6rem', fontWeight: 600 },
};
