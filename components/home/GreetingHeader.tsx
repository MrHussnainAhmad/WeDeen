import React from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radius } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';
import { useThemeStore } from '@/store/themeStore';
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
  const colors = useThemeColors();
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const toggleColorScheme = useThemeStore((s) => s.toggleColorScheme);
  const part = partOfDay(hour);
  const firstName = name ? name.trim().split(/\s+/)[0] : null;

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
    userName: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 4,
    },
    right: {
      alignItems: 'flex-end',
      gap: 6,
    },
    arabicRight: {
      fontFamily: fonts.arabic,
      color: colors.muted,
      fontSize: 17,
      lineHeight: 26,
      textAlign: 'right',
      marginTop: 2,
    },
    actions: { flexDirection: 'row', gap: 8 },
    iconBtn: {
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

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.eyebrow}>
          <Ionicons name={part.icon} size={13} color={colors.goldDeep} />
          <Text style={styles.eyebrowText}>{part.en.toUpperCase()}</Text>
        </View>
        <Text style={styles.greeting} numberOfLines={1}>
          Assalamu ʿalaikum
        </Text>
        {name ? (
          <Text style={styles.userName} numberOfLines={1}>
            {name}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        <View style={styles.actions}>
          <PressableScale
            onPress={() => toggleColorScheme()}
            style={styles.iconBtn}
            accessibilityLabel={colorScheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Ionicons
              name={colorScheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={colors.primary}
            />
          </PressableScale>
          <Link href="/settings" asChild>
            <PressableScale style={styles.iconBtn} accessibilityLabel="Open settings">
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
            </PressableScale>
          </Link>
        </View>
        <Text style={styles.arabicRight}>{'السَّلامُ عَلَيْكُم'}</Text>
      </View>
    </View>
  );
});
