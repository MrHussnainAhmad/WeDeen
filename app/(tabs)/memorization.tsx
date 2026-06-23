import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cacheLearningProgress,
  fetchLearningProgress,
  getCachedLearningProgress,
  unlockNextSurah,
} from '@/services/memorizationService';
import { useAuthStore } from '@/store/authStore';
import { fonts, radius, shadow, type ThemeColors } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { EightPointStar, GeometricDivider, StarFieldWatermark } from '@/components/IslamicMotifs';
import { TabFadeInView, PressableScale, useBreathing } from '@/components/Anim';
import { TabSceneGuard } from '@/components/navigation/TabSceneGuard';
import { useResponsive } from '@/theme/responsive';
import { Animated } from 'react-native';
import { BannerAdSpace } from '@/components/BannerAdSpace';

const TOTAL_SURAHS = 114;
const VISIBLE_MAP_NODES = 28;

// Serpentine map geometry (Candy-Crush style winding path, bottom → top).
const NODE = 74;          // level node diameter
const VSTEP = 108;        // vertical distance between levels
const TOP_PAD = 64;       // breathing room above the highest visible node
const BOTTOM_PAD = 78;    // breathing room below Surah 1
const ROAD_BASE_W = 20;   // chunky road bed width
const ROAD_TOP_W = 12;    // colored progress road width
const TOTAL_BATCHES = Math.ceil(TOTAL_SURAHS / VISIBLE_MAP_NODES);

// Emerald/gold milestone icons (vector, no external images) cycled along the path.
const NODE_ICONS = [
  'star-crescent',
  'mosque',
  'book-open-variant',
  'star-four-points',
  'candle',
  'compass-outline',
] as const;

// Islamic lantern / landmark decorations scattered beside the trail.
const DECOR_ICONS = ['lamp', 'mosque', 'star-crescent', 'candelabra'] as const;

function openSurahFromMemorization(surahNumber: number) {
  router.push({
    pathname: '/quran/[surah]',
    params: { surah: String(surahNumber), returnTo: 'memorization' },
  } as any);
}

export default function MemorizationScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollContentRef = useRef<View | null>(null);
  const scrollAnchorRef = useRef<View | null>(null);
  const checkpointRef = useRef<View | null>(null);
  const trackRef = useRef<View | null>(null);
  const autoScrolledRef = useRef(false);
  const trackWRef = useRef(0);
  const [trackW, setTrackW] = useState(0);

  const glow = useBreathing(0.25, 0.85, 1300);   // pulsing halo on the current node
  const bounce = useBreathing(0, 1, 900);         // gentle up/down hop on the current node

  const progressQuery = useQuery({
    queryKey: ['learning-progress', token],
    queryFn: () => fetchLearningProgress(token as string, userId as string),
    enabled: !!token && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Show cached progress instantly while the network fetch runs.
  useEffect(() => {
    if (!token || !userId) return;
    getCachedLearningProgress(userId)
      .then((cached) => {
        if (cached) {
          queryClient.setQueryData(['learning-progress', token], cached);
        }
      })
      .catch(() => undefined);
  }, [token, userId, queryClient]);

  const unlockMutation = useMutation({
    mutationFn: (surahNumber: number) =>
      unlockNextSurah(token as string, userId as string, surahNumber),
    onMutate: async (surahNumber) => {
      await queryClient.cancelQueries({ queryKey: ['learning-progress', token] });
      const previous = queryClient.getQueryData<{ unlockedSurah: number }>([
        'learning-progress',
        token,
      ]);
      const current = previous?.unlockedSurah ?? 1;
      if (surahNumber === current && current < 114) {
        const optimistic = { unlockedSurah: current + 1 };
        queryClient.setQueryData(['learning-progress', token], optimistic);
        if (userId) cacheLearningProgress(userId, optimistic).catch(() => undefined);
      }
      return { previous };
    },
    onError: (_err, _surahNumber, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['learning-progress', token], context.previous);
        if (userId) cacheLearningProgress(userId, context.previous).catch(() => undefined);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['learning-progress', token], data);
      if (userId) cacheLearningProgress(userId, data).catch(() => undefined);
    },
  });

  const unlockedSurah = progressQuery.data?.unlockedSurah ?? 1;

  const scrollToCurrentCheckpoint = useCallback(() => {
    if (autoScrolledRef.current) return;
    const scrollView = scrollRef.current;
    const content = scrollContentRef.current;
    if (!scrollView || !content) return;

    const finish = (y: number) => {
      const viewHeight = Dimensions.get('window').height;
      const target = Math.max(0, y - viewHeight * 0.38);
      scrollView.scrollTo({ y: target, animated: true });
      autoScrolledRef.current = true;
    };

    const scrollToCheckpointCard = () => {
      const checkpoint = checkpointRef.current;
      if (!checkpoint) return;
      checkpoint.measureLayout(
        content,
        (_x, y) => finish(y),
        () => undefined
      );
    };

    const scrollFromTrackGeometry = () => {
      const track = trackRef.current;
      const w = trackWRef.current;
      if (!track || w <= 0) {
        scrollToCheckpointCard();
        return;
      }

      const batchIdx = Math.floor((unlockedSurah - 1) / VISIBLE_MAP_NODES);
      const batchStart = batchIdx * VISIBLE_MAP_NODES + 1;
      const batchEnd = Math.min(TOTAL_SURAHS, batchStart + VISIBLE_MAP_NODES - 1);
      const batchCount = batchEnd - batchStart + 1;
      const idx = unlockedSurah - batchStart;
      const th = TOP_PAD + BOTTOM_PAD + (batchCount - 1) * VSTEP;
      const nodeY = th - BOTTOM_PAD - idx * VSTEP;

      track.measureLayout(
        content,
        (_x, trackY) => finish(trackY + nodeY - NODE / 2),
        () => scrollToCheckpointCard()
      );
    };

    const anchor = scrollAnchorRef.current;
    if (anchor) {
      anchor.measureLayout(
        content,
        (_x, y) => finish(y),
        () => scrollFromTrackGeometry()
      );
      return;
    }

    scrollFromTrackGeometry();
  }, [unlockedSurah]);

  const resetScrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const scheduleScrollToCheckpoint = useCallback(() => {
    autoScrolledRef.current = false;
    resetScrollToTop();
    setTimeout(() => scrollToCurrentCheckpoint(), 120);
  }, [scrollToCurrentCheckpoint, resetScrollToTop]);

  useEffect(() => {
    autoScrolledRef.current = false;
    resetScrollToTop();
  }, [unlockedSurah, resetScrollToTop]);

  // Re-scroll every time the tab opens; start at top, then glide to checkpoint.
  useFocusEffect(
    useCallback(() => {
      autoScrolledRef.current = false;
      resetScrollToTop();
      const delays = [320, 480, 700, 1000, 1500];
      const timers = delays.map((ms) =>
        setTimeout(() => scrollToCurrentCheckpoint(), ms)
      );
      return () => timers.forEach(clearTimeout);
    }, [scrollToCurrentCheckpoint, resetScrollToTop])
  );

  // Auto-scroll once the track width is known and nodes have rendered.
  useEffect(() => {
    if (trackWRef.current <= 0) return;
    scheduleScrollToCheckpoint();
  }, [trackW, unlockedSurah, scheduleScrollToCheckpoint]);

  if (!token) {
    return (
      <TabSceneGuard>
      <View style={styles.centerContainer}>
        <View style={styles.lockHero}>
          <StarFieldWatermark rows={2} cols={5} starSize={20} color="rgba(255,255,255,0.05)" />
          <EightPointStar size={46} color={colors.gold} filled={false} />
          <Text style={styles.lockTitle}>Quran Learning Journey</Text>
          <GeometricDivider color="rgba(197,155,39,0.5)" style={{ marginVertical: 14 }} />
          <Text style={styles.lockText}>
            Sign in from your Profile to begin memorizing and sync your unlocked Surahs across devices.
          </Text>
          <PressableScale onPress={() => router.push('/profile' as any)} style={styles.lockButton}>
            <Ionicons name="person" size={16} color={colors.primaryDeep} style={{ marginRight: 7 }} />
            <Text style={styles.lockButtonText}>Go to Profile</Text>
          </PressableScale>
        </View>
      </View>
      </TabSceneGuard>
    );
  }

  if (progressQuery.isLoading && !progressQuery.data) {
    return (
      <TabSceneGuard>
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loaderText}>Loading your journey…</Text>
      </View>
      </TabSceneGuard>
    );
  }

  // Fixed batches of 28: surahs 1-28, 29-56, 57-84, 85-112, 113-114. Surahs
  // still unlock one at a time; the map shows the batch containing the current
  // surah and advances to the next batch once the user crosses into it.
  const batchIndex = Math.floor((unlockedSurah - 1) / VISIBLE_MAP_NODES);
  const startSurah = batchIndex * VISIBLE_MAP_NODES + 1;
  const endSurah = Math.min(TOTAL_SURAHS, startSurah + VISIBLE_MAP_NODES - 1);
  const mapSurahs = Array.from({ length: endSurah - startSurah + 1 }, (_, i) => startSurah + i);
  const count = mapSurahs.length;
  const progressPct = Math.round((unlockedSurah / TOTAL_SURAHS) * 100);

  // ── Serpentine geometry ──────────────────────────────────────────────
  const trackHeight = TOP_PAD + BOTTOM_PAD + (count - 1) * VSTEP;
  const centerX = trackW / 2;
  const amp = Math.min(centerX - NODE / 2 - 10, 116);

  // index 0 == Surah `startSurah` == bottom of the track. Climbing upward.
  // x sways center→right→center→left (period 4) for a smooth S-curve.
  const posFor = (t: number) => ({
    x: centerX + amp * Math.sin((t * Math.PI) / 2),
    y: trackHeight - BOTTOM_PAD - t * VSTEP,
  });

  // Connected winding road: one rotated capsule per segment between levels, plus
  // a small center stud — gives the continuous Candy-Crush path feel.
  const segments: {
    x: number;
    y: number;
    len: number;
    angle: number;
    reached: boolean;
    studX: number;
    studY: number;
    key: string;
  }[] = [];
  if (trackW > 0) {
    for (let i = 0; i < count - 1; i++) {
      const a = posFor(i);
      const b = posFor(i + 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const mid = posFor(i + 0.5);
      segments.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        len,
        angle,
        reached: startSurah + i + 1 <= unlockedSurah,
        studX: mid.x,
        studY: mid.y,
        key: `seg-${i}`,
      });
    }
  }

  return (
    <TabSceneGuard>
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 14, 22) }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    >
      <View ref={scrollContentRef} collapsable={false}>
      {/* ───── Hero ───── */}
      <TabFadeInView>
        <View style={styles.hero}>
          <StarFieldWatermark rows={3} cols={6} starSize={18} color="rgba(255,255,255,0.05)" />
          <View style={styles.heroGoldTop} />
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="map-marker-path" size={24} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Memorization Journey</Text>
              <Text style={styles.heroSub}>Climb the path — clear each Surah to light up the next</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.heroProgressText}>Surah {unlockedSurah} of {TOTAL_SURAHS}</Text>
            <Text style={styles.heroPct}>{progressPct}%</Text>
          </View>
        </View>
      </TabFadeInView>

      {/* ───── Journey Map (serpentine, bottom → top) ───── */}
      <TabFadeInView>
        <BannerAdSpace style={{ marginBottom: 16 }} />
        <View style={styles.mapCard}>
          <StarFieldWatermark rows={8} cols={5} starSize={26} color="rgba(11,107,79,0.04)" />

          <View style={styles.pathLabelWrap}>
            <EightPointStar size={12} color={colors.gold} />
            <View style={styles.stageLabelCenter}>
              <Text style={styles.pathLabel}>STAGE {batchIndex + 1} OF {TOTAL_BATCHES}</Text>
              <Text style={styles.stageSub}>Surahs {startSurah}–{endSurah}</Text>
            </View>
            <EightPointStar size={12} color={colors.gold} />
          </View>

          <View
            ref={trackRef}
            collapsable={false}
            style={[styles.track, { height: trackHeight }]}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w <= 0) return;
              const widthChanged = trackWRef.current !== w;
              trackWRef.current = w;
              if (widthChanged) setTrackW(w);
              if (!autoScrolledRef.current) {
                requestAnimationFrame(() => {
                  setTimeout(() => scrollToCurrentCheckpoint(), 32);
                });
              }
            }}
          >
            {/* Connected winding candy road */}
            {segments.map((s) => (
              <View key={s.key} pointerEvents="none">
                {/* Chunky road bed */}
                <View
                  style={[
                    styles.roadBase,
                    {
                      width: s.len + ROAD_BASE_W,
                      left: s.x - (s.len + ROAD_BASE_W) / 2,
                      top: s.y - ROAD_BASE_W / 2,
                      transform: [{ rotate: `${s.angle}deg` }],
                    },
                  ]}
                />
                {/* Colored progress road */}
                <View
                  style={[
                    styles.roadTop,
                    s.reached ? styles.roadTopOn : styles.roadTopOff,
                    {
                      width: s.len + 4,
                      left: s.x - (s.len + 4) / 2,
                      top: s.y - ROAD_TOP_W / 2,
                      transform: [{ rotate: `${s.angle}deg` }],
                    },
                  ]}
                />
                {/* Center stud (lane gem) */}
                <View
                  style={[
                    styles.roadStud,
                    s.reached ? styles.roadStudOn : styles.roadStudOff,
                    { left: s.studX - 4, top: s.studY - 4 },
                  ]}
                />
              </View>
            ))}

            {/* Islamic lantern landmarks beside the path */}
            {trackW > 0 && mapSurahs.map((surahNumber, index) => {
              if (index === 0 || index % 4 !== 0) return null;
              const p = posFor(index);
              const onRight = p.x < centerX;            // place opposite the node
              const decoIcon = DECOR_ICONS[index % DECOR_ICONS.length];
              return (
                <View
                  key={`decor-${surahNumber}`}
                  pointerEvents="none"
                  style={[
                    styles.decor,
                    { top: p.y - 20 },
                    onRight ? { right: 6 } : { left: 6 },
                  ]}
                >
                  <View style={styles.decorGlow} />
                  <MaterialCommunityIcons name={decoIcon as any} size={26} color={colors.goldDeep} />
                </View>
              );
            })}

            {/* Level nodes */}
            {trackW > 0 && mapSurahs.map((surahNumber, index) => {
              const isUnlocked = surahNumber <= unlockedSurah;
              const isCurrent = surahNumber === unlockedSurah;
              const isCleared = surahNumber < unlockedSurah;
              const p = posFor(index);
              const nodeIcon = NODE_ICONS[surahNumber % NODE_ICONS.length];

              return (
                <View
                  key={surahNumber}
                  ref={isCurrent ? scrollAnchorRef : undefined}
                  collapsable={false}
                  style={[styles.nodeSlot, { left: p.x - NODE / 2, top: p.y - NODE / 2 }]}
                >
                  {/* Pulsing halo + twinkling stars on the current level */}
                  {isCurrent ? (
                    <>
                      <Animated.View style={[styles.currentGlow, { opacity: glow }]} />
                      <Animated.View style={[styles.sparkleA, { opacity: glow }]}>
                        <EightPointStar size={11} color={colors.gold} />
                      </Animated.View>
                      <Animated.View style={[styles.sparkleB, { opacity: bounce }]}>
                        <EightPointStar size={8} color={colors.goldDeep} />
                      </Animated.View>
                    </>
                  ) : null}

                  {/* Cleared-level star rating */}
                  {isCleared ? (
                    <View style={styles.starRow}>
                      <Ionicons name="star" size={12} color={colors.gold} />
                      <Ionicons name="star" size={14} color={colors.gold} style={{ marginTop: -3 }} />
                      <Ionicons name="star" size={12} color={colors.gold} />
                    </View>
                  ) : null}

                  <Animated.View
                    style={isCurrent ? { transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) }] } : undefined}
                  >
                    <PressableScale
                      onPress={() => (isUnlocked ? openSurahFromMemorization(surahNumber) : undefined)}
                      style={styles.nodeOuter}
                    >
                      {/* 3D base shadow disc for the chunky candy look */}
                      <View
                        style={[
                          styles.nodeBase,
                          isCleared ? styles.nodeBaseCleared : isCurrent ? styles.nodeBaseCurrent : styles.nodeBaseLocked,
                        ]}
                      />
                      <View
                        style={[
                          styles.node,
                          isCleared ? styles.nodeCleared : isUnlocked ? styles.nodeUnlocked : styles.nodeLocked,
                          isCurrent && styles.nodeCurrent,
                        ]}
                      >
                        {/* Glossy candy highlight */}
                        {isUnlocked ? <View style={styles.nodeGloss} /> : null}

                        <MaterialCommunityIcons
                          name={nodeIcon as any}
                          size={30}
                          color={isCleared ? '#fff' : isUnlocked ? colors.primary : colors.faint}
                        />

                        <View style={[styles.nodeBadge, !isUnlocked && styles.nodeBadgeLocked, isCleared && styles.nodeBadgeCleared]}>
                          <Text style={styles.nodeBadgeText}>{surahNumber}</Text>
                        </View>

                        {isCurrent ? (
                          <View style={styles.currentStar}>
                            <EightPointStar size={20} color={colors.gold} />
                          </View>
                        ) : null}

                        {!isUnlocked ? (
                          <View style={styles.lockBadge}>
                            <Ionicons name="lock-closed" size={11} color={colors.muted} />
                          </View>
                        ) : null}
                      </View>
                    </PressableScale>
                  </Animated.View>

                  {isCurrent ? (
                    <Animated.View
                      style={[
                        styles.signpost,
                        { transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                      ]}
                    >
                      <View style={styles.signpostBody}>
                        <Ionicons name="location" size={11} color={colors.gold} />
                        <Text style={styles.signpostText}>YOU ARE HERE</Text>
                      </View>
                      <View style={styles.signpostPointer} />
                    </Animated.View>
                  ) : null}
                </View>
              );
            })}

            {/* Start flag at the very bottom */}
            {trackW > 0 ? (
              <View style={[styles.startFlag, { top: trackHeight - BOTTOM_PAD + 18, left: posFor(0).x - 28 }]}>
                <MaterialCommunityIcons name="flag-variant" size={16} color={colors.goldDeep} />
                <Text style={styles.startFlagText}>START</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TabFadeInView>

      {/* ───── Current Level Checkpoint ───── */}
      <TabFadeInView>
        <View ref={checkpointRef} collapsable={false} style={styles.checkpoint}>
          <StarFieldWatermark rows={3} cols={5} starSize={24} color="rgba(11,107,79,0.04)" />

          {/* Header: a replica of the current map node + label */}
          <View style={styles.checkpointHead}>
            <View style={styles.checkpointBadge}>
              <Animated.View style={[styles.checkpointBadgeGlow, { opacity: glow }]} />
              <View style={styles.checkpointBadgeBase} />
              <View style={styles.checkpointBadgeFace}>
                <MaterialCommunityIcons
                  name={NODE_ICONS[unlockedSurah % NODE_ICONS.length] as any}
                  size={30}
                  color={colors.primary}
                />
                <View style={styles.checkpointBadgeNum}>
                  <Text style={styles.checkpointBadgeNumText}>{unlockedSurah}</Text>
                </View>
                <View style={styles.checkpointBadgeStar}>
                  <EightPointStar size={18} color={colors.gold} />
                </View>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.checkpointPill}>
                <MaterialCommunityIcons name="flag-checkered" size={11} color={colors.goldDeep} />
                <Text style={styles.checkpointPillText}>CURRENT LEVEL</Text>
              </View>
              <Text style={styles.checkpointTitle}>Surah {unlockedSurah} Checkpoint</Text>
              <Text style={styles.checkpointSub}>
                {unlockedSurah === 114
                  ? 'The final Surah — finish to complete your journey.'
                  : 'Clear this Surah to light up the next level.'}
              </Text>
            </View>
          </View>

          <GeometricDivider color={colors.goldBorder} style={{ marginVertical: 14 }} />

          {/* Chunky candy action buttons */}
          <View style={styles.actionButtonsRow}>
            <PressableScale onPress={() => openSurahFromMemorization(unlockedSurah)} style={[styles.actionButton, styles.readButton]}>
              <Ionicons name="book" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Read & Listen</Text>
            </PressableScale>
            <PressableScale
              disabled={unlockMutation.isPending || unlockedSurah === 114}
              onPress={() => unlockMutation.mutate(unlockedSurah)}
              style={[styles.actionButton, styles.unlockButton, (unlockMutation.isPending || unlockedSurah === 114) && styles.disabledButton]}
            >
              <MaterialCommunityIcons name="check-decagram" size={18} color={colors.primaryDeep} />
              <Text style={[styles.actionButtonText, { color: colors.primaryDeep }]}>
                {unlockedSurah === 114 ? 'Completed' : unlockMutation.isPending ? 'Unlocking…' : 'Mark Learnt'}
              </Text>
            </PressableScale>
          </View>
          {unlockMutation.isError ? (
            <Text style={styles.unlockError}>
              {(unlockMutation.error as any)?.response?.data?.message ||
                'Could not unlock the next Surah. Mark every ayah learned first.'}
            </Text>
          ) : null}
        </View>
      </TabFadeInView>
      </View>
    </ScrollView>
    </TabSceneGuard>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, paddingBottom: 128, gap: 16 },

  loaderWrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: colors.muted, fontWeight: '600' },

  // Locked state
  centerContainer: { flex: 1, backgroundColor: colors.bg, padding: 20, justifyContent: 'center' },
  lockHero: {
    backgroundColor: colors.primaryDeep, borderRadius: radius.xl, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primaryDark, overflow: 'hidden', ...shadow.raised,
  },
  lockTitle: { color: '#fff', fontWeight: '800', fontSize: 22, marginTop: 16, fontFamily: fonts.serif, textAlign: 'center' },
  lockText: { color: colors.onDarkMuted, textAlign: 'center', lineHeight: 21, fontSize: 13.5 },
  lockButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gold,
    paddingVertical: 12, paddingHorizontal: 22, borderRadius: radius.sm, marginTop: 20,
  },
  lockButtonText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 14 },

  // Hero
  hero: {
    backgroundColor: colors.primaryDeep, borderRadius: radius.xl, padding: 20,
    borderWidth: 1, borderColor: colors.primaryDark, overflow: 'hidden', ...shadow.raised,
  },
  heroGoldTop: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, backgroundColor: colors.gold, opacity: 0.45 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(197,155,39,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: '#fff', fontWeight: '800', fontSize: 19, fontFamily: fonts.serif },
  heroSub: { color: colors.onDarkMuted, fontSize: 12, marginTop: 3, lineHeight: 16 },
  progressTrack: {
    height: 10, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 18, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 6 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  heroProgressText: { color: colors.onDarkMuted, fontWeight: '700', fontSize: 12 },
  heroPct: { color: colors.gold, fontWeight: '800', fontSize: 14 },

  // Map shell
  mapCard: {
    backgroundColor: colors.cardAlt, borderRadius: radius.xl, paddingTop: 18, paddingHorizontal: 8,
    paddingBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.goldBorder, ...shadow.card,
  },
  pathLabelWrap: {
    alignSelf: 'center', marginBottom: 8, backgroundColor: colors.goldSoft, borderRadius: radius.pill,
    paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1, borderColor: colors.goldBorder,
    flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2,
  },
  stageLabelCenter: { alignItems: 'center' },
  pathLabel: { color: colors.goldDeep, fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  stageSub: { color: colors.goldDeep, fontWeight: '700', fontSize: 9.5, letterSpacing: 0.4, opacity: 0.85, marginTop: 1 },

  // Serpentine track
  track: { width: '100%', position: 'relative' },

  // Connected winding candy road
  roadBase: {
    position: 'absolute', height: ROAD_BASE_W, borderRadius: ROAD_BASE_W / 2,
    backgroundColor: colors.primaryDeep, opacity: 0.16,
  },
  roadTop: { position: 'absolute', height: ROAD_TOP_W, borderRadius: ROAD_TOP_W / 2 },
  roadTopOn: { backgroundColor: colors.gold, opacity: 0.95 },
  roadTopOff: { backgroundColor: colors.primaryTint, opacity: 0.9 },
  roadStud: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  roadStudOn: { backgroundColor: '#fff', borderColor: colors.goldDeep },
  roadStudOff: { backgroundColor: colors.card, borderColor: colors.primaryTint },

  decor: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  decorGlow: {
    position: 'absolute', width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.goldSoft, opacity: 0.9,
  },

  nodeSlot: { position: 'absolute', width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },

  currentGlow: {
    position: 'absolute', width: NODE + 34, height: NODE + 34, borderRadius: (NODE + 34) / 2,
    backgroundColor: colors.gold, top: -17, alignSelf: 'center',
  },

  starRow: {
    position: 'absolute', top: -20, flexDirection: 'row', alignItems: 'flex-start', gap: 2, zIndex: 3,
  },

  nodeOuter: { width: NODE, height: NODE + 6, alignItems: 'center', justifyContent: 'flex-start' },
  nodeBase: {
    position: 'absolute', top: 6, width: NODE, height: NODE, borderRadius: 26,
  },
  nodeBaseCleared: { backgroundColor: colors.primaryDeep, opacity: 0.55 },
  nodeBaseCurrent: { backgroundColor: colors.goldDeep, opacity: 0.6 },
  nodeBaseLocked: { backgroundColor: '#C9BFA6', opacity: 0.5 },

  node: {
    width: NODE, height: NODE, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, backgroundColor: '#fff',
  },
  nodeGloss: {
    position: 'absolute', top: 7, width: 32, height: 14, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  nodeUnlocked: { borderColor: colors.primaryTint },
  nodeCleared: { backgroundColor: colors.primary, borderColor: colors.gold },
  nodeLocked: { borderColor: colors.borderSoft, backgroundColor: '#F1EBDD' },
  nodeCurrent: { borderColor: colors.gold, borderWidth: 4, transform: [{ scale: 1.08 }] },

  nodeBadge: {
    position: 'absolute', bottom: -9, minWidth: 28, height: 22, borderRadius: 11,
    backgroundColor: colors.primary, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  nodeBadgeLocked: { backgroundColor: colors.faint },
  nodeBadgeCleared: { backgroundColor: colors.goldDeep },
  nodeBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },

  currentStar: { position: 'absolute', top: -14, right: -8 },
  lockBadge: {
    position: 'absolute', bottom: -6, right: -4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },

  // Twinkling stars around the current node
  sparkleA: { position: 'absolute', top: -6, right: -2, zIndex: 4 },
  sparkleB: { position: 'absolute', top: 6, left: -4, zIndex: 4 },

  // Bobbing "YOU ARE HERE" signpost pin above the current node
  signpost: { position: 'absolute', top: -34, alignItems: 'center', zIndex: 6 },
  signpostBody: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primaryDeep, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: colors.gold,
  },
  signpostText: { color: colors.gold, fontWeight: '900', fontSize: 8.5, letterSpacing: 0.8 },
  signpostPointer: {
    width: 0, height: 0, marginTop: -1,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.primaryDeep,
  },

  startFlag: {
    position: 'absolute', width: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: colors.goldSoft, borderRadius: radius.pill, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.goldBorder,
  },
  startFlagText: { color: colors.goldDeep, fontWeight: '900', fontSize: 9, letterSpacing: 0.5 },

  // Current Level Checkpoint — cream/gold, matching the map card
  checkpoint: {
    backgroundColor: colors.cardAlt, borderRadius: radius.xl, padding: 18,
    borderWidth: 1, borderColor: colors.goldBorder, overflow: 'hidden', ...shadow.card,
  },
  checkpointHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },

  // Badge: a replica of the current map node (chunky, gold-ringed, with 3D base)
  checkpointBadge: { width: 70, height: 76, alignItems: 'center', justifyContent: 'center' },
  checkpointBadgeGlow: {
    position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: colors.gold,
  },
  checkpointBadgeBase: {
    position: 'absolute', top: 12, width: 64, height: 64, borderRadius: 24,
    backgroundColor: colors.goldDeep, opacity: 0.6,
  },
  checkpointBadgeFace: {
    width: 64, height: 64, borderRadius: 24, backgroundColor: '#fff',
    borderWidth: 4, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  checkpointBadgeNum: {
    position: 'absolute', bottom: -9, minWidth: 28, height: 22, borderRadius: 11, paddingHorizontal: 7,
    backgroundColor: colors.goldDeep, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  checkpointBadgeNumText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  checkpointBadgeStar: { position: 'absolute', top: -12, right: -8 },

  checkpointPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: colors.goldSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.goldBorder, marginBottom: 7,
  },
  checkpointPillText: { color: colors.goldDeep, fontWeight: '900', fontSize: 9, letterSpacing: 0.8 },
  checkpointTitle: { color: colors.text, fontSize: 17, fontWeight: '800', fontFamily: fonts.serif },
  checkpointSub: { color: colors.muted, marginTop: 3, fontSize: 12.5, lineHeight: 18 },

  // Chunky extruded candy buttons (3D bottom edge via borderBottomWidth)
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginHorizontal: -4 },
  actionButton: {
    flex: 1, paddingVertical: 17, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7, borderBottomWidth: 4,
  },
  readButton: { backgroundColor: colors.primary, borderColor: colors.primaryDeep },
  unlockButton: { backgroundColor: colors.gold, borderColor: colors.goldDeep },
  disabledButton: { opacity: 0.5 },
  actionButtonText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  unlockError: { color: colors.danger, fontWeight: '700', fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
});
