import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchLearningProgress, unlockNextSurah } from '@/services/memorizationService';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';

const TOTAL_SURAHS = 114;
const VISIBLE_MAP_NODES = 28;

const TWEMOJI_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72';
const LEVEL_NODE_IMAGES = [
  `${TWEMOJI_BASE}/1f54b.png`, // Kaaba
  `${TWEMOJI_BASE}/1f54c.png`, // Mosque
  `${TWEMOJI_BASE}/1f319.png`, // Crescent
  `${TWEMOJI_BASE}/1f4d6.png`, // Book/Quran
  `${TWEMOJI_BASE}/2b50.png`,  // Star
  `${TWEMOJI_BASE}/1f4ff.png`, // Beads
  `${TWEMOJI_BASE}/1f9ed.png`, // Compass
  `${TWEMOJI_BASE}/1f4a7.png`, // Water
];
const ISLAMIC_LANDMARKS = [
  { uri: `${TWEMOJI_BASE}/1f54b.png`, ring: '#8E44AD' }, // Kaaba
  { uri: `${TWEMOJI_BASE}/1f54c.png`, ring: '#16A085' }, // Mosque
  { uri: `${TWEMOJI_BASE}/1f319.png`, ring: '#C0392B' }, // Crescent
  { uri: `${TWEMOJI_BASE}/1f3db.png`, ring: '#2C3E50' }, // Building (city/landmark)
  { uri: `${TWEMOJI_BASE}/26f0.png`, ring: '#27AE60' }, // Mountain
  { uri: `${TWEMOJI_BASE}/26fa.png`, ring: '#F39C12' }, // Tent (Mina)
  { uri: `${TWEMOJI_BASE}/1f4a7.png`, ring: '#2980B9' }, // Water (Zamzam)
  { uri: `${TWEMOJI_BASE}/1f9ed.png`, ring: '#7F8C8D' }, // Compass (Qiblah)
  { uri: `${TWEMOJI_BASE}/1f4ff.png`, ring: '#E67E22' }, // Prayer beads
  { uri: `${TWEMOJI_BASE}/1f4d6.png`, ring: '#AD58D1' }, // Quran/book
  { uri: `${TWEMOJI_BASE}/1f4e2.png`, ring: '#9B59B6' }, // Adhan / loudspeaker
  { uri: `${TWEMOJI_BASE}/2b50.png`, ring: '#1ABC9C' }, // Sacred star/checkpoint
];

export default function MemorizationScreen() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

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

  if (!token) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.centerTitle}>Quran Learning Progress</Text>
        <Text style={styles.centerText}>Login in Profile to start and sync your unlocked surahs across devices.</Text>
      </View>
    );
  }

  if (progressQuery.isLoading) {
    return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  }

  const unlockedSurah = progressQuery.data?.unlockedSurah ?? 1;
  const startSurah = Math.max(1, unlockedSurah - 8);
  const endSurah = Math.min(TOTAL_SURAHS, startSurah + VISIBLE_MAP_NODES - 1);
  const mapSurahs = Array.from({ length: endSurah - startSurah + 1 }, (_, i) => startSurah + i);
  const renderedMapSurahs = [...mapSurahs].reverse();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <View style={styles.heroGlowLeft} />
        <View style={styles.heroGlowRight} />
        <Text style={styles.heroTitle}>Quran Memorization Map</Text>
        <Text style={styles.heroSub}>
          Candy-style journey: complete one Surah to unlock the next checkpoint.
        </Text>
        <View style={styles.heroProgressPill}>
          <MaterialCommunityIcons name="map-marker-path" size={16} color="#fff" />
          <Text style={styles.heroProgressText}>Current: Surah {unlockedSurah} / {TOTAL_SURAHS}</Text>
        </View>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.skyTop} />
        <View style={styles.skyBottom} />
        <View style={styles.pathLabelWrap}>
          <Text style={styles.pathLabel}>Memorization Route</Text>
        </View>
        {renderedMapSurahs.map((surahNumber, index) => {
          const isUnlocked = surahNumber <= unlockedSurah;
          const isCurrent = surahNumber === unlockedSurah;
          const lane = index % 3;
          const laneStyle =
            lane === 0 ? styles.nodeLeft : lane === 1 ? styles.nodeCenter : styles.nodeRight;
          const showLandmark = index % 3 === 1;
          const landmark = ISLAMIC_LANDMARKS[index % ISLAMIC_LANDMARKS.length];
          const nodeImageUri = LEVEL_NODE_IMAGES[surahNumber % LEVEL_NODE_IMAGES.length];

          return (
            <View key={surahNumber}>
              {index > 0 ? <View style={[styles.connector, laneStyle]} /> : null}
              {showLandmark ? (
                <View style={[styles.landmarkWrap, lane === 2 ? styles.landmarkLeftShift : styles.landmarkRightShift]}>
                  <View style={[styles.landmarkBadge, { borderColor: `${landmark.ring}44` }]}>
                    <View style={[styles.landmarkIconCircle, { borderColor: `${landmark.ring}44` }]}>
                      <Image
                        source={{ uri: landmark.uri }}
                        style={styles.landmarkImage}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                </View>
              ) : null}
              <View style={[styles.nodeRow, laneStyle]}>
                <Pressable
                  onPress={() => (isUnlocked ? router.push(`/quran/${surahNumber}`) : undefined)}
                  style={[
                    styles.node,
                    isUnlocked ? styles.nodeUnlocked : styles.nodeLocked,
                    isCurrent && styles.nodeCurrent,
                  ]}
                >
                  <Image source={{ uri: nodeImageUri }} style={styles.nodeImage} resizeMode="contain" />
                  <View style={styles.nodeNumberBadge}>
                    <Text style={styles.nodeNumber}>{surahNumber}</Text>
                  </View>
                  {isCurrent ? (
                    <View style={styles.currentIconBadge}>
                      <Ionicons name="star" size={14} color="#fff" />
                    </View>
                  ) : null}
                  {!isUnlocked ? (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={12} color="#5E6A65" />
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.actionCard}>
        <Text style={styles.actionTitle}>Surah {unlockedSurah} Checkpoint</Text>
        <Text style={styles.actionSub}>Complete this checkpoint to unlock the next Surah.</Text>

        <View style={styles.actionButtonsRow}>
          <Pressable onPress={() => router.push(`/quran/${unlockedSurah}`)} style={[styles.actionButton, styles.readButton]}>
            <Ionicons name="book-outline" size={17} color="#fff" />
            <Text style={styles.actionButtonText}>Read & Listen</Text>
          </Pressable>

          <Pressable
            disabled={unlockMutation.isPending}
            onPress={() => unlockMutation.mutate(unlockedSurah)}
            style={[styles.actionButton, styles.unlockButton, unlockMutation.isPending && styles.disabledButton]}
          >
            <MaterialCommunityIcons name="map-marker-check-outline" size={17} color="#fff" />
            <Text style={styles.actionButtonText}>
              {unlockedSurah === 114 ? 'Completed' : unlockMutation.isPending ? 'Unlocking...' : 'Learnt (Next)'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4EEF8',
  },
  container: {
    paddingTop: 36,
    padding: 14,
    paddingBottom: 26,
    gap: 12,
  },
  loader: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
    justifyContent: 'center',
  },
  centerTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 17,
  },
  centerText: {
    color: colors.muted,
  },
  heroCard: {
    borderRadius: 18,
    backgroundColor: '#A766CC',
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#9259B4',
  },
  heroGlowLeft: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: -40,
    left: -25,
  },
  heroGlowRight: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
    bottom: -48,
    right: -20,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.92)',
    marginTop: 5,
    lineHeight: 18,
    fontSize: 12,
    fontWeight: '600',
  },
  heroProgressPill: {
    marginTop: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroProgressText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  mapCard: {
    backgroundColor: '#C8ECFF',
    borderRadius: 20,
    paddingTop: 22,
    paddingHorizontal: 8,
    paddingBottom: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#9EDAF9',
  },
  skyTop: {
    position: 'absolute',
    top: -80,
    left: -40,
    width: 360,
    height: 220,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  skyBottom: {
    position: 'absolute',
    bottom: -140,
    right: -60,
    width: 300,
    height: 220,
    borderRadius: 120,
    backgroundColor: 'rgba(158,218,249,0.45)',
  },
  pathLabelWrap: {
    alignSelf: 'center',
    marginBottom: 6,
    backgroundColor: '#F9E9FF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E6C8F7',
  },
  pathLabel: {
    color: '#9D56C3',
    fontWeight: '800',
    fontSize: 12,
  },
  connector: {
    width: 5,
    height: 24,
    borderRadius: 99,
    backgroundColor: '#FDF4FF',
    marginBottom: 2,
  },
  landmarkWrap: {
    marginBottom: 6,
  },
  landmarkLeftShift: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  landmarkRightShift: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  landmarkBadge: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  landmarkIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landmarkImage: {
    width: 20,
    height: 20,
  },
  nodeRow: {
    marginBottom: 5,
  },
  nodeLeft: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  nodeCenter: {
    alignSelf: 'center',
  },
  nodeRight: {
    alignSelf: 'flex-end',
    marginRight: 8,
  },
  node: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    position: 'relative',
    backgroundColor: '#FFFFFFE8',
  },
  nodeUnlocked: {
    borderColor: '#FCE7F3',
  },
  nodeLocked: {
    borderColor: '#EEF1F0',
    opacity: 0.72,
  },
  nodeCurrent: {
    borderColor: '#FFF1D6',
    transform: [{ scale: 1.1 }],
    shadowColor: '#FF9D2E',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  nodeImage: {
    width: 32,
    height: 32,
  },
  nodeNumber: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
  },
  nodeNumberBadge: {
    position: 'absolute',
    bottom: -8,
    minWidth: 24,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  currentIconBadge: {
    position: 'absolute',
    top: -8,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#AD58D1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -6,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D2DAD6',
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DDF0',
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  actionSub: {
    color: colors.muted,
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtonsRow: {
    marginTop: 11,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  readButton: {
    backgroundColor: colors.primary,
  },
  unlockButton: {
    backgroundColor: '#AD58D1',
  },
  disabledButton: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
});
