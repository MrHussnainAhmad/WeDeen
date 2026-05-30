import { useMutation } from '@tanstack/react-query';
import { useLayoutEffect, useState } from 'react';
import { router, useNavigation } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { forgotPassword, login, me, register } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

type AuthMode = 'signin' | 'signup';

export default function ProfileScreen() {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !!token,
      title: 'Profile',
    });
  }, [navigation, token]);

  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'signup') {
        return register({ name, email, password, confirmPassword });
      }
      return login({ email, password });
    },
    onSuccess: async (data) => {
      await setAuth(data.token, data.user);
      const profile = await me(data.token);
      await setAuth(data.token, profile.user);
      setPassword('');
      setConfirmPassword('');
      Alert.alert(mode === 'signup' ? 'Signup Successful' : 'Login Successful', mode === 'signup' ? 'Your account is ready.' : 'Welcome back.');
    },
    onError: (error: any) => {
      Alert.alert('Request Failed', error?.response?.data?.message || 'Request failed');
    }
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: () => forgotPassword({ email }),
    onSuccess: (data) => Alert.alert('Reset Requested', data.message),
    onError: (error: any) => Alert.alert('Reset Failed', error?.response?.data?.message || 'Could not request reset')
  });

  if (!token) {
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.container, styles.authContainer]} showsVerticalScrollIndicator={false}>
        <View style={styles.authHero}>
          <View style={styles.authIconWrap}>
            <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.authHeroTitle}>
            {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.authHeroSub}>
            {mode === 'signup' ? 'Join and sync your Quran journey across devices.' : 'Sign in to continue your Quran learning progress.'}
          </Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => setMode('signup')}
            style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>Signup</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('signin')}
            style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, mode === 'signin' && styles.modeButtonTextActive]}>Sign In</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{mode === 'signup' ? 'Account Details' : 'Sign In Details'}</Text>

        {mode === 'signup' ? (
          <TextInput
            placeholder="Name"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#8E9B95"
            style={styles.input}
          />
        ) : null}

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor="#8E9B95"
          style={styles.input}
        />
        <View style={styles.passwordField}>
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor="#8E9B95"
            style={styles.passwordInput}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6A7B74" />
          </Pressable>
        </View>

        {mode === 'signup' ? (
          <View style={styles.passwordField}>
            <TextInput
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor="#8E9B95"
              style={styles.passwordInput}
            />
            <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={8}>
              <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6A7B74" />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => authMutation.mutate()}
          disabled={authMutation.isPending}
          style={[styles.actionButton, styles.primaryButton, authMutation.isPending && styles.buttonDisabled]}
        >
          {authMutation.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.actionButtonText}>{mode === 'signup' ? 'Signing up...' : 'Signing in...'}</Text>
            </View>
          ) : (
            <Text style={styles.actionButtonText}>
              {mode === 'signup' ? 'Signup' : 'Sign In'}
            </Text>
          )}
        </Pressable>

        {mode === 'signin' ? (
          <Pressable onPress={() => forgotPasswordMutation.mutate()} style={styles.linkButton}>
            <Text style={styles.linkText}>Reset password</Text>
          </Pressable>
        ) : null}

          <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={styles.linkButton}>
            <Text style={styles.linkText}>
              {mode === 'signup' ? 'Already have an account? Sign in' : 'No account yet? Signup'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHero}>
        <View style={styles.profileIconCircle}>
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>
        <Text style={styles.profileName}>{user?.name ?? 'User'}</Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      <View style={styles.bottomActions}>
        <Pressable onPress={() => router.push('/settings')} style={[styles.actionButton, styles.primaryButton]}>
          <Text style={styles.actionButtonText}>Settings</Text>
        </Pressable>

        <Pressable onPress={() => logout()} style={[styles.actionButton, styles.mutedButton]}>
          <Text style={styles.actionButtonText}>Logout</Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  authContainer: {
    paddingTop: 84,
  },
  authHero: {
    backgroundColor: '#ECF6F2',
    borderColor: '#D8ECE4',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  authIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  authHeroTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 20,
  },
  authHeroSub: {
    color: colors.muted,
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 20,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#EAF2EF',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D6E8E1',
  },
  modeButtonText: {
    color: colors.muted,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: colors.primary,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#F7FAF9',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E1ECE8',
    color: colors.text,
  },
  passwordField: {
    backgroundColor: '#F7FAF9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1ECE8',
    paddingHorizontal: 11,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: 8,
    paddingRight: 8,
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  mutedButton: {
    backgroundColor: '#5A6A63',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomActions: {
    marginTop: 'auto',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkButton: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  linkText: {
    color: colors.primary,
    fontWeight: '700',
  },
  profileHero: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  profileIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ECF6F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileName: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 19,
  },
  profileEmail: {
    color: colors.muted,
    marginTop: 3,
    fontWeight: '500',
  },
});
