import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, radius } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';
import { OrnateCard, SectionHeader } from '@/components/ui';
import { GeometricDivider } from '@/components/IslamicMotifs';
import { LangPicker, translateText, hasArabic, fontForLang } from './translate';

export const HadithCard = React.memo(function HadithCard({ index, hadith }: { index: number; hadith: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);
  const [showLangs, setShowLangs] = useState(false);
  const [translating, setTranslating] = useState(false);

  const shown = translated ?? hadith;

  const onPick = async (code: string) => {
    setTranslating(true);
    try {
      const result = await translateText(hadith, code);
      setTranslated(result);
      setLang(code);
    } finally {
      setTranslating(false);
      setShowLangs(false);
    }
  };

  return (
    <OrnateCard index={index}>
      <SectionHeader
        title="Hadith of the Day"
        subtitle="From the Sunnah"
        icon={<MaterialCommunityIcons name="book-open-variant" size={18} color={colors.goldDeep} />}
        accent={colors.gold}
      />

      <View style={styles.body}>
        <FontAwesome6 name="quote-left" size={15} color="rgba(197,155,39,0.2)" style={styles.quote} />
        <Text
          style={[
            styles.text,
            hasArabic(shown) && styles.textArabic,
            fontForLang(lang),
          ]}
        >
          {shown}
        </Text>
      </View>

      <GeometricDivider color={colors.goldBorder} style={{ marginVertical: 12 }} />

      <View style={styles.footer}>
        <View style={styles.sourcePill}>
          <MaterialCommunityIcons name="check-decagram-outline" size={12} color={colors.goldDeep} />
          <Text style={styles.sourceText}>Sahih Muslim</Text>
        </View>
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
          <MaterialCommunityIcons name="translate" size={14} color={colors.goldDeep} style={{ marginRight: 5 }} />
          <Text style={styles.translateText}>
            {translating ? 'Translating…' : translated ? 'Original' : 'Translate'}
          </Text>
        </PressableScale>
      </View>

      {showLangs && !translating ? <LangPicker prefix="h" onPick={onPick} /> : null}
    </OrnateCard>
  );
});

const styles = StyleSheet.create({
  body: { position: 'relative', paddingLeft: 14, paddingTop: 4 },
  quote: { position: 'absolute', left: -2, top: -2 },
  text: { color: colors.text, fontSize: 14.5, lineHeight: 24, fontWeight: '500' },
  textArabic: {
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
  },
  sourcePill: {
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
  sourceText: { color: colors.goldDeep, fontSize: 11.5, fontWeight: '800' },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  translateText: { color: colors.goldDeep, fontSize: 12.5, fontWeight: '700' },
});
