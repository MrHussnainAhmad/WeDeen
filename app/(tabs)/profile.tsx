import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forgotPassword, login, me, register } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar, GeometricDivider, StarFieldWatermark, MihrabArch } from '@/components/IslamicMotifs';
import { FadeInView, PressableScale } from '@/components/Anim';
import { OrnateCard } from '@/components/ui';

type AuthMode = 'signin' | 'signup';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
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
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.container, styles.authContainer, { paddingTop: Math.max(insets.top + 60, 80) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <FadeInView index={0}>
            <View style={styles.authHero}>
              <StarFieldWatermark rows={3} cols={6} starSize={18} color="rgba(255,255,255,0.05)" />
              <View style={styles.heroArchWrap}>
                <MihrabArch width={130} height={64} color="rgba(197,155,39,0.32)" />
              </View>
              <View style={styles.heroGoldTop} />

              <PressableScale onPress={() => router.push('/settings')} style={styles.authSettingsFab}>
                <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              </PressableScale>

              <View style={styles.authIconWrap}>
                <EightPointStar size={40} color="rgba(197,155,39,0.25)" />
                <Ionicons name="person" size={24} color="#FFFFFF" style={{ position: 'absolute' }} />
              </View>
              <Text style={styles.authHeroTitle}>
                {mode === 'signup' ? 'Create Your Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.authHeroSub}>
                {mode === 'signup' ? 'Join and sync your Quran journey across devices.' : 'Sign in to continue your Quran learning progress.'}
              </Text>
              <View style={styles.modeSwitch}>
                <PressableScale
                  onPress={() => setMode('signup')}
                  style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
                >
                  <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>Signup</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => setMode('signin')}
                  style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
                >
                  <Text style={[styles.modeButtonText, mode === 'signin' && styles.modeButtonTextActive]}>Sign In</Text>
                </PressableScale>
              </View>
            </View>
          </FadeInView>

          <FadeInView index={1}>
            <OrnateCard style={styles.authMainCard} flourish>
              <Text style={styles.cardTitle}>{mode === 'signup' ? 'Account Details' : 'Sign In Details'}</Text>
              <GeometricDivider color={colors.goldBorder} style={{ marginBottom: 14 }} />

              {mode === 'signup' ? (
                <View style={styles.inputField}>
                  <Ionicons name="person-outline" size={18} color={colors.muted} />
                  <TextInput
                    placeholder="Name"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor={colors.faint}
                    style={styles.inputInner}
                  />
                </View>
              ) : null}

              <View style={styles.inputField}>
                <Ionicons name="mail-outline" size={18} color={colors.muted} />
                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor={colors.faint}
                  style={styles.inputInner}
                />
              </View>

              <View style={styles.inputField}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={colors.faint}
                  style={styles.inputInner}
                />
                <PressableScale onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </PressableScale>
              </View>

              {mode === 'signup' ? (
                <View style={styles.inputField}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.muted} />
                  <TextInput
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholderTextColor={colors.faint}
                    style={styles.inputInner}
                  />
                  <PressableScale onPress={() => setShowConfirmPassword((v) => !v)}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                  </PressableScale>
                </View>
              ) : null}

              <PressableScale
                onPress={() => authMutation.mutate()}
                disabled={authMutation.isPending}
                style={[styles.primaryButton, authMutation.isPending && styles.buttonDisabled]}
              >
                {authMutation.isPending ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.primaryButtonText}>{mode === 'signup' ? 'Signing up…' : 'Signing in…'}</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
                )}
              </PressableScale>

              {mode === 'signin' ? (
                <PressableScale onPress={() => forgotPasswordMutation.mutate()} style={styles.linkButton}>
                  <Text style={styles.linkText}>Reset password</Text>
                </PressableScale>
              ) : null}

              <PressableScale onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={styles.linkButton}>
                <Text style={styles.linkText}>
                  {mode === 'signup' ? 'Already have an account? Sign in' : 'No account yet? Signup'}
                </Text>
              </PressableScale>
            </OrnateCard>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const initial = (user?.name?.[0] || 'U').toUpperCase();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 14, 22) }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeInView index={0}>
        <View style={styles.profileHero}>
          <StarFieldWatermark rows={3} cols={6} starSize={18} color="rgba(255,255,255,0.05)" />
          <View style={styles.heroGoldTop} />
          <View style={styles.avatarRing}>
            <EightPointStar size={86} color="rgba(197,155,39,0.18)" />
            <View style={styles.avatarInner}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{user?.name ?? 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <GeometricDivider color="rgba(197,155,39,0.5)" style={{ marginTop: 16 }} />
        </View>
      </FadeInView>

      <FadeInView index={1}>
        <View style={styles.menuList}>
          <PressableScale onPress={() => router.push('/settings')} style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primaryTint }]}>
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Settings</Text>
              <Text style={styles.menuSub}>Reading, prayer format & account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </PressableScale>

          <PressableScale onPress={() => router.push('/quran')} style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: colors.goldSoft, borderColor: colors.goldBorder }]}>
              <MaterialCommunityIcons name="book-open-page-variant" size={20} color={colors.goldDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Read Quran</Text>
              <Text style={styles.menuSub}>Browse all 114 Surahs</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </PressableScale>
        </View>
      </FadeInView>

      <FadeInView index={2}>
        <PressableScale onPress={() => logout()} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </PressableScale>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 16, paddingBottom: 110, flexGrow: 1 },
  authContainer: { paddingBottom: 64 },

  // Auth hero
  authHero: {
    backgroundColor: colors.primaryDeep, borderRadius: radius.xl, padding: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.primaryDark, alignItems: 'flex-start', ...shadow.raised,
  },
  heroArchWrap: { position: 'absolute', top: 0, alignSelf: 'center' },
  heroGoldTop: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, backgroundColor: colors.gold, opacity: 0.45 },
  authSettingsFab: {
    position: 'absolute', top: 18, right: 16, zIndex: 5, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center', justifyContent: 'center',
  },
  authIconWrap: {
    width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12, marginTop: 6,
  },
  authHeroTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 22, fontFamily: fonts.serif },
  authHeroSub: { color: colors.onDarkMuted, marginTop: 5, fontWeight: '500', lineHeight: 20, fontSize: 13 },
  modeSwitch: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.pill,
    padding: 4, marginTop: 16, alignSelf: 'center',
  },
  modeButton: { minWidth: 100, paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center' },
  modeButtonActive: { backgroundColor: colors.gold },
  modeButtonText: { color: colors.onDarkMuted, fontWeight: '800', fontSize: 13 },
  modeButtonTextActive: { color: colors.primaryDeep },

  authMainCard: { marginTop: 4 },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 17, fontFamily: fonts.serif },

  inputField: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.cardAlt,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 13 : 4, marginBottom: 10,
  },
  inputInner: { flex: 1, color: colors.text, fontSize: 14.5, paddingVertical: Platform.OS === 'ios' ? 0 : 8 },

  primaryButton: {
    backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 4,
    ...shadow.soft,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkButton: { marginTop: 12, alignSelf: 'center' },
  linkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  // Logged-in profile
  profileHero: {
    backgroundColor: colors.primaryDeep, borderRadius: radius.xl, padding: 24, alignItems: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: colors.primaryDark, ...shadow.raised,
  },
  avatarRing: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarInner: {
    position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: colors.primaryDeep, fontWeight: '900', fontSize: 28, fontFamily: fonts.serif },
  profileName: { color: '#fff', fontWeight: '800', fontSize: 22, fontFamily: fonts.serif },
  profileEmail: { color: colors.onDarkMuted, marginTop: 4, fontWeight: '500', fontSize: 13 },

  menuList: { gap: 12 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card,
    borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  menuIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  menuTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  menuSub: { color: colors.muted, fontSize: 12, marginTop: 2 },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft,
    borderRadius: radius.md, paddingVertical: 14, borderWidth: 1, borderColor: '#F0CFC8', marginTop: 'auto',
  },
  logoutText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
