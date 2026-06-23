import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioStore } from '@/store/audioStore';
import { pauseActiveAudio, resumeActiveAudio, stopAllAudio } from '@/services/audioManager';
import { colors, radius, shadow } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';
import { useRouter } from 'expo-router';

export function AudioMiniPlayer() {
  const { isActive, isPlaying, title, subtitle, surahNumber } = useAudioStore();
  const router = useRouter();

  if (!isActive) return null;

  const handlePlayPause = async () => {
    if (isPlaying) {
      const paused = await pauseActiveAudio();
      if (paused) useAudioStore.getState().setAudioState({ isPlaying: false });
    } else {
      const resumed = await resumeActiveAudio();
      if (resumed) useAudioStore.getState().setAudioState({ isPlaying: true });
    }
  };

  const handleStop = async () => {
    await stopAllAudio();
    useAudioStore.getState().clearAudioState();
  };

  const handlePress = () => {
    if (surahNumber) {
      router.push(`/quran/${surahNumber}`);
    } else {
      router.push('/quran');
    }
  };

  return (
    <View style={styles.container}>
      <PressableScale onPress={handlePress} style={styles.playerInner}>
        <View style={styles.iconBox}>
          <Ionicons name="musical-notes" size={16} color={colors.primaryDeep} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Quran Audio'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle || 'Playing'}
          </Text>
        </View>
      </PressableScale>
      <View style={styles.controls}>
        <PressableScale onPress={handlePlayPause} style={styles.controlButton}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={colors.primaryDark} />
        </PressableScale>
        <PressableScale onPress={handleStop} style={styles.controlButton}>
          <Ionicons name="close" size={20} color={colors.danger} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 85, // Position slightly above the bottom tab bar
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.raised,
  },
  playerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    padding: 4,
  },
});
