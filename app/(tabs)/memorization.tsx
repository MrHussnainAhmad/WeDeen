import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { fetchLearningProgress, unlockNextSurah } from '@/services/memorizationService';
import { useAuthStore } from '@/store/authStore';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar, GeometricDivider, StarFieldWatermark } from '@/components/IslamicMotifs';
import { FadeInView, PressableScale, useBreathing } from '@/components/Anim';
import { useResponsive } from '@/theme/responsive';
import { Animated } from 'react-native';

const TOTAL_SURAHS = 114;
const VISIBLE_MAP_NODES = 28;

// Serpentine map geometry (Candy-Crush style winding path, bottom → top).
const NODE = 74;          // level node diameter
const VSTEP = 108;        // vertical distance between levels
const TOP_PAD = 64;       // breathing room above the highest visible node
const BOTTOM_PAD = 78;    // breathing room below Surah 1

// Emerald/gold milestone icons (vector, no external images) cycled along the path.
const NODE_ICONS = [
  'star-crescent',
  'mosque',
  'book-open-variant',
  'star-four-points',
  'candle',
  'compass-outline',
] as const;

// Floating decorations scattered beside the trail.
const DECOR_ICONS = ['mosque', 'star-crescent', 'candelabra', 'candle', 'book-open-page-variant'] as const;

export default function MemorizationScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const scrollRef = useRef<ScrollView | null>(null);
  const autoScrolledRef = useRef(false);
  const trackOffsetYRef = useRef(0);
  const [trackW, setTrackW] = useState(0);

  const glow = useBreathing(0.25, 0.85, 1300);   // pulsing halo on the current node
  const bounce = useBreathing(0, 1, 900);         // gentle up/down hop on the current node

  const progressQuery = useQuery({
    queryKey: ['learning-progress', token],
    queryFn: () => fetchLearningProgress(token as string),
    enabled: !!token
  });

  const unlockMutation = useMutation({
    mutationFn: (surahNumber: number) => unlockNextSurah(token as string, surahNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-progress', token] });
    }
  });

  const unlockedSurah = progressQuery.data?.unlockedSurah ?? 1;

  useEffect(() => {
    autoScrolledRef.current = false;
  }, [unlockedSurah]);

  if (!token) {
    return (
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
    );
  }

  if (progressQuery.isLoading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loaderText}>Loading your journey…</Text>
      </View>
    );
  }

  const startSurah = Math.max(1, unlockedSurah - 8);
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

  // Winding dotted trail: 3 dots interpolated along each segment.
  const dots: { x: number; y: number; reached: boolean; key: string }[] = [];
  if (trackW > 0) {
    for (let i = 0; i < count - 1; i++) {
      const reached = startSurah + i + 1 <= unlockedSurah;
      for (const f of [0.28, 0.5, 0.72]) {
        const p = posFor(i + f);
        dots.push({ x: p.x, y: p.y, reached, key: `${i}-${f}` });
      }
    }
  }

  // Auto-scroll so the current level sits comfortably in view.
  const maybeAutoScroll = () => {
    if (autoScrolledRef.current || trackW === 0) return;
    const currentIndex = unlockedSurah - startSurah;
    const nodeTop = posFor(currentIndex).y - NODE / 2;
    const target = Math.max(0, trackOffsetYRef.current + nodeTop - 240);
    autoScrolledRef.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: target, animated: true }));
    setTimeout(() => scrollRef.current?.scrollTo({ y: target, animated: true }), 360);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: Math.max(insets.top + 14, 22) }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    >
      {/* ───── Hero ───── */}
      <FadeInView index={0}>
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
      </FadeInView>

      {/* ───── Journey Map (serpentine, bottom → top) ───── */}
      <FadeInView index={1}>
        <View
          style={styles.mapCard}
          onLayout={(e) => { trackOffsetYRef.current = e.nativeEvent.layout.y; maybeAutoScroll(); }}
        >
          <StarFieldWatermark rows={8} cols={5} starSize={26} color="rgba(11,107,79,0.04)" />

          <View style={styles.pathLabelWrap}>
            <EightPointStar size={12} color={colors.gold} />
            <Text style={styles.pathLabel}>Memorization Route</Text>
            <EightPointStar size={12} color={colors.gold} />
          </View>

          <View
            style={[styles.track, { height: trackHeight }]}
            onLayout={(e) => { setTrackW(e.nativeEvent.layout.width); maybeAutoScroll(); }}
          >
            {/* Winding dotted trail */}
            {dots.map((d) => (
              <View
                key={d.key}
                style={[
                  styles.trailDot,
                  d.reached ? styles.trailDotOn : styles.trailDotOff,
                  { left: d.x - 4, top: d.y - 4 },
                ]}
              />
            ))}

            {/* Floating decorations beside the path */}
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
                    { top: p.y - 16 },
                    onRight ? { right: 10 } : { left: 10 },
                  ]}
                >
                  <MaterialCommunityIcons name={decoIcon as any} size={26} color="rgba(197,155,39,0.55)" />
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
                  style={[styles.nodeSlot, { left: p.x - NODE / 2, top: p.y - NODE / 2 }]}
                >
                  {/* Pulsing halo on the current level */}
                  {isCurrent ? <Animated.View style={[styles.currentGlow, { opacity: glow }]} /> : null}

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
                      onPress={() => (isUnlocked ? router.push(`/quran/${surahNumber}`) : undefined)}
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
                    <View style={styles.youAreHere}>
                      <Text style={styles.youAreHereText}>YOU</Text>
                    </View>
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
      </FadeInView>

      {/* ───── Current Level Checkpoint ───── */}
      <FadeInView index={2}>
        <View style={styles.checkpoint}>
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
            <PressableScale onPress={() => router.push(`/quran/${unlockedSurah}`)} style={[styles.actionButton, styles.readButton]}>
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
        </View>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  pathLabel: { color: colors.goldDeep, fontWeight: '800', fontSize: 12, letterSpacing: 0.4 },

  // Serpentine track
  track: { width: '100%', position: 'relative' },

  trailDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  trailDotOn: { backgroundColor: colors.gold, opacity: 0.9 },
  trailDotOff: { backgroundColor: colors.primaryTint, opacity: 0.7 },

  decor: { position: 'absolute', opacity: 0.9 },

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

  youAreHere: {
    position: 'absolute', bottom: -30, backgroundColor: colors.primaryDeep, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 2, borderWidth: 1, borderColor: colors.gold,
  },
  youAreHereText: { color: colors.gold, fontWeight: '900', fontSize: 9, letterSpacing: 1 },

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
});
