import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import type { UserRole } from '@if-fleet/domain';
import styles from './LoginPage.module.css';

type Tab = 'otp' | 'pin';
type OtpStep = 'email' | 'otp';
type PinStep = 'mobile' | 'pin';

// ─── Email OTP flow ───────────────────────────────────────────────────────────

function OtpFlow({ onSuccess }: {
  onSuccess: (user: { id: string; name: string; email: string; role: UserRole }, token: string, rt: string) => void;
}) {
  const [step, setStep] = useState<OtpStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const requestOtp = useMutation({
    mutationFn: (addr: string) => api.post('/auth/request-otp', { email: addr }),
    onSuccess: () => { setStep('otp'); setError(''); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Could not send OTP. Check your email address.');
    },
  });

  const verifyOtp = useMutation({
    mutationFn: ({ email: addr, otp: code }: { email: string; otp: string }) =>
      api.post<{
        accessToken: string; refreshToken: string;
        user: { id: string; name: string; email: string; role: UserRole };
      }>('/auth/verify-otp', { email: addr, otp: code }),
    onSuccess: ({ data }) => onSuccess(data.user, data.accessToken, data.refreshToken),
    onError: () => setError('Invalid or expired OTP. Please try again.'),
  });

  if (step === 'email') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); requestOtp.mutate(email); }} className={styles.form}>
        <label className={styles.label}>
          Company email
          <input type="email" className={styles.input} placeholder="you@ideaforgetech.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.btn} disabled={requestOtp.isPending}>
          {requestOtp.isPending ? 'Sending…' : 'Send OTP'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); verifyOtp.mutate({ email, otp }); }} className={styles.form}>
      <p className={styles.hint}>OTP sent to <strong>{email}</strong></p>
      <label className={styles.label}>
        One-time password
        <input type="text" className={styles.input} placeholder="6-digit code"
          value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" maxLength={6} required autoFocus />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" className={styles.btn} disabled={verifyOtp.isPending || otp.length !== 6}>
        {verifyOtp.isPending ? 'Verifying…' : 'Sign in'}
      </button>
      <button type="button" className={styles.btnSecondary}
        onClick={() => { setStep('email'); setOtp(''); setError(''); }}>
        ← Change email
      </button>
    </form>
  );
}

// ─── Driver PIN flow ──────────────────────────────────────────────────────────

function PinFlow({ onSuccess }: {
  onSuccess: (
    user: { id: string; name: string; email: string; role: UserRole },
    token: string,
    rt: string,
    pinMustChange: boolean,
  ) => void;
}) {
  const [step, setStep] = useState<PinStep>('mobile');
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const requestPinLogin = useMutation({
    mutationFn: (mobileNumber: string) =>
      api.post('/auth/driver/request-pin-login', { mobileNumber }),
    onSuccess: () => { setStep('pin'); setError(''); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Mobile number not registered for PIN login.');
    },
  });

  const verifyPin = useMutation({
    mutationFn: ({ mobileNumber, pin: p }: { mobileNumber: string; pin: string }) =>
      api.post<{
        accessToken: string; refreshToken: string; pinMustChange: boolean;
        user: { id: string; name: string; email: string; role: UserRole };
      }>('/auth/driver/verify-pin', { mobileNumber, pin: p }),
    onSuccess: ({ data }) =>
      onSuccess(data.user, data.accessToken, data.refreshToken, data.pinMustChange),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Invalid PIN. Please try again.');
    },
  });

  if (step === 'mobile') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); requestPinLogin.mutate(mobile); }} className={styles.form}>
        <label className={styles.label}>
          Mobile number
          <input type="tel" className={styles.input} placeholder="+919876543210"
            value={mobile} onChange={(e) => setMobile(e.target.value)} required autoFocus />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.btn} disabled={requestPinLogin.isPending || !mobile}>
          {requestPinLogin.isPending ? 'Checking…' : 'Continue'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); verifyPin.mutate({ mobileNumber: mobile, pin }); }} className={styles.form}>
      <p className={styles.hint}>Enter PIN for <strong>{mobile}</strong></p>
      <label className={styles.label}>
        6-digit PIN
        <input type="password" className={styles.input} placeholder="••••••"
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" maxLength={6} required autoFocus />
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <button type="submit" className={styles.btn} disabled={verifyPin.isPending || pin.length !== 6}>
        {verifyPin.isPending ? 'Verifying…' : 'Sign in'}
      </button>
      <button type="button" className={styles.btnSecondary}
        onClick={() => { setStep('mobile'); setPin(''); setError(''); }}>
        ← Change number
      </button>
    </form>
  );
}

// ─── Forced PIN change screen ─────────────────────────────────────────────────

function ChangePinScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const changePin = useMutation({
    mutationFn: () =>
      api.post('/auth/driver/change-pin', { currentPin, newPin },
        { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => setDone(true),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : 'Failed to change PIN.'));
    },
  });

  if (done) {
    return (
      <div className={styles.form}>
        <div className={styles.successBox}>
          <span className={styles.successIcon}>✓</span>
          <p className={styles.successTitle}>PIN changed successfully</p>
          <p className={styles.hint}>You can now use your new PIN to log in.</p>
        </div>
        <button className={styles.btn} onClick={onDone}>Continue to app</button>
      </div>
    );
  }

  const mismatch = confirmPin.length === 6 && newPin !== confirmPin;

  return (
    <>
      <div className={styles.warningBox}>
        You must set a new PIN before continuing.
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); changePin.mutate(); }}
        className={styles.form}
      >
        <label className={styles.label}>
          Current PIN
          <input type="password" className={styles.input} placeholder="Current 6-digit PIN"
            value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" maxLength={6} required autoFocus />
        </label>
        <label className={styles.label}>
          New PIN
          <input type="password" className={styles.input} placeholder="New 6-digit PIN"
            value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" maxLength={6} required />
        </label>
        <label className={styles.label}>
          Confirm new PIN
          <input type="password"
            className={`${styles.input} ${mismatch ? styles.inputError : ''}`}
            placeholder="Repeat new PIN"
            value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" maxLength={6} required />
        </label>
        {mismatch && <p className={styles.error}>PINs do not match</p>}
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.btn}
          disabled={changePin.isPending || currentPin.length !== 6 || newPin.length !== 6 || newPin !== confirmPin}>
          {changePin.isPending ? 'Saving…' : 'Set new PIN'}
        </button>
      </form>
    </>
  );
}

// ─── Root login page ──────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [tab, setTab] = useState<Tab>('otp');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<{ id: string; name: string; email: string; role: UserRole } | null>(null);

  const handleOtpSuccess = (
    user: { id: string; name: string; email: string; role: UserRole },
    token: string,
    rt: string,
  ) => {
    setAuth(user, token);
    localStorage.setItem('if-fleet-rt', rt);
    navigate('/');
  };

  const handlePinSuccess = (
    user: { id: string; name: string; email: string; role: UserRole },
    token: string,
    rt: string,
    pinMustChange: boolean,
  ) => {
    localStorage.setItem('if-fleet-rt', rt);
    if (pinMustChange) {
      setPendingToken(token);
      setPendingUser(user);
    } else {
      setAuth(user, token);
      navigate('/');
    }
  };

  const handlePinChanged = () => {
    if (pendingUser && pendingToken) {
      setAuth(pendingUser, pendingToken);
      navigate('/');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.logo}>iF Fleet</h1>
        <p className={styles.subtitle}>Company fleet management</p>

        {/* Forced PIN change — replaces the normal form */}
        {pendingToken && pendingUser ? (
          <ChangePinScreen token={pendingToken} onDone={handlePinChanged} />
        ) : (
          <>
            {/* Tab switcher */}
            <div className={styles.tabRow}>
              <button
                type="button"
                className={`${styles.tabBtn} ${tab === 'otp' ? styles.tabBtnActive : ''}`}
                onClick={() => setTab('otp')}
              >
                Email OTP
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${tab === 'pin' ? styles.tabBtnActive : ''}`}
                onClick={() => setTab('pin')}
              >
                Driver PIN
              </button>
            </div>

            {tab === 'otp'
              ? <OtpFlow onSuccess={handleOtpSuccess} />
              : <PinFlow onSuccess={handlePinSuccess} />}
          </>
        )}
      </div>
    </div>
  );
}
