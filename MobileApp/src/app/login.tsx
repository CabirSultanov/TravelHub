import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiDebugInfo } from '@/config/apiConfig';
import { api, isEmailConfirmationRequired } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { user, isSigningIn, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [apiUrl] = useState(__DEV__ ? getApiDebugInfo() : null);

  useEffect(() => {
    let isMounted = true;

    void api.health().then(
      () => {
        if (isMounted) {
          setConnectionError('');
        }
      },
      (healthError: unknown) => {
        if (isMounted) {
          setConnectionError(healthError instanceof Error ? healthError.message : 'TravelHub API is not reachable.');
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, []);

  if (user) {
    return <Redirect href="/(driver)/available" />;
  }

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setError('');
    try {
      await signIn(email, password);
      setConnectionError('');
    } catch (submissionError) {
      setError(
        isEmailConfirmationRequired(submissionError)
          ? 'Please confirm your email in TravelHub before signing in to the Driver app.'
          : submissionError instanceof Error
            ? submissionError.message
            : 'Unable to sign in. Please try again.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Text style={styles.eyebrow}>TRAVELHUB</Text>
            <Text style={styles.title}>Driver</Text>
            <Text style={styles.subtitle}>Sign in with your TravelHub driver, admin, or super admin account.</Text>
            {connectionError ? <Text accessibilityRole="alert" style={styles.connectionError}>{connectionError}</Text> : null}
            {connectionError && __DEV__ && apiUrl ? <Text style={styles.apiDebug}>API: {apiUrl}</Text> : null}
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@gmail.com"
              placeholderTextColor="#78909c"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              autoComplete="password"
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#78909c"
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSigningIn}
              onPress={() => void submit()}
              style={({ pressed }) => [styles.button, (pressed || isSigningIn) && styles.buttonPressed]}
            >
              {isSigningIn ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign in</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f5fafb', flex: 1 },
  keyboard: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  brand: { gap: 8, marginBottom: 44 },
  eyebrow: { color: '#1f7a8c', fontSize: 13, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: '#17323b', fontSize: 42, fontWeight: '800' },
  subtitle: { color: '#607080', fontSize: 16, lineHeight: 24 },
  form: { gap: 10 },
  label: { color: '#31515f', fontSize: 15, fontWeight: '700', marginTop: 8 },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbdde3',
    borderRadius: 12,
    borderWidth: 1,
    color: '#17323b',
    fontSize: 17,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  error: { color: '#a83434', fontSize: 14, lineHeight: 20, marginTop: 6 },
  connectionError: { color: '#a83434', fontSize: 14, lineHeight: 20, marginTop: 8 },
  apiDebug: { color: '#607080', fontSize: 12, lineHeight: 18 },
  button: {
    alignItems: 'center',
    backgroundColor: '#1f7a8c',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 54,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
});
