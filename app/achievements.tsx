import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, FlatList, Image, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/store/authStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAchievementStore, XP_BY_TIER, type Achievement, type AchievementCategory } from '@/store/achievementStore';
import { ACHIEVEMENT_IMAGES } from '@/utils/achievementImages';
import { useResponsive } from '@/theme/responsive';

const tierColors: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#FFD700',
  Platinum: '#E5E4E2',
};

const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'salah': return 'mosque';
    case 'quran': return 'book-open';
    case 'hafiz': return 'ribbon';
    case 'dhikr': return 'ellipse-outline';
    case 'hadith': return 'library-outline';
    case 'devotion':
    default: return 'heart-outline';
  }
};

const AchievementCard = React.memo(({ item, themeColors, columns }: { item: Achievement, themeColors: any, columns: number }) => {
  const tierColor = tierColors[item.tier] || '#C0C0C0';
  const xp = XP_BY_TIER[item.tier] || 10;
  const dateText = item.unlockedAt
    ? new Date(item.unlockedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const imgSource = ACHIEVEMENT_IMAGES[item.id];

  return (
    <View style={[
      styles.gridCellCard,
      columns >= 3 ? styles.gridCellCardTablet : styles.gridCellCardPhone,
      { backgroundColor: themeColors.card },
      item.isUnlocked ? { borderColor: tierColor, borderWidth: 1, ...shadow.card } : { borderColor: themeColors.border, borderWidth: 1 }
    ]}>
      <View
        style={[
          styles.imagePlaceholder,
          {
            backgroundColor: item.isUnlocked ? tierColor + '15' : themeColors.bgDeep,
            borderColor: item.isUnlocked ? tierColor : themeColors.border,
            borderWidth: 1,
          },
          !item.isUnlocked && { opacity: 0.5 }
        ]}
      >
        {imgSource ? (
          <Image
            source={imgSource}
            style={styles.achievementImage}
            resizeMode="contain"
          />
        ) : (
          <Ionicons
            name={getCategoryIcon(item.category) as any}
            size={42}
            color={item.isUnlocked ? tierColor : themeColors.faint}
          />
        )}

        {!item.isUnlocked && (
          <View style={[styles.lockOverlay, { backgroundColor: themeColors.card }]}>
            <Ionicons name="lock-closed" size={12} color={themeColors.muted} />
          </View>
        )}
      </View>

      <View style={[styles.xpTextBadge, { backgroundColor: item.isUnlocked ? tierColor : themeColors.bgDeep }]}>
        <Text style={[styles.xpBadgeLabel, !item.isUnlocked && { color: themeColors.muted }]}>+{xp} XP</Text>
      </View>

      <View style={styles.infoWrapper}>
        <Text style={[styles.itemTitle, { color: item.isUnlocked ? themeColors.text : themeColors.muted }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.itemDesc, { color: themeColors.muted }]} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      {item.isUnlocked ? (
        <View style={[styles.unlockDateRow, { backgroundColor: themeColors.primarySoft }]}>
          <Ionicons name="checkmark-circle" size={12} color={themeColors.primary} />
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
                  backgroundColor: themeColors.primary,
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
});

const ALL_RANKS = [
  { xp: 1000, title: 'Hafiz ul Ummah', icon: 'ribbon-outline' },
  { xp: 600, title: 'Enlightened', icon: 'bulb-outline' },
  { xp: 300, title: 'Devoted', icon: 'heart-half-outline' },
  { xp: 100, title: 'Believer', icon: 'heart-outline' },
  { xp: 0, title: 'Seeker', icon: 'search-outline' },
];

export default function AchievementsScreen() {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const user = useAuthStore((s) => s.user);
  
  const achievements = useAchievementStore((s) => s.achievements);
  const totalXp = useAchievementStore((s) => s.totalXp);
  const rankTitle = useAchievementStore((s) => s.rankTitle);
  const rankIcon = useAchievementStore((s) => s.rankIcon);
  const rankProgress = useAchievementStore((s) => s.rankProgress);

  // Modal State
  const [showRanksModal, setShowRanksModal] = useState(false);

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

  const achievementColumns = responsive.isTablet ? 3 : 2;

  const renderAchievementItem = useCallback(({ item }: { item: Achievement }) => {
    return <AchievementCard item={item} themeColors={themeColors} columns={achievementColumns} />;
  }, [achievementColumns, themeColors]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      {/* Header bar */}
      <View style={[styles.header, { backgroundColor: themeColors.primaryDeep, paddingTop: insets.top, height: 56 + insets.top }]}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </PressableScale>
        <Text style={styles.headerTitle}>Achievements</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Guest Block */}
      {!user ? (
        <View style={styles.guestBlock}>
          <Ionicons name="ribbon-outline" size={64} color={themeColors.primary} style={{ marginBottom: 16 }} />
          <Text style={[styles.guestTitle, { color: themeColors.text }]}>Unlock Your Journey</Text>
          <Text style={[styles.guestDesc, { color: themeColors.muted }]}>
            Sign in to track your achievements, earn XP, and see your rank grow as you build your habits.
          </Text>
          <PressableScale
            style={[styles.loginBtn, { backgroundColor: themeColors.primary }]}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.loginBtnText}>Sign In / Create Account</Text>
          </PressableScale>
        </View>
      ) : (
        <>
      {/* Achievements List */}
      <FlatList
        key={`achievements-${achievementColumns}`}
        data={filteredAchievements}
        keyExtractor={(item) => item.id}
        renderItem={renderAchievementItem}
        numColumns={achievementColumns}
        columnWrapperStyle={styles.listColWrapper}
        contentContainerStyle={[styles.listContent, responsive.centerContent]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <View style={{ paddingBottom: 16 }}>
            {/* Premium Hero Dashboard */}
            <View style={styles.heroDashboard}>
              {/* Main Rank Card */}
              <PressableScale onPress={() => setShowRanksModal(true)}>
                <View style={[styles.rankHeroCard, { backgroundColor: themeColors.primaryDeep }]}>
                  <Ionicons name={rankIcon as any} size={48} color={themeColors.gold} style={styles.rankHeroIcon} />
                  <Text style={styles.rankHeroLabel}>Current Rank</Text>
                  <Text style={[styles.rankHeroTitle, { color: themeColors.gold }]}>{rankTitle}</Text>
                  
                  {/* Embedded Progress Bar */}
                  <View style={styles.rankHeroProgressWrapper}>
                    <View style={styles.rankHeroProgressHeader}>
                      <Text style={styles.rankHeroProgressText}>{totalXp} XP</Text>
                      <Text style={styles.rankHeroProgressText}>Next: {rankProgress.nextLevelXp} XP</Text>
                    </View>
                    <View style={styles.rankHeroProgressBarTrack}>
                      <View 
                        style={[
                          styles.rankHeroProgressBarFill, 
                          { width: `${rankProgress.percentage}%`, backgroundColor: themeColors.gold }
                        ]} 
                      />
                    </View>
                  </View>
                </View>
              </PressableScale>

              {/* Stats Row */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <View style={[styles.statIconCircle, { backgroundColor: themeColors.goldSoft }]}>
                    <Ionicons name="sparkles" size={20} color={themeColors.goldDeep} />
                  </View>
                  <View>
                    <Text style={[styles.statValue, { color: themeColors.text }]}>{totalXp}</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>Total XP</Text>
                  </View>
                </View>

                <View style={[styles.statBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <View style={[styles.statIconCircle, { backgroundColor: themeColors.primarySoft }]}>
                    <Ionicons name="trophy" size={20} color={themeColors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.statValue, { color: themeColors.text }]}>{unlockedCount} / {achievements.length}</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>Unlocked</Text>
                  </View>
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
                          backgroundColor: active ? themeColors.primary : 'transparent',
                          borderColor: active ? themeColors.primary : themeColors.border,
                        },
                      ]}
                    >
                      <Ionicons name={cat.icon as any} size={14} color={active ? '#FFFFFF' : themeColors.text} />
                      <Text style={[styles.tabChipLabel, { color: active ? '#FFFFFF' : themeColors.text }]}>
                        {cat.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
      />
        </>
      )}

      {/* Ranks Modal */}
      <Modal visible={showRanksModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRanksModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalDragHandle} />
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Rank Tiers</Text>
            
            <View style={styles.ranksList}>
              {ALL_RANKS.map((rank, index) => {
                const isCurrent = rank.title === rankTitle;
                return (
                  <View key={rank.title} style={[
                    styles.rankListItem, 
                    { borderColor: themeColors.border },
                    isCurrent && { backgroundColor: themeColors.primarySoft, borderColor: themeColors.primary, borderWidth: 2 }
                  ]}>
                    <View style={[styles.rankListIconBox, { backgroundColor: isCurrent ? themeColors.primaryDeep : themeColors.bgDeep }]}>
                      <Ionicons name={rank.icon as any} size={24} color={isCurrent ? themeColors.gold : themeColors.primary} />
                    </View>
                    <View style={styles.rankListInfo}>
                      <Text style={[styles.rankListTitle, { color: themeColors.text }]}>{rank.title}</Text>
                      <Text style={[styles.rankListXp, { color: themeColors.muted }]}>{rank.xp} XP Required</Text>
                    </View>
                    {isCurrent && (
                      <View style={[styles.currentRankBadge, { backgroundColor: themeColors.primaryDeep }]}>
                        <Text style={styles.currentRankBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                );
              })}
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
  guestBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: fonts.serif,
    marginBottom: 8,
  },
  guestDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loginBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  heroDashboard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  rankHeroCard: {
    borderRadius: radius.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  rankHeroIcon: {
    marginBottom: 8,
  },
  rankHeroLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  rankHeroTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: fonts.serif,
    marginBottom: 20,
  },
  rankHeroProgressWrapper: {
    width: '100%',
  },
  rankHeroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rankHeroProgressText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
  },
  rankHeroProgressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  rankHeroProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
    ...shadow.card,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  tabsRow: {
    paddingVertical: 12,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tabChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  listColWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCellCard: {
    borderRadius: radius.xl,
    padding: 16,
    paddingTop: 20,
    alignItems: 'center',
    position: 'relative',
  },
  gridCellCardPhone: {
    width: '48%',
  },
  gridCellCardTablet: {
    width: '31.5%',
  },
  imagePlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  achievementImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'transparent',
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  xpTextBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  xpBadgeLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  infoWrapper: {
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.serif,
    textAlign: 'center',
  },
  itemDesc: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  unlockDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  unlockDateText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressWrapper: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  itemProgressBarTrack: {
    height: 4,
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  itemProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressRatioText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingTop: 12,
    maxHeight: '80%',
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(150,150,150,0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.serif,
    marginBottom: 20,
    textAlign: 'center',
  },
  ranksList: {
    gap: 12,
    paddingBottom: 24,
  },
  rankListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 16,
  },
  rankListIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankListInfo: {
    flex: 1,
  },
  rankListTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  rankListXp: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentRankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  currentRankBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
