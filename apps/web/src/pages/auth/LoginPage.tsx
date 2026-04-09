import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import type { UserRole } from '@if-fleet/domain';
import styles from './LoginPage.module.css';

type Step = 'email' | 'otp';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const requestOtp = useMutation({
    mutationFn: (email: string) => api.post('/auth/request-otp', { email }),
    onSuccess: () => { setStep('otp'); setError(''); },
    onError: () => setError('Could not send OTP. Check your email address.'),
  });

  const verifyOtp = useMutation({
    mutationFn: ({ email, employeeId, otp }: { email: string; employeeId: string; otp: string }) =>
      api.post<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: UserRole } }>(
        '/auth/verify-otp',
        { email, employeeId, otp },
      ),
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken);
      // Store refresh token in httpOnly cookie via a separate endpoint in production
      localStorage.setItem('if-fleet-rt', data.refreshToken);
      navigate('/');
    },
    onError: () => setError('Invalid OTP or employee ID. Please try again.'),
  });

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.logo}>iF Fleet</h1>
        <p className={styles.subtitle}>Company fleet management</p>

        {step === 'email' ? (
          <form
            onSubmit={(e) => { e.preventDefault(); requestOtp.mutate(email); }}
            className={styles.form}
          >
            <label className={styles.label}>
              Company email
              <input
                type="email"
                className={styles.input}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <button
              type="submit"
              className={styles.btn}
              disabled={requestOtp.isPending}
            >
              {requestOtp.isPending ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); verifyOtp.mutate({ email, employeeId, otp }); }}
            className={styles.form}
          >
            <p className={styles.hint}>OTP sent to <strong>{email}</strong></p>
            <label className={styles.label}>
              Employee ID
              <input
                type="text"
                className={styles.input}
                placeholder="EMP-1042"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label className={styles.label}>
              One-time password
              <input
                type="text"
                className={styles.input}
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                required
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <button
              type="submit"
              className={styles.btn}
              disabled={verifyOtp.isPending || otp.length !== 6}
            >
              {verifyOtp.isPending ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => { setStep('email'); setOtp(''); setError(''); }}
            >
              ← Change email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
