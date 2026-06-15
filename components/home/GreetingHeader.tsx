import React from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';

/**
 * Time-aware greeting. Pairs a short Arabic salutation with an English line that
 * uses the signed-in person's first name when we have it.
 */
function partOfDay(hour: number) {
  if (hour < 5) return { en: 'Peaceful night', ar: 'طابَتْ ليلتُك', icon: 'moon-outline' as const };
  if (hour < 12) return { en: 'Good morning', ar: 'صباح الخير', icon: 'partly-sunny-outline' as const };
  if (hour < 17) return { en: 'Good afternoon', ar: 'مساء الخير', icon: 'sunny-outline' as const };
  if (hour < 20) return { en: 'Good evening', ar: 'مساء الخير', icon: 'cloudy-night-outline' as const };
  return { en: 'Peaceful night', ar: 'طابَتْ ليلتُك', icon: 'moon-outline' as const };
}

export const GreetingHeader = React.memo(function GreetingHeader({
  name,
  hour,
}: {
  name?: string | null;
  hour: number;
}) {
  const part = partOfDay(hour);
  const firstName = name ? name.trim().split(/\s+/)[0] : null;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.eyebrow}>
          <Ionicons name={part.icon} size={13} color={colors.goldDeep} />
          <Text style={styles.eyebrowText}>{part.en.toUpperCase()}</Text>
        </View>
        <Text style={styles.greeting} numberOfLines={1}>
          {firstName ? (
            <>
              {'Assalamu ʿalaikum, '}
              <Text style={styles.name}>{firstName}</Text>
            </>
          ) : (
            'Assalamu ʿalaikum'
          )}
        </Text>
        <Text style={styles.arabic}>{'السَّلامُ عَلَيْكُم'}</Text>
      </View>

      <Link href="/settings" asChild>
        <PressableScale style={styles.settingsBtn} accessibilityLabel="Open settings">
          <Ionicons name="settings-outline" size={20} color={colors.primary} />
        </PressableScale>
      </Link>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: { flex: 1 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  eyebrowText: {
    color: colors.goldDeep,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  greeting: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    fontFamily: fonts.serif,
    letterSpacing: 0.2,
  },
  name: { color: colors.primary },
  arabic: {
    fontFamily: fonts.arabic,
    color: colors.muted,
    fontSize: 17,
    lineHeight: 30,
    marginTop: 3,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
