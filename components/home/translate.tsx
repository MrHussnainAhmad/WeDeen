import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { colors, fonts, radius } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';

/**
 * Shared translation helpers for the Verse and Hadith cards.
 * Uses the free MyMemory translation API, chunking long passages to stay under
 * the per-request character limit.
 */

export type LangOption = { code: string; label: string };

export const LANG_OPTIONS: LangOption[] = [
  { code: 'en', label: 'English' },
  { code: 'ur', label: 'اردو' },
  { code: 'ar', label: 'عربي' },
  { code: 'fr', label: 'Français' },
  { code: 'tr', label: 'Türkçe' },
];

export function hasArabic(text?: string | null) {
  if (!text) return false;
  return /[؀-ۿ]/.test(text);
}

export function fontForLang(lang: string | null): TextStyle | undefined {
  if (lang === 'ur') return { fontFamily: fonts.urdu, fontSize: 20, lineHeight: 36, textAlign: 'right' };
  if (lang === 'fr' || lang === 'tr' || lang === 'en') return { fontFamily: fonts.sans };
  return undefined;
}

function detectSourceLang(text: string) {
  return hasArabic(text) ? 'ar' : 'en';
}

export async function translateText(text: string, targetLang: string) {
  const sourceLang = detectSourceLang(text);
  if (sourceLang === targetLang) return text;

  const MAX_CHARS = 450;

  const translateChunk = async (chunk: string) => {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${sourceLang}|${targetLang}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data?.responseData?.translatedText || chunk;
    } catch {
      return chunk;
    }
  };

  if (text.length <= MAX_CHARS) {
    return translateChunk(text);
  }

  const words = text.split(' ');
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > MAX_CHARS) {
      if (current) chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  const out: string[] = [];
  for (const chunk of chunks) {
    out.push(await translateChunk(chunk));
  }
  return out.join(' ');
}

export function LangPicker({ prefix, onPick }: { prefix: string; onPick: (code: string) => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>TRANSLATE TO</Text>
      <View style={styles.grid}>
        {LANG_OPTIONS.map((lang) => (
          <PressableScale
            key={`${prefix}-${lang.code}`}
            onPress={() => onPick(lang.code)}
            style={styles.pill}
          >
            <Text style={styles.pillText}>{lang.label}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 9 },
  grid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  pillText: { color: colors.text, fontSize: 12.5, fontWeight: '700' },
});
