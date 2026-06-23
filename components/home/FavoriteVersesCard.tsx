import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getFavoriteAyahs, type FavoriteAyah } from '@/services/favoriteAyahService';
import { fonts, radius } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { PressableScale } from '@/components/Anim';
import { OrnateCard, SectionHeader } from '@/components/ui';

export const FavoriteVersesCard = React.memo(function FavoriteVersesCard({ index }: { index: number }) {
  const colors = useThemeColors();
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

  const styles = makeStyles(colors);

  const onOpen = (fav: FavoriteAyah) => {
    router.push({
      pathname: '/quran/[surah]',
      params: { surah: String(fav.surahNumber), scrollAyah: String(fav.ayahNumber) },
    } as any);
  };

  return (
    <OrnateCard index={index}>
      <SectionHeader
        title="Favorite Verses"
        subtitle={favorites.length ? `${favorites.length} saved` : 'Star verses while reading Quran'}
        icon={<Ionicons name="star" size={18} color={colors.goldDeep} />}
      />

      {favorites.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="star-outline" size={28} color={colors.faint} />
          <Text style={styles.emptyText}>
            Tap the star on any ayah in the Quran reader to save it here.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {favorites.slice(0, 8).map((fav) => (
            <PressableScale key={`${fav.surahNumber}-${fav.ayahNumber}`} onPress={() => onOpen(fav)}>
              <View style={styles.item}>
                <Text style={styles.arabic} numberOfLines={2}>
                  {fav.arabicText}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    {fav.surahNameEnglish} · Ayah {fav.ayahNumber}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                </View>
              </View>
            </PressableScale>
          ))}
        </View>
      )}
    </OrnateCard>
  );
});

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 18,
      gap: 10,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 12,
    },
    list: { gap: 10, marginTop: 4 },
    item: {
      backgroundColor: colors.cardAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSoft,
      padding: 14,
      gap: 8,
    },
    arabic: {
      fontFamily: fonts.arabic,
      color: colors.text,
      fontSize: 20,
      lineHeight: 36,
      textAlign: 'right',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    meta: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
