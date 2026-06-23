import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { EightPointStar, GeometricDivider, StarFieldWatermark } from '@/components/IslamicMotifs';
import { resetPassword } from '@/services/authService';
import { fonts, radius, shadow, type ThemeColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export default function ResetPasswordScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      resetPassword({ token: token ?? '', newPassword, confirmPassword }),
    onSuccess: () => {
      Alert.alert('Password Reset', 'Your password has been updated. You can now sign in.', [
        { text: 'Sign In', onPress: () => router.replace('/profile') },
      ]);
    },
    onError: (error: any) => {
      Alert.alert(
        'Reset Failed',
        error?.response?.data?.message || 'This reset link is invalid or has expired.'
      );
    },
  });

  const submit = () => {
    if (!token) {
      Alert.alert('Invalid Link', 'This password reset link is missing its token.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Password Too Short', 'Use at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Enter the same password in both fields.');
      return;
    }
    mutation.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Math.max(insets.top + 36, 56), paddingBottom: insets.bottom + 30 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <StarFieldWatermark rows={3} cols={6} starSize={18} color="rgba(255,255,255,0.05)" />
          <EightPointStar size={46} color={colors.gold} filled={false} />
          <Text style={styles.title}>Choose a New Password</Text>
          <Text style={styles.subtitle}>Secure your WeDeen account with a fresh password.</Text>
        </View>

        <View style={styles.card}>
          <GeometricDivider color={colors.goldBorder} style={{ marginBottom: 18 }} />
          {!token ? <Text style={styles.error}>This reset link is incomplete or invalid.</Text> : null}

          <View style={styles.inputField}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor={colors.faint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.input}
            />
            <PressableScale onPress={() => setShowPassword((value) => !value)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.muted}
              />
            </PressableScale>
          </View>

          <View style={styles.inputField}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.muted} />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.faint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <PressableScale
            onPress={submit}
            disabled={mutation.isPending || !token}
            style={[styles.button, (mutation.isPending || !token) && styles.buttonDisabled]}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </PressableScale>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    container: { flexGrow: 1, padding: 16, gap: 16, justifyContent: 'center' },
    hero: {
      backgroundColor: colors.primaryDeep,
      borderRadius: radius.xl,
      padding: 26,
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.primaryDark,
      ...shadow.raised,
    },
    title: { color: '#fff', fontFamily: fonts.serif, fontWeight: '800', fontSize: 23, marginTop: 14 },
    subtitle: { color: colors.onDarkMuted, textAlign: 'center', lineHeight: 20, marginTop: 7 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      ...shadow.card,
    },
    error: { color: colors.danger, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
    inputField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.cardAlt,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 13,
      marginBottom: 12,
    },
    input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 13 },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
      ...shadow.soft,
    },
    buttonDisabled: { opacity: 0.55 },
    buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  });
