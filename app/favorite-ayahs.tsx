import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/Anim';
import { getFavoriteAyahs, type FavoriteAyah } from '@/services/favoriteAyahService';
import { fonts, radius, shadow } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { useResponsive } from '@/theme/responsive';

export default function FavoriteAyahsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const styles = makeStyles(colors);
  const [favorites, setFavorites] = useState<FavoriteAyah[]>([]);

  const refresh = useCallback(() => {
    getFavoriteAyahs()
      .then(setFavorites)
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => undefined;
    }, [refresh])
  );

  const onOpen = (fav: FavoriteAyah) => {
    router.push({
      pathname: '/quran/[surah]',
      params: { surah: String(fav.surahNumber), scrollAyah: String(fav.ayahNumber) },
    } as any);
  };

  const renderFavorite = ({ item }: { item: FavoriteAyah }) => (
    <PressableScale onPress={() => onOpen(item)}>
      <View style={styles.item}>
        <View style={styles.itemHeader}>
          <View style={styles.referencePill}>
            <Ionicons name="star" size={13} color={colors.goldDeep} />
            <Text style={styles.referenceText}>
              {item.surahNameEnglish} · Ayah {item.ayahNumber}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </View>
        <Text style={styles.arabic} numberOfLines={4}>
          {item.arabicText}
        </Text>
      </View>
    </PressableScale>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top, height: 58 + insets.top }]}>
        <PressableScale onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Favorite Ayahs</Text>
          <Text style={styles.headerSubtitle}>{favorites.length} saved</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => `${item.surahNumber}-${item.ayahNumber}`}
        renderItem={renderFavorite}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
          responsive.centerContent,
          favorites.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="star-outline" size={34} color={colors.goldDeep} />
            </View>
            <Text style={styles.emptyTitle}>No favorite ayahs yet</Text>
            <Text style={styles.emptyText}>
              Tap the star on any ayah in the Quran reader to collect it here.
            </Text>
            <PressableScale onPress={() => router.push('/quran')} style={styles.emptyButton}>
              <Ionicons name="book-outline" size={17} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Open Quran</Text>
            </PressableScale>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      backgroundColor: colors.primaryDeep,
      ...shadow.raised,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    headerCenter: {
      alignItems: 'center',
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
      fontFamily: fonts.serif,
    },
    headerSubtitle: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
    headerRight: {
      width: 40,
    },
    listContent: {
      padding: 16,
      gap: 12,
    },
    emptyListContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    item: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
      ...shadow.card,
    },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    referencePill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.goldBorder,
    },
    referenceText: {
      flex: 1,
      color: colors.goldDeep,
      fontSize: 12,
      fontWeight: '800',
    },
    arabic: {
      color: colors.text,
      fontFamily: fonts.arabic,
      fontSize: 22,
      lineHeight: 40,
      textAlign: 'right',
    },
    emptyWrap: {
      alignItems: 'center',
      paddingHorizontal: 22,
    },
    emptyIcon: {
      width: 68,
      height: 68,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.goldBorder,
      marginBottom: 16,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      fontFamily: fonts.serif,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 8,
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 18,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      ...shadow.soft,
    },
    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
    },
  });
}
