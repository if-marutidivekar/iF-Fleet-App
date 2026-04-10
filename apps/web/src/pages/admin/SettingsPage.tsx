import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const EMPTY_SMTP: SmtpConfig = {
  host: '', port: 587, secure: false, user: '', password: '', from: '',
};

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: ok ? '#166534' : '#991b1b', color: '#fff',
      padding: '0.75rem 1.25rem', borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,.2)', fontSize: 14, fontWeight: 500,
    }}>
      {ok ? '✓' : '✗'} {msg}
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: cfg } = useQuery<SystemConfig>({
    queryKey: ['admin-config'],
    queryFn: () => api.get<SystemConfig>('/admin/config').then((r) => r.data),
  });

  const [smtp, setSmtp] = useState<SmtpConfig>(EMPTY_SMTP);
  const [smtpReady, setSmtpReady] = useState(false);
  const [domain, setDomain] = useState('');
  const [domainReady, setDomainReady] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Pre-fill once config arrives
  if (cfg && !smtpReady) {
    setSmtpReady(true);
    if (cfg.smtp) setSmtp({ ...cfg.smtp, password: '' });
  }
  if (cfg && !domainReady) {
    setDomainReady(true);
    setDomain(cfg.companyDomain ?? '');
  }

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const errMsg = (e: unknown) => {
    const m = (e as { response?: { data?: { message?: string | string[] } } })
      ?.response?.data?.message;
    return Array.isArray(m) ? m.join(', ') : (m ?? 'Unknown error');
  };

  const saveSmtp = useMutation({
    mutationFn: (s: SmtpConfig) => api.put('/admin/config/smtp', s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-config'] }); showToast('SMTP configuration saved!', true); },
    onError: (e) => showToast(errMsg(e), false),
  });

  const testSmtp = useMutation({
    mutationFn: (s: SmtpConfig) =>
      api.post<{ ok: boolean; error?: string }>('/admin/config/smtp/test', s).then((r) => r.data),
    onSuccess: (res) => setTestResult(res),
    onError: (e) => setTestResult({ ok: false, error: errMsg(e) }),
  });

  const saveDomain = useMutation({
    mutationFn: (d: string) => api.put('/admin/config/domain', { domain: d }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-config'] }); showToast('Company domain saved!', true); },
    onError: () => showToast('Failed to save domain', false),
  });

  const field = (label: string, key: keyof SmtpConfig, type = 'text') => (
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
        placeholder={type === 'password' ? '(leave blank to keep current)' : undefined}
      />
    </label>
  );

  return (
    <div style={s.page}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <div style={s.header}>
        <button onClick={() => navigate(-1)} style={s.back}>← Back</button>
        <h1 style={s.title}>System Settings</h1>
      </div>

      {cfg && !cfg.smtpConfigured && (
        <div style={s.notice}>
          ⚠ <strong>SMTP not configured</strong> — OTPs are currently printed to the server
          terminal. Configure SMTP below so users receive OTP emails.
        </div>
      )}

      {/* ── Company Email Domain ──────────────────────────────────── */}
      <section style={s.card}>
        <h2 style={s.cardTitle}>Company Email Domain</h2>
        <p style={s.hint}>Only emails from this domain can log in (e.g. ideaforgetech.com).</p>
        <label style={s.label}>
          Domain (without @)
          <input
            type="text" style={s.input} value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="ideaforgetech.com"
          />
        </label>
        <button style={s.btn} onClick={() => saveDomain.mutate(domain)} disabled={saveDomain.isPending || !domain.trim()}>
          {saveDomain.isPending ? 'Saving…' : 'Save Domain'}
        </button>
      </section>

      {/* ── SMTP Configuration ───────────────────────────────────── */}
      <section style={s.card}>
        <h2 style={s.cardTitle}>
          SMTP Email Configuration
          {cfg?.smtpConfigured && <span style={s.badge}>✓ Configured</span>}
        </h2>
        <p style={s.hint}>Used to send OTP emails to employees.</p>

        <div style={s.grid}>
          {field('SMTP Host', 'host')}
          {field('Port', 'port', 'number')}
          {field('Username / Email', 'user')}
          {field('Password', 'password', 'password')}
        </div>
        {field('From Address (shown to recipients)', 'from', 'email')}

        <label style={{ ...s.label, flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp((p) => ({ ...p, secure: e.target.checked }))} />
          Use SSL/TLS (port 465)
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button style={s.btnOutline} onClick={() => { setTestResult(null); testSmtp.mutate(smtp); }} disabled={testSmtp.isPending || !smtp.host}>
            {testSmtp.isPending ? 'Testing…' : 'Test Connection'}
          </button>
          <button style={s.btn} onClick={() => saveSmtp.mutate(smtp)} disabled={saveSmtp.isPending || !smtp.host || !smtp.user || !smtp.from}>
            {saveSmtp.isPending ? 'Saving…' : 'Save SMTP'}
          </button>
        </div>

        {testResult && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: 8, background: testResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`, color: testResult.ok ? '#166534' : '#991b1b', fontSize: 14 }}>
            {testResult.ok ? '✓ SMTP connection successful!' : `✗ ${testResult.error}`}
          </div>
        )}

        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f1f5f9', borderRadius: 8, fontSize: 13, color: '#475569' }}>
          <strong>Gmail:</strong> Host <code>smtp.gmail.com</code> · Port <code>587</code> · Username = your Gmail · Password = <em>App Password</em> (myaccount.google.com → Security → App passwords)
        </div>
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 740, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' },
  back: { background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 6, padding: '0.4rem 0.875rem', cursor: 'pointer', fontSize: 14, color: '#64748b', fontWeight: 500 },
  title: { fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 },
  notice: { background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '0.875rem 1rem', marginBottom: '1.5rem', color: '#713f12', fontSize: 14 },
  card: { background: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)', border: '1px solid #e2e8f0' },
  cardTitle: { fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
  hint: { fontSize: 13, color: '#64748b', marginBottom: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: 13, fontWeight: 500, color: '#374151' },
  input: { padding: '0.6rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  btn: { padding: '0.6rem 1.25rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  btnOutline: { padding: '0.6rem 1.25rem', background: 'transparent', color: '#1d4ed8', border: '1.5px solid #1d4ed8', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 },
  badge: { fontSize: 12, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 99, padding: '0.15rem 0.6rem', fontWeight: 600 },
};
