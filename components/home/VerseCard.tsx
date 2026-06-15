import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';
import { OrnateCard, SectionHeader } from '@/components/ui';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { LangPicker, translateText, hasArabic, fontForLang } from './translate';

export const VerseCard = React.memo(function VerseCard({
  index,
  arabic,
  translation,
  reference,
}: {
  index: number;
  arabic?: string | null;
  translation: string;
  reference?: string | null;
}) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [showLangs, setShowLangs] = useState(false);
  const [translating, setTranslating] = useState(false);

  const shown = translated ?? translation;

  const onPick = async (code: string) => {
    setTranslating(true);
    try {
      const result = await translateText(translation, code);
      setTranslated(result);
      setLang(code);
    } finally {
      setTranslating(false);
      setShowLangs(false);
    }
  };

  return (
    <OrnateCard index={index} flourish>
      <SectionHeader
        title="Verse of the Day"
        subtitle={reference ?? 'A reminder for today'}
        icon={<Ionicons name="sparkles" size={18} color={colors.primary} />}
      />

      {arabic ? (
        <View style={styles.arabicWrap}>
          <Text style={styles.arabicText}>{arabic}</Text>
        </View>
      ) : null}

      <GeometricDivider color={colors.goldBorder} style={{ marginVertical: 14 }} />

      <Text
        style={[
          styles.translation,
          hasArabic(shown) && styles.translationArabic,
          fontForLang(lang),
        ]}
      >
        {shown}
      </Text>

      <View style={styles.footer}>
        {reference ? (
          <View style={styles.refPill}>
            <Ionicons name="bookmark-outline" size={12} color={colors.goldDeep} />
            <Text style={styles.refText}>{reference}</Text>
          </View>
        ) : (
          <View />
        )}

        <PressableScale
          onPress={() => {
            if (translated) {
              setTranslated(null);
              setLang(null);
              setShowLangs(false);
              return;
            }
            setShowLangs((v) => !v);
          }}
          style={styles.translateBtn}
        >
          <Ionicons name="language" size={14} color={colors.primary} style={{ marginRight: 5 }} />
          <Text style={styles.translateText}>
            {translating ? 'Translating…' : translated ? 'Original' : 'Translate'}
          </Text>
        </PressableScale>
      </View>

      {showLangs && !translating ? <LangPicker prefix="v" onPick={onPick} /> : null}
    </OrnateCard>
  );
});

const styles = StyleSheet.create({
  arabicWrap: { paddingTop: 4 },
  arabicText: {
    fontFamily: fonts.arabic,
    color: colors.primaryDark,
    fontSize: 26,
    lineHeight: 50,
    textAlign: 'right',
  },
  translation: { color: colors.text, fontSize: 14.5, lineHeight: 24, fontWeight: '500' },
  translationArabic: {
    fontFamily: fonts.arabic,
    fontSize: 23,
    lineHeight: 42,
    textAlign: 'right',
    color: colors.primaryDark,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  refPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  refText: { color: colors.goldDeep, fontSize: 11.5, fontWeight: '800' },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryTint,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  translateText: { color: colors.primary, fontSize: 12.5, fontWeight: '700' },
});
