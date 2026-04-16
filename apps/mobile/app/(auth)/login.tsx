import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore, type AuthUser } from '../../stores/auth.store';
import type { UserRole } from '@if-fleet/domain';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'otp' | 'pin';
type OtpStep = 'email' | 'otp';
type PinStep = 'mobile' | 'pin';

interface LoginUser {
  id: string;
  userCode?: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  department?: string | null;
  mobileNumber?: string | null;
  role: UserRole;
  profileCompleted: boolean;
}

// ─── OTP Login Flow ───────────────────────────────────────────────────────────

function OtpFlow({ onSuccess }: { onSuccess: (user: LoginUser, token: string, rt: string) => void }) {
  const [step, setStep] = useState<OtpStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const requestOtp = useMutation({
    mutationFn: (addr: string) => api.post('/auth/request-otp', { email: addr }),
    onSuccess: () => { setStep('otp'); setError(''); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Could not send OTP. Check your email address.');
    },
  });

  const verifyOtp = useMutation({
    mutationFn: ({ email: addr, otp: code }: { email: string; otp: string }) =>
      api.post<{ accessToken: string; refreshToken: string; user: LoginUser }>(
        '/auth/verify-otp', { email: addr, otp: code },
      ),
    onSuccess: ({ data }) => onSuccess(data.user, data.accessToken, data.refreshToken),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid or expired OTP. Please try again.');
    },
  });

  if (step === 'email') {
    return (
      <>
        <Text style={styles.label}>Company email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@ideaforgetech.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoFocus
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={[styles.btn, requestOtp.isPending && styles.btnDisabled]}
          onPress={() => requestOtp.mutate(email)}
          disabled={requestOtp.isPending || !email}
        >
          {requestOtp.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Send OTP</Text>}
        </TouchableOpacity>
      </>
    );
  }

  return (
    <>
      <Text style={styles.hint}>OTP sent to {email}</Text>
      <Text style={styles.label}>One-time password</Text>
      <TextInput
        style={styles.input}
        placeholder="6-digit code"
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.btn, (verifyOtp.isPending || otp.length !== 6) && styles.btnDisabled]}
        onPress={() => verifyOtp.mutate({ email, otp })}
        disabled={verifyOtp.isPending || otp.length !== 6}
      >
        {verifyOtp.isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Sign in</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); setError(''); }}>
        <Text style={styles.back}>← Change email</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── PIN Login Flow ───────────────────────────────────────────────────────────

function PinFlow({ onSuccess }: { onSuccess: (user: LoginUser, token: string, rt: string, pinMustChange: boolean) => void }) {
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
      setError(msg ?? 'Mobile number not registered for PIN login.');
    },
  });

  const verifyPin = useMutation({
    mutationFn: ({ mobileNumber, pin: p }: { mobileNumber: string; pin: string }) =>
      api.post<{ accessToken: string; refreshToken: string; pinMustChange: boolean; user: LoginUser }>(
        '/auth/driver/verify-pin', { mobileNumber, pin: p },
      ),
    onSuccess: ({ data }) => onSuccess(data.user, data.accessToken, data.refreshToken, data.pinMustChange),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Invalid PIN. Please try again.');
    },
  });

  if (step === 'mobile') {
    return (
      <>
        <Text style={styles.label}>Mobile number</Text>
        <TextInput
          style={styles.input}
          placeholder="+919876543210"
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          autoFocus
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={[styles.btn, (requestPinLogin.isPending || !mobile) && styles.btnDisabled]}
          onPress={() => requestPinLogin.mutate(mobile)}
          disabled={requestPinLogin.isPending || !mobile}
        >
          {requestPinLogin.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Continue</Text>}
        </TouchableOpacity>
      </>
    );
  }

  return (
    <>
      <Text style={styles.hint}>Enter PIN for {mobile}</Text>
      <Text style={styles.label}>6-digit PIN</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••"
        value={pin}
        onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        secureTextEntry
        autoFocus
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.btn, (verifyPin.isPending || pin.length !== 6) && styles.btnDisabled]}
        onPress={() => verifyPin.mutate({ mobileNumber: mobile, pin })}
        disabled={verifyPin.isPending || pin.length !== 6}
      >
        {verifyPin.isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Sign in</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setStep('mobile'); setPin(''); setError(''); }}>
        <Text style={styles.back}>← Change number</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Forced PIN Change Screen ─────────────────────────────────────────────────

function ChangePinScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const changePin = useMutation({
    mutationFn: () =>
      api.post(
        '/auth/driver/change-pin',
        { currentPin, newPin },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    onSuccess: () => { setSuccess(true); },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to change PIN.'));
    },
  });

  const canSubmit =
    currentPin.length === 6 && newPin.length === 6 && confirmPin.length === 6 && !changePin.isPending;

  if (success) {
    return (
      <View style={styles.card}>
        <Text style={styles.logo}>iF Fleet</Text>
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>PIN Changed</Text>
          <Text style={styles.successMsg}>Your PIN has been updated successfully.</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={onDone}>
          <Text style={styles.btnText}>Continue to App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.logo}>iF Fleet</Text>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>You must change your PIN before continuing.</Text>
      </View>

      <Text style={styles.label}>Current PIN</Text>
      <TextInput
        style={styles.input}
        placeholder="Current 6-digit PIN"
        value={currentPin}
        onChangeText={(v) => setCurrentPin(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        secureTextEntry
        autoFocus
      />

      <Text style={styles.label}>New PIN</Text>
      <TextInput
        style={styles.input}
        placeholder="New 6-digit PIN"
        value={newPin}
        onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        secureTextEntry
      />

      <Text style={styles.label}>Confirm New PIN</Text>
      <TextInput
        style={[styles.input, confirmPin.length === 6 && newPin !== confirmPin ? styles.inputError : {}]}
        placeholder="Repeat new PIN"
        value={confirmPin}
        onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        secureTextEntry
      />
      {confirmPin.length === 6 && newPin !== confirmPin && (
        <Text style={styles.error}>PINs do not match</Text>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.btn, (!canSubmit || newPin !== confirmPin) && styles.btnDisabled]}
        onPress={() => changePin.mutate()}
        disabled={!canSubmit || newPin !== confirmPin}
      >
        {changePin.isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Set New PIN</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Root Login Screen ────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [tab, setTab] = useState<Tab>('otp');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingRefreshToken, setPendingRefreshToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<LoginUser | null>(null);

  const applyLogin = (user: LoginUser, token: string, rt: string) => {
    const authUser: AuthUser = {
      id: user.id,
      userCode: user.userCode,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: user.department,
      mobileNumber: user.mobileNumber,
      role: user.role,
      profileCompleted: user.profileCompleted ?? false,
    };
    setAuth(authUser, token, rt);
  };

  // After OTP login
  const handleOtpSuccess = (user: LoginUser, token: string, rt: string) => {
    applyLogin(user, token, rt);
    router.replace(user.profileCompleted ? '/' : '/(auth)/complete-profile');
  };

  // After PIN verify — may require forced change
  const handlePinSuccess = (user: LoginUser, token: string, rt: string, pinMustChange: boolean) => {
    if (pinMustChange) {
      setPendingToken(token);
      setPendingRefreshToken(rt);
      setPendingUser(user);
    } else {
      applyLogin(user, token, rt);
      router.replace(user.profileCompleted ? '/' : '/(auth)/complete-profile');
    }
  };

  // After forced PIN change completes
  const handlePinChanged = () => {
    if (pendingUser && pendingToken && pendingRefreshToken) {
      applyLogin(pendingUser, pendingToken, pendingRefreshToken);
      router.replace(pendingUser.profileCompleted ? '/' : '/(auth)/complete-profile');
    }
  };

  // Show forced PIN change screen
  if (pendingToken && pendingUser) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ChangePinScreen token={pendingToken} onDone={handlePinChanged} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>iF Fleet</Text>
        <Text style={styles.subtitle}>Company fleet management</Text>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'otp' && styles.tabBtnActive]}
            onPress={() => setTab('otp')}
          >
            <Text style={[styles.tabText, tab === 'otp' && styles.tabTextActive]}>Email OTP</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'pin' && styles.tabBtnActive]}
            onPress={() => setTab('pin')}
          >
            <Text style={[styles.tabText, tab === 'pin' && styles.tabTextActive]}>Driver PIN</Text>
          </TouchableOpacity>
        </View>

        {tab === 'otp'
          ? <OtpFlow onSuccess={handleOtpSuccess} />
          : <PinFlow onSuccess={handlePinSuccess} />}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d4ed8', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28 },
  logo: { fontSize: 28, fontWeight: '800', color: '#1d4ed8', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 },

  // Tabs
  tabRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 8, marginBottom: 20, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1d4ed8' },

  // Inputs
  hint: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 16, color: '#0f172a',
  },
  inputError: { borderColor: '#dc2626' },

  // Buttons
  btn: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Misc
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  back: { color: '#64748b', textAlign: 'center', marginTop: 14, fontSize: 14 },

  // Warning / Success
  warningBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 12, marginBottom: 16 },
  warningText: { color: '#92400e', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  successBox: { alignItems: 'center', marginBottom: 20 },
  successIcon: { fontSize: 40, color: '#059669', marginBottom: 8 },
  successTitle: { fontSize: 18, fontWeight: '800', color: '#059669', marginBottom: 4 },
  successMsg: { fontSize: 13, color: '#374151', textAlign: 'center', lineHeight: 18 },
});
