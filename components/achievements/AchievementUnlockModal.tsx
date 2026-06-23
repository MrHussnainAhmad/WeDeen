import { StyleSheet, Text, View, Modal, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAchievementStore, XP_BY_TIER } from '@/store/achievementStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { ACHIEVEMENT_IMAGES } from '@/utils/achievementImages';

export function AchievementUnlockModal() {
  const themeColors = useThemeColors();
  const currentUnlock = useAchievementStore((s) => s.currentUnlock);
  const closeUnlockPopup = useAchievementStore((s) => s.closeUnlockPopup);

  if (!currentUnlock) return null;

  const tierColors: Record<string, string> = {
    Bronze: '#CD7F32',
    Silver: '#C0C0C0',
    Gold: '#FFD700',
    Platinum: '#E5E4E2',
  };

  const tierColor = tierColors[currentUnlock.tier] || '#CD7F32';
  const xp = XP_BY_TIER[currentUnlock.tier] || 10;

  // Map category to icon
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'salah':
        return 'mosque';
      case 'quran':
        return 'book-open';
      case 'hafiz':
        return 'brain'; // or ribbon
      case 'dhikr':
        return 'ellipse-outline'; // circular
      case 'hadith':
        return 'library-outline';
      case 'devotion':
      default:
        return 'heart-outline';
    }
  };

  return (
    <Modal
      visible={!!currentUnlock}
      transparent
      animationType="fade"
      onRequestClose={closeUnlockPopup}
    >
      <View style={styles.modalBg}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.card, ...shadow.raised }]}>
          {/* Trophy Header */}
          <View style={styles.headerIconWrap}>
            <Ionicons name="ribbon-outline" size={38} color={tierColor} />
          </View>

          <Text style={[styles.titleText, { color: themeColors.text }]}>Achievement Unlocked!</Text>

          {/* Achievement Image Card */}
          <View style={[styles.imageCard, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
            {ACHIEVEMENT_IMAGES[currentUnlock.id] ? (
              <Image
                source={ACHIEVEMENT_IMAGES[currentUnlock.id]}
                style={styles.achievementImage}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name={getCategoryIcon(currentUnlock.category) as any} size={48} color={tierColor} />
            )}
            <View style={[styles.xpBadge, { backgroundColor: tierColor }]}>
              <Text style={styles.xpText}>+{xp} XP</Text>
            </View>
          </View>

          {/* Achievement Details */}
          <View style={styles.detailsWrap}>
            <Text style={[styles.achievementTitle, { color: themeColors.text }]}>{currentUnlock.title}</Text>
            <Text style={[styles.achievementDesc, { color: themeColors.muted }]}>{currentUnlock.description}</Text>
          </View>

          {/* Tier Badge */}
          <View style={[styles.tierBadge, { borderColor: tierColor }]}>
            <Ionicons name="shield-half-outline" size={14} color={tierColor} />
            <Text style={[styles.tierText, { color: tierColor }]}>{currentUnlock.tier} Tier</Text>
          </View>

          {/* Close button */}
          <PressableScale
            onPress={closeUnlockPopup}
            style={[styles.closeBtn, { backgroundColor: themeColors.primary }]}
          >
            <Text style={styles.closeBtnText}>Alhamdulillah</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  headerIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.serif,
    textAlign: 'center',
    marginBottom: 16,
  },
  imageCard: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  achievementImage: {
    width: 74,
    height: 74,
    borderRadius: radius.md - 2.5,
  },
  xpBadge: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingVertical: 4,
    alignItems: 'center',
  },
  xpText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  detailsWrap: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  achievementTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.serif,
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 20,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
