import Slider from '@react-native-community/slider';
import { useMutation } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { deleteAccount, updatePassword } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import {
  getUiPreferences,
  saveUiPreferences,
  uiPreferenceDefaults,
} from '@/utils/preferences';

const MIN_AYAH_FONT = 18;
const MAX_AYAH_FONT = 42;

export default function SettingsScreen() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [arabicAyahFontSize, setArabicAyahFontSize] = useState(
    uiPreferenceDefaults.arabicAyahFontSize
  );
  const [use24HourTime, setUse24HourTime] = useState(
    uiPreferenceDefaults.use24HourTime
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useFocusEffect(
    useCallback(() => {
      getUiPreferences()
        .then((prefs) => {
          setArabicAyahFontSize(prefs.arabicAyahFontSize);
          setUse24HourTime(prefs.use24HourTime);
        })
        .catch(() => undefined);
    }, [])
  );

  const savePrefsMutation = useMutation({
    mutationFn: () =>
      saveUiPreferences({
        arabicAyahFontSize,
        use24HourTime,
      }),
    onSuccess: () => Alert.alert('Saved', 'Settings updated successfully.'),
    onError: () => Alert.alert('Error', 'Could not save settings right now.'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      updatePassword(token as string, {
        currentPassword,
        newPassword,
        confirmPassword: confirmNewPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Success', 'Password updated successfully.');
    },
    onError: (error: any) => {
      Alert.alert(
        'Update Failed',
        error?.response?.data?.message || 'Could not update password'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(token as string),
    onSuccess: async () => {
      await logout();
      Alert.alert('Account Deleted', 'Your account has been deleted.');
    },
    onError: (error: any) => {
      Alert.alert(
        'Delete Failed',
        error?.response?.data?.message || 'Could not delete account'
      );
    },
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Reading Preferences</Text>
          <Pressable
            onPress={() => setArabicAyahFontSize(uiPreferenceDefaults.arabicAyahFontSize)}
            style={styles.resetPill}
          >
            <Text style={styles.resetPillText}>Reset</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Arabic Ayah Font Size</Text>
        <View style={styles.fontRow}>
          <Text style={styles.fontSizeText}>A-</Text>
          <Slider
            style={styles.slider}
            minimumValue={MIN_AYAH_FONT}
            maximumValue={MAX_AYAH_FONT}
            step={1}
            value={arabicAyahFontSize}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor="#D8E4DF"
            thumbTintColor={colors.primary}
            onValueChange={setArabicAyahFontSize}
          />
          <Text style={styles.fontSizeText}>A+</Text>
        </View>
        <Text style={styles.previewLabel}>
          Size: {Math.round(arabicAyahFontSize)} px
        </Text>
        <Text style={[styles.previewArabic, { fontSize: arabicAyahFontSize, lineHeight: arabicAyahFontSize * 1.7 }]}>
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Prayer Time Format</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            {use24HourTime ? '24-hour format (default)' : '12-hour format'}
          </Text>
          <Switch
            value={use24HourTime}
            onValueChange={setUse24HourTime}
            trackColor={{ false: '#C9D7D1', true: '#8CD1B9' }}
            thumbColor={use24HourTime ? colors.primary : '#FFFFFF'}
          />
        </View>
      </View>

      <Pressable
        onPress={() => savePrefsMutation.mutate()}
        disabled={savePrefsMutation.isPending}
        style={[styles.saveButton, savePrefsMutation.isPending && styles.disabledButton]}
      >
        {savePrefsMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Settings</Text>
        )}
      </Pressable>

      {token ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Update Password</Text>
            <TextInput
              placeholder="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholderTextColor="#8E9B95"
              style={styles.input}
            />
            <TextInput
              placeholder="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholderTextColor="#8E9B95"
              style={styles.input}
            />
            <TextInput
              placeholder="Confirm New Password"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              placeholderTextColor="#8E9B95"
              style={styles.input}
            />
            <Pressable
              onPress={() => changePasswordMutation.mutate()}
              disabled={changePasswordMutation.isPending}
              style={[styles.inlineButton, changePasswordMutation.isPending && styles.disabledButton]}
            >
              {changePasswordMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.inlineButtonText}>Update Password</Text>
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert('Delete Account', 'This action is permanent. Continue?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteMutation.mutate(),
                },
              ])
            }
            style={[styles.dangerButton, deleteMutation.isPending && styles.disabledButton]}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Delete Account</Text>
            )}
          </Pressable>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Security</Text>
          <Text style={styles.infoText}>Login to access Update Password and Delete Account.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 2 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  resetPill: {
    backgroundColor: '#ECF6F2',
    borderWidth: 1,
    borderColor: '#D7E9E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  resetPillText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  label: { color: colors.text, fontWeight: '600' },
  fontRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1, height: 34 },
  fontSizeText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  previewLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  previewArabic: {
    color: colors.text,
    textAlign: 'right',
    fontFamily: 'KFGQPCNastaleeq',
    marginTop: 4,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { color: colors.text, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: '#F7FAF9',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E1ECE8',
    color: colors.text,
  },
  inlineButton: {
    marginTop: 2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inlineButtonText: { color: '#fff', fontWeight: '700' },
  dangerButton: {
    backgroundColor: '#A02929',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.7 },
  infoText: {
    color: colors.muted,
    fontWeight: '600',
  },
});
