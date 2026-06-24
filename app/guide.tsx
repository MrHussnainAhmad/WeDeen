import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useThemeColors } from '@/theme/useThemeColors';
import { fonts, radius, shadow } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/Anim';
import { router } from 'expo-router';
import { GUIDES } from '@/utils/guideData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/theme/responsive';

export default function GuideScreen() {
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      <View style={[styles.header, { backgroundColor: themeColors.primaryDeep, paddingTop: insets.top + 24 }]}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </PressableScale>
        <Text style={styles.headerTitle}>WeDeen Guides</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, responsive.centerContent]} showsVerticalScrollIndicator={false}>
        {GUIDES.map((guide) => (
          <PressableScale
            key={guide.id}
            onPress={() => router.push(`/guide/${guide.id}` as any)}
            style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
          >
            <View style={styles.imageContainer}>
              <Image source={guide.coverImage} style={styles.cardImage} />
              <View style={[styles.iconBadge, { backgroundColor: themeColors.primaryDeep }]}>
                <Ionicons name={guide.icon as any} size={20} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.cardBody}>
              <View>
                <Text style={[styles.title, { color: themeColors.text }]}>{guide.titleEn}</Text>
                <Text style={[styles.titleUr, { color: themeColors.primary }]}>{guide.titleUr}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={themeColors.muted} />
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    elevation: 4,
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
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow.card,
  },
  imageContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  iconBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadow.soft,
  },
  cardBody: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.serif,
    marginBottom: 4,
  },
  titleUr: {
    fontSize: 17,
    fontFamily: fonts.urdu,
  },
});
