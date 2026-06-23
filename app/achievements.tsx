import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, FlatList, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/store/authStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { useAchievementStore, XP_BY_TIER, type Achievement, type AchievementCategory } from '@/store/achievementStore';
import { ACHIEVEMENT_IMAGES } from '@/utils/achievementImages';

export default function AchievementsScreen() {
  const themeColors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  
  const achievements = useAchievementStore((s) => s.achievements);
  const totalXp = useAchievementStore((s) => s.totalXp);
  const rankTitle = useAchievementStore((s) => s.rankTitle);
  const rankIcon = useAchievementStore((s) => s.rankIcon);

  // Tabs
  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategory>('all');

  const categories: { id: 'all' | AchievementCategory; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'apps-outline' },
    { id: 'salah', label: 'Salah', icon: 'mosque' },
    { id: 'quran', label: 'Quran', icon: 'book-open-outline' },
    { id: 'hafiz', label: 'Hafiz', icon: 'ribbon-outline' },
    { id: 'dhikr', label: 'Dhikr', icon: 'ellipse-outline' },
    { id: 'hadith', label: 'Hadith', icon: 'library-outline' },
    { id: 'devotion', label: 'Devotion', icon: 'heart-outline' },
  ];

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return achievements;
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  const unlockedCount = useMemo(() => {
    return achievements.filter((a) => a.isUnlocked).length;
  }, [achievements]);

  const tierColors: Record<string, string> = {
    Bronze: '#CD7F32',
    Silver: '#C0C0C0',
    Gold: '#FFD700',
    Platinum: '#E5E4E2',
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'salah':
        return 'mosque';
      case 'quran':
        return 'book-open';
      case 'hafiz':
        return 'ribbon';
      case 'dhikr':
        return 'ellipse-outline';
      case 'hadith':
        return 'library-outline';
      case 'devotion':
      default:
        return 'heart-outline';
    }
  };

  const renderAchievementItem = ({ item }: { item: Achievement }) => {
    const tierColor = tierColors[item.tier];
    const xp = XP_BY_TIER[item.tier];
    const dateText = item.unlockedAt
      ? new Date(item.unlockedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

    const imgSource = ACHIEVEMENT_IMAGES[item.id];

    return (
      <View style={[styles.gridCellCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        {/* Placeholder or image container */}
        <View
          style={[
            styles.imagePlaceholder,
            {
              backgroundColor: item.isUnlocked ? tierColor + '22' : themeColors.bgDeep,
              borderColor: tierColor,
            },
          ]}
        >
          {imgSource ? (
            <Image
              source={imgSource}
              style={[
                styles.achievementImage,
                !item.isUnlocked && { opacity: 0.3 },
              ]}
              resizeMode="contain"
            />
          ) : (
            <Ionicons
              name={getCategoryIcon(item.category) as any}
              size={36}
              color={item.isUnlocked ? tierColor : themeColors.faint}
            />
          )}

          {!item.isUnlocked && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={16} color={themeColors.muted} />
            </View>
          )}
          <View style={[styles.xpTextBadge, { backgroundColor: item.isUnlocked ? tierColor : themeColors.muted }]}>
            <Text style={styles.xpBadgeLabel}>+{xp} XP</Text>
          </View>
        </View>

        {/* Title and Desc */}
        <View style={styles.infoWrapper}>
          <Text style={[styles.itemTitle, { color: themeColors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.itemDesc, { color: themeColors.muted }]} numberOfLines={2}>
            {item.description}
          </Text>
        </View>

        {/* Footer info (date or progress) */}
        {item.isUnlocked ? (
          <View style={styles.unlockDateRow}>
            <Ionicons name="calendar-outline" size={12} color={themeColors.primary} />
            <Text style={[styles.unlockDateText, { color: themeColors.primary }]}>{dateText}</Text>
          </View>
        ) : (
          <View style={styles.progressWrapper}>
            <View style={[styles.itemProgressBarTrack, { backgroundColor: themeColors.bgDeep }]}>
              <View
                style={[
                  styles.itemProgressBarFill,
                  {
                    width: `${Math.min(1, item.currentValue / item.targetValue) * 100}%`,
                    backgroundColor: tierColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressRatioText, { color: themeColors.muted }]}>
              {item.currentValue} / {item.targetValue}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: themeColors.primaryDeep }]}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </PressableScale>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Guest Info Banner */}
      {!user && (
        <View style={[styles.guestBanner, { backgroundColor: themeColors.goldSoft, borderColor: themeColors.goldBorder }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={themeColors.goldDeep} />
          <Text style={[styles.guestBannerText, { color: themeColors.goldDeep }]}>
            Log in to save your achievements across devices
          </Text>
        </View>
      )}

      {/* Top summary dashboard */}
      <View style={[styles.summaryBar, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <View style={styles.summaryCol}>
          <View style={[styles.summaryIconBox, { backgroundColor: themeColors.primarySoft }]}>
            <Ionicons name="ribbon-outline" size={22} color={themeColors.primary} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: themeColors.muted }]}>Rank</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>{rankTitle}</Text>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <View style={[styles.summaryIconBox, { backgroundColor: themeColors.goldSoft }]}>
            <Ionicons name="sparkles-outline" size={22} color={themeColors.goldDeep} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: themeColors.muted }]}>Total XP</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>{totalXp} XP</Text>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryCol}>
          <View style={[styles.summaryIconBox, { backgroundColor: 'rgba(11, 107, 79, 0.1)' }]}>
            <Ionicons name="trophy-outline" size={22} color={themeColors.primary} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: themeColors.muted }]}>Unlocked</Text>
            <Text style={[styles.summaryValue, { color: themeColors.text }]}>
              {unlockedCount} / {achievements.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Categories horizontal list */}
      <View style={[styles.tabsRow, { borderBottomColor: themeColors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {categories.map((cat) => {
            const active = cat.id === selectedCategory;
            return (
              <PressableScale
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? themeColors.primary : themeColors.card,
                    borderColor: active ? themeColors.primary : themeColors.border,
                  },
                ]}
              >
                <Ionicons name={cat.icon as any} size={14} color={active ? '#FFFFFF' : themeColors.muted} />
                <Text style={[styles.tabChipLabel, { color: active ? '#FFFFFF' : themeColors.text }]}>
                  {cat.label}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      {/* Achievements List */}
      <FlatList
        data={filteredAchievements}
        keyExtractor={(item) => item.id}
        renderItem={renderAchievementItem}
        numColumns={2}
        columnWrapperStyle={styles.listColWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 999,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: fonts.serif,
  },
  headerRight: { width: 38 },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  guestBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  summaryBar: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSoft,
    marginHorizontal: 8,
  },
  tabsRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tabChipLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  listContent: {
    padding: 12,
    paddingBottom: 40,
  },
  listColWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCellCard: {
    width: '48.2%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  achievementImage: {
    width: 76,
    height: 76,
    borderRadius: radius.md - 2,
  },
  lockOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  xpTextBadge: {
    position: 'absolute',
    bottom: -6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  xpBadgeLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  infoWrapper: {
    alignItems: 'center',
    gap: 2,
    marginVertical: 4,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    fontFamily: fonts.serif,
    textAlign: 'center',
  },
  itemDesc: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  unlockDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  unlockDateText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  itemProgressBarTrack: {
    height: 4,
    width: '80%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  itemProgressBarFill: {
    height: '100%',
  },
  progressRatioText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
