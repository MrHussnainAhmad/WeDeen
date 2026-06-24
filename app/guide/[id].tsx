import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Animated } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useThemeColors } from '@/theme/useThemeColors';
import { fonts, radius, shadow } from '@/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/Anim';
import { GUIDES } from '@/utils/guideData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/theme/responsive';

export default function GuideDetailScreen() {
  const { id } = useLocalSearchParams();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const guide = GUIDES.find((g) => g.id === id);
  const [lang, setLang] = useState<'en' | 'ur'>('en');

  if (!guide) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: themeColors.text }}>Guide not found</Text>
        <PressableScale onPress={() => router.back()} style={{ marginTop: 16, padding: 12, backgroundColor: themeColors.primary, borderRadius: 8 }}>
          <Text style={{ color: '#fff' }}>Go Back</Text>
        </PressableScale>
      </View>
    );
  }

  const isUrdu = lang === 'ur';

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      {/* Dynamic Image Header */}
      <View style={styles.imageHeader}>
        <Image source={guide.coverImage} style={styles.headerImage} />
        <View style={styles.headerOverlay} />
        
        {/* Navigation & Controls */}
        <View style={[styles.topBar, { top: Math.max(insets.top + 16, 28) }]}>
          <PressableScale onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </PressableScale>

          {/* Language Toggle */}
          <View style={styles.langToggle}>
            <PressableScale
              onPress={() => setLang('en')}
              style={[styles.langBtn, lang === 'en' && { backgroundColor: themeColors.primary }]}
            >
              <Text style={[styles.langText, lang === 'en' && { color: '#FFFFFF', fontWeight: 'bold' }]}>EN</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setLang('ur')}
              style={[styles.langBtn, lang === 'ur' && { backgroundColor: themeColors.primary }]}
            >
              <Text style={[styles.langText, lang === 'ur' && { color: '#FFFFFF', fontWeight: 'bold' }]}>اردو</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.headerTitleContainer}>
          <Text 
            style={[styles.headerTitle, isUrdu && { fontFamily: fonts.urdu, fontWeight: 'normal', fontSize: 32, lineHeight: 46, textAlign: 'right', paddingBottom: 14 }]}
            adjustsFontSizeToFit
            numberOfLines={2}
          >
            {isUrdu ? guide.titleUr : guide.titleEn}
          </Text>
        </View>
      </View>

      {/* Steps List */}
      <ScrollView contentContainerStyle={[styles.content, responsive.centerContent]} showsVerticalScrollIndicator={false}>
        {guide.steps.map((step, index) => (
          <View key={index} style={styles.stepContainer}>
            {/* Timeline Line & Dot */}
            <View style={styles.timeline}>
              <View style={[styles.timelineDot, { backgroundColor: themeColors.primaryDeep }]} />
              {index !== guide.steps.length - 1 && <View style={[styles.timelineLine, { backgroundColor: themeColors.border }]} />}
            </View>

            {/* Step Card */}
            <View style={[styles.stepCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[
                styles.stepTitle, 
                { color: themeColors.primaryDeep },
                isUrdu && { fontFamily: fonts.urdu, fontWeight: 'normal', fontSize: 20, textAlign: 'right', paddingTop: 6, lineHeight: 32 }
              ]}>
                {isUrdu ? '' : `${index + 1}. `}{isUrdu ? step.titleUr : step.titleEn}{isUrdu ? ` ۔${index + 1}` : ''}
              </Text>
              <Text style={[
                styles.stepDesc, 
                { color: themeColors.text },
                isUrdu && { fontFamily: fonts.urdu, fontWeight: 'normal', fontSize: 16, textAlign: 'right', lineHeight: 32, paddingTop: 4 }
              ]}>
                {isUrdu ? step.descUr : step.descEn}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageHeader: {
    height: 170,
    width: '100%',
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  langToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.pill,
    padding: 4,
    ...shadow.soft,
  },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  langText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  headerTitleContainer: {
    position: 'absolute',
    bottom: 16,
    left: 24,
    right: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: fonts.serif,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  content: {
    padding: 24,
    paddingTop: 32,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timeline: {
    width: 30,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...shadow.soft,
    zIndex: 2,
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: -8,
    marginBottom: -28, // Connects to the next dot
  },
  stepCard: {
    flex: 1,
    padding: 20,
    borderRadius: radius.xl,
    borderWidth: 1,
    ...shadow.card,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.serif,
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 15,
    lineHeight: 24,
  },
});
