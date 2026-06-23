import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, Alert, Modal, TextInput, Pressable, ScrollView, Animated } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { PRESET_TASBIHS, getTodayTasbihCount, recordTasbihTaps } from '@/services/tasbihService';
import { AchievementManager } from '@/store/achievementStore';

export default function TasbihScreen() {
  const themeColors = useThemeColors();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();

  // States
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [count, setCount] = useState<number>(0);
  const [todayTaps, setTodayTaps] = useState<number>(0);

  // Custom tasbih modal states
  const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customArabic, setCustomArabic] = useState('');
  const [customTarget, setCustomTarget] = useState('100');

  // Active presets list (can include custom)
  const [presets, setPresets] = useState(PRESET_TASBIHS);
  const currentPreset = useMemo(() => presets[selectedPresetIndex] || presets[0], [presets, selectedPresetIndex]);

  // Load today's taps on mount
  useEffect(() => {
    getTodayTasbihCount().then((total) => {
      setTodayTaps(total);
    });
  }, []);

  // Set up animation
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0.4)).current;

  // Track sets completed (e.g. 100 complete)
  const [isSetsCompleted, setIsSetsCompleted] = useState(false);

  const handleTap = () => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    // Trigger ripple animation
    rippleScale.setValue(1);
    rippleOpacity.setValue(0.6);
    Animated.parallel([
      Animated.timing(rippleScale, {
        toValue: 1.45,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(rippleOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    const nextCount = count + 1;
    setCount(nextCount);
    
    // Save to total today
    setTodayTaps((prev) => prev + 1);
    recordTasbihTaps(1, token, user?.id).catch(() => undefined);

    // Check if target reached
    if (nextCount >= currentPreset.target) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      
      // If it is one of the presets and we completed it
      if (selectedPresetIndex < presets.length - 1) {
        // Auto switch to next preset
        setTimeout(() => {
          setSelectedPresetIndex((prev) => prev + 1);
          setCount(0);
        }, 300);
      } else {
        // All complete! (100 total completed if 3 presets)
        if (presets.length === 3 && selectedPresetIndex === 2) {
          setIsSetsCompleted(true);
          // Track achievements event
          AchievementManager.trackEvent('dhikr_tasbih_set', 1).catch(() => undefined);
        }
      }
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Counter',
      'Are you sure you want to reset the current count?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setCount(0);
            setIsSetsCompleted(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          },
        },
      ]
    );
  };

  const handleAddCustom = () => {
    if (!customName.trim()) {
      Alert.alert('Error', 'Please enter a name for the custom Tasbih');
      return;
    }
    const targetVal = parseInt(customTarget);
    if (isNaN(targetVal) || targetVal <= 0) {
      Alert.alert('Error', 'Please enter a valid target count');
      return;
    }

    const newPreset = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      arabic: customArabic.trim() || 'ذِكْر',
      target: targetVal,
    };

    setPresets((prev) => [...prev, newPreset]);
    setSelectedPresetIndex(presets.length); // switch to the new custom preset
    setCount(0);
    setIsSetsCompleted(false);
    
    // Reset modal fields
    setCustomName('');
    setCustomArabic('');
    setCustomTarget('100');
    setIsCustomModalVisible(false);
  };

  const progressFraction = Math.min(1, count / currentPreset.target);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 14, 24) },
          responsive.centerContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Tasbih Counter</Text>
            <Text style={styles.headerText}>Track your daily dhikr with digital counts</Text>
          </View>
        </View>

        {/* Preset Selector */}
        <View style={styles.presetsWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
            {presets.map((p, idx) => {
              const active = idx === selectedPresetIndex;
              return (
                <PressableScale
                  key={p.id}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: active ? themeColors.primary : themeColors.card,
                      borderColor: active ? themeColors.primary : themeColors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedPresetIndex(idx);
                    setCount(0);
                    setIsSetsCompleted(false);
                  }}
                >
                  <Text style={[styles.presetText, { color: active ? '#FFFFFF' : themeColors.text }]}>
                    {p.name} ({p.target})
                  </Text>
                </PressableScale>
              );
            })}
            
            {/* Add Custom Button */}
            <PressableScale
              style={[styles.presetChip, styles.addCustomChip, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => setIsCustomModalVisible(true)}
            >
              <Ionicons name="add" size={14} color={themeColors.goldDeep} />
              <Text style={[styles.presetText, { color: themeColors.goldDeep, marginLeft: 4 }]}>
                Custom
              </Text>
            </PressableScale>
          </ScrollView>
        </View>

        {/* Counter Info */}
        <View style={styles.counterInfoBlock}>
          <Text style={[styles.arabicText, { color: themeColors.goldDeep }]}>
            {currentPreset.arabic}
          </Text>
          <Text style={[styles.presetNameText, { color: themeColors.text }]}>
            {currentPreset.name}
          </Text>
        </View>

        {/* Huge circular counter button */}
        <View style={styles.centerSection}>
          {/* Ripple animation bg */}
          <Animated.View
            style={[
              styles.rippleCircle,
              {
                borderColor: themeColors.primary,
                transform: [{ scale: rippleScale }],
                opacity: rippleOpacity,
              },
            ]}
          />

          <Pressable onPress={handleTap} style={styles.tapCircleWrap}>
            <View
              style={[
                styles.tapCircle,
                {
                  backgroundColor: themeColors.card,
                  borderColor: themeColors.goldBorder,
                  ...shadow.raised,
                },
              ]}
            >
              {isSetsCompleted ? (
                <View style={styles.completedContent}>
                  <Ionicons name="checkmark-circle" size={54} color={colors.gold} />
                  <Text style={[styles.completedText, { color: themeColors.goldDeep }]}>
                    MashaAllah!
                  </Text>
                  <Text style={[styles.completedSubText, { color: themeColors.muted }]}>
                    100 Complete
                  </Text>
                </View>
              ) : (
                <View style={styles.counterContent}>
                  <Text style={[styles.countNumber, { color: themeColors.text }]}>
                    {count}
                  </Text>
                  <Text style={[styles.countTarget, { color: themeColors.muted }]}>
                    / {currentPreset.target}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>

        {/* Linear progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: themeColors.bgDeep }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressFraction * 100}%`,
                  backgroundColor: themeColors.primary,
                },
              ]}
            />
          </View>
        </View>

        {/* Reset & Quick Adjust Actions */}
        <View style={styles.actionsRow}>
          <PressableScale
            onPress={handleReset}
            style={[styles.actionBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
          >
            <Ionicons name="refresh-outline" size={20} color={themeColors.danger} />
            <Text style={[styles.actionBtnText, { color: themeColors.danger }]}>Reset</Text>
          </PressableScale>
        </View>

        {/* Footer: Daily Total Stats */}
        <View style={[styles.statsCard, { backgroundColor: themeColors.card, borderColor: themeColors.border, ...shadow.card }]}>
          <Ionicons name="calendar-outline" size={18} color={themeColors.primary} />
          <Text style={[styles.statsText, { color: themeColors.text }]}>
            Today's dhikr: <Text style={{ fontWeight: 'bold' }}>{todayTaps}</Text> total taps
          </Text>
        </View>
      </ScrollView>

      {/* Custom Tasbih Modal */}
      <Modal
        visible={isCustomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Custom Tasbih</Text>
            
            <TextInput
              placeholder="Dhikr Name (English, e.g. Astaghfirullah)"
              placeholderTextColor={themeColors.faint}
              value={customName}
              onChangeText={setCustomName}
              style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.text }]}
            />

            <TextInput
              placeholder="Arabic Text (Optional, e.g. أَسْتَغْفِرُ اللّٰه)"
              placeholderTextColor={themeColors.faint}
              value={customArabic}
              onChangeText={setCustomArabic}
              style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.text }]}
            />

            <TextInput
              placeholder="Target count (e.g. 100)"
              placeholderTextColor={themeColors.faint}
              value={customTarget}
              onChangeText={setCustomTarget}
              keyboardType="number-pad"
              style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.text }]}
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setIsCustomModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: themeColors.bgDeep }]}
              >
                <Text style={{ color: themeColors.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              
              <Pressable
                onPress={handleAddCustom}
                style={[styles.modalBtn, { backgroundColor: themeColors.primary }]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    ...shadow.raised,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: fonts.serif },
  headerText: { color: colors.onDarkMuted, marginTop: 4, fontSize: 12.5, lineHeight: 18 },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  presetsWrapper: {
    width: '100%',
    marginVertical: 16,
  },
  presetsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomChip: {
    flexDirection: 'row',
    borderStyle: 'dashed',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '700',
  },
  counterInfoBlock: {
    alignItems: 'center',
    marginVertical: 14,
    gap: 6,
  },
  arabicText: {
    fontSize: 26,
    fontFamily: fonts.arabic,
    lineHeight: 44,
  },
  presetNameText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.serif,
  },
  centerSection: {
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  rippleCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 6,
  },
  tapCircleWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  tapCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 110,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  completedSubText: {
    fontSize: 12,
    fontWeight: '600',
  },
  counterContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countNumber: {
    fontSize: 54,
    fontWeight: '800',
  },
  countTarget: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: -4,
  },
  progressContainer: {
    width: '80%',
    height: 8,
    marginVertical: 12,
  },
  progressTrack: {
    height: '100%',
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '88%',
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 20,
  },
  statsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.serif,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
});
