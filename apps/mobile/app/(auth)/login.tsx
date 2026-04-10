import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import type { UserRole } from '@if-fleet/domain';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const requestOtp = useMutation({
    mutationFn: (addr: string) => api.post('/auth/request-otp', { email: addr }),
    onSuccess: () => { setStep('otp'); setError(''); },
    onError: () => setError('Could not send OTP. Check your email address.'),
  });

  const verifyOtp = useMutation({
    mutationFn: ({ email: addr, otp: code }: { email: string; otp: string }) =>
      api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; name: string; email: string; role: UserRole };
      }>('/auth/verify-otp', { email: addr, otp: code }),
    onSuccess: ({ data }) => {
      setAuth(data.user, data.accessToken);
      router.replace('/');
    },
    onError: () => setError('Invalid or expired OTP. Please try again.'),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>iF Fleet</Text>
        <Text style={styles.subtitle}>Company fleet management</Text>

        {step === 'email' ? (
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
              disabled={requestOtp.isPending}
            >
              {requestOtp.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
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
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d4ed8', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 28 },
  logo: { fontSize: 28, fontWeight: '800', color: '#1d4ed8', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  hint: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 16, color: '#0f172a',
  },
  btn: {
    backgroundColor: '#1d4ed8', borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  back: { color: '#64748b', textAlign: 'center', marginTop: 14, fontSize: 14 },
});
