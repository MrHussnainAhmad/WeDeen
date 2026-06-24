import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useThemeColors } from '@/theme/useThemeColors';
import { useAuthStore } from '@/store/authStore';
import { getReflections, saveReflection, deleteReflection, type ReflectionEntry, restoreReflections } from '@/services/reflectionService';
import { GeometricDivider, OrnateCard, SectionHeader } from '@/components/ui';

export default function ReflectionsScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const themeColors = useThemeColors();
  const { user, token } = useAuthStore();
  
  const [reflections, setReflections] = useState<ReflectionEntry[]>([]);
  const [newText, setNewText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getReflections().then(setReflections).catch(() => undefined);
    if (token) {
      restoreReflections(token).then(setReflections).catch(() => undefined);
    }
  }, [token]);

  const handleSave = async () => {
    if (!newText.trim()) return;
    setIsSaving(true);
    try {
      const updated = await saveReflection(newText.trim(), token);
      setReflections(updated);
      setNewText('');
      Alert.alert('Saved', 'Your reflection has been safely stored.');
    } catch {
      Alert.alert('Error', 'Could not save your reflection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Reflection', 'Are you sure you want to remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          const updated = await deleteReflection(id, token);
          setReflections(updated);
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.screen, { backgroundColor: themeColors.bg }]}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 24) }, responsive.centerContent]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Daily Reflections</Text>
            <Text style={styles.headerSubtitle}>Write down your gratitude and thoughts.</Text>
          </View>
        </View>

        {!user ? (
          <View style={[styles.guestCard, { backgroundColor: themeColors.card }]}>
            <Ionicons name="lock-closed-outline" size={48} color={themeColors.muted} style={{ marginBottom: 16 }} />
            <Text style={[styles.guestTitle, { color: themeColors.text }]}>Sign In to Journal</Text>
            <Text style={[styles.guestDesc, { color: themeColors.muted }]}>
              Daily reflections are deeply personal. Sign in to safely write, store, and sync your thoughts across your devices.
            </Text>
            <PressableScale style={[styles.loginBtn, { backgroundColor: themeColors.primary }]} onPress={() => router.push('/settings')}>
              <Text style={styles.loginBtnText}>Sign In / Create Account</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {/* Input Section */}
            <OrnateCard>
              <SectionHeader
                title="Today's Reflection"
                subtitle="What are you grateful for today?"
                icon={<Ionicons name="pencil" size={18} color={themeColors.primary} />}
              />
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.cardAlt, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="I am grateful for..."
                placeholderTextColor={themeColors.faint}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={newText}
                onChangeText={setNewText}
              />
              <PressableScale 
                style={[styles.saveBtn, { backgroundColor: newText.trim() ? themeColors.primary : themeColors.muted }]} 
                onPress={handleSave} 
                disabled={!newText.trim() || isSaving}
              >
                <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save Reflection'}</Text>
              </PressableScale>
            </OrnateCard>

            {/* History Section */}
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Past Entries</Text>
              {reflections.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.muted }]}>Your journaling history is empty.</Text>
              ) : (
                <View style={styles.list}>
                  {reflections.map((item) => (
                    <View key={item.id} style={[styles.entryCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                      <View style={styles.entryHeader}>
                        <Text style={[styles.entryDate, { color: themeColors.goldDeep }]}>
                          {new Date(item.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </Text>
                        <PressableScale onPress={() => handleDelete(item.id)} style={{ padding: 4 }}>
                          <Ionicons name="trash-outline" size={16} color={themeColors.danger} />
                        </PressableScale>
                      </View>
                      <GeometricDivider color={themeColors.border} style={{ marginVertical: 12, opacity: 0.5 }} />
                      <Text style={[styles.entryText, { color: themeColors.text }]}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  header: { backgroundColor: colors.primaryDeep, borderRadius: radius.xl, padding: 20, flexDirection: 'row', gap: 14, alignItems: 'center', ...shadow.raised },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: fonts.serif },
  headerSubtitle: { color: colors.onDarkMuted, marginTop: 6, fontSize: 13, lineHeight: 18 },
  
  guestCard: { padding: 32, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card },
  guestTitle: { fontSize: 22, fontWeight: 'bold', fontFamily: fonts.serif, marginBottom: 12 },
  guestDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  loginBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: radius.md },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  input: { borderWidth: 1, borderRadius: radius.md, padding: 16, fontSize: 16, minHeight: 120 },
  saveBtn: { padding: 14, borderRadius: radius.md, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  sectionTitle: { fontSize: 18, fontWeight: '800', fontFamily: fonts.serif, marginBottom: 12, marginLeft: 4 },
  emptyText: { fontSize: 14, fontStyle: 'italic', marginLeft: 4 },
  list: { gap: 12 },
  entryCard: { padding: 16, borderRadius: radius.lg, borderWidth: 1, ...shadow.card },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryDate: { fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  entryText: { fontSize: 15, lineHeight: 24 },
});
