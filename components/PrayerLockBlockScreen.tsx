import { Image, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar, GeometricDivider } from '@/components/IslamicMotifs';
import { PressableScale } from '@/components/Anim';
import type { PrayerLabel } from '@/services/prayerTimingUtils';

type Props = {
  dialogue: string;
  activePrayer: PrayerLabel | null;
  blockedAppName?: string;
  emergencyAllowed?: boolean;
  submitting?: boolean;
  emergencySubmitting?: boolean;
  onPrayed: () => void;
  onEmergencyUnlock?: () => void;
};

export function PrayerLockBlockScreen({
  dialogue,
  activePrayer,
  blockedAppName,
  emergencyAllowed = false,
  submitting,
  emergencySubmitting,
  onPrayed,
  onEmergencyUnlock,
}: Props) {
  const busy = submitting || emergencySubmitting;

  return (
    <View style={styles.screen}>
      <View style={styles.starTop}>
        <EightPointStar size={24} color={colors.goldBorder} filled={false} />
      </View>

      <Image source={require('@/assets/images/logo.png')} style={styles.logo} resizeMode="contain" />

      <Text style={styles.brand}>WeDeen</Text>
      <GeometricDivider color={colors.gold} style={{ marginVertical: 14, width: '40%' }} />

      {activePrayer ? (
        <View style={styles.prayerPill}>
          <Ionicons name="moon-outline" size={14} color={colors.gold} />
          <Text style={styles.prayerPillText}>{activePrayer} time</Text>
        </View>
      ) : null}

      {blockedAppName ? (
        <Text style={styles.blockedApp}>
          {blockedAppName} is paused until you pray.
        </Text>
      ) : null}

      <Text style={styles.dialogue}>{dialogue}</Text>

      <PressableScale
        onPress={onPrayed}
        disabled={busy || !activePrayer}
        style={[styles.prayedButton, (busy || !activePrayer) && styles.disabled]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryDeep} />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color={colors.primaryDeep} />
            <Text style={styles.prayedButtonText}>I have prayed</Text>
          </>
        )}
      </PressableScale>

      {onEmergencyUnlock ? (
        <PressableScale
          onPress={onEmergencyUnlock}
          disabled={busy || !emergencyAllowed}
          style={[
            styles.emergencyButton,
            (busy || !emergencyAllowed) && styles.emergencyButtonDisabled,
          ]}
        >
          {emergencySubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="medkit-outline"
                size={18}
                color={emergencyAllowed ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
              />
              <Text
                style={[
                  styles.emergencyButtonText,
                  !emergencyAllowed && styles.emergencyButtonTextDisabled,
                ]}
              >
                It&apos;s emergency — I will pray soon
              </Text>
            </>
          )}
        </PressableScale>
      ) : null}

      <Text style={styles.footnote}>
        {emergencyAllowed
          ? 'Emergency unlock lasts 15 minutes. Instagram, Facebook, YouTube & TikTok stay locked.'
          : blockedAppName
            ? `${blockedAppName} cannot be emergency-unlocked. Pray, then tap “I have prayed”.`
            : 'Apps stay blocked until you tap “I have prayed”.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  starTop: {
    position: 'absolute',
    top: 56,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 10,
  },
  brand: {
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  prayerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(197,155,39,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  prayerPillText: {
    color: colors.gold,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  blockedApp: {
    color: 'rgba(255,255,255,0.62)',
    fontFamily: fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  dialogue: {
    color: 'rgba(255,255,255,0.92)',
    fontFamily: fonts.serif,
    fontSize: 19,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 340,
  },
  prayedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 28,
    minWidth: 220,
    ...shadow.card,
  },
  prayedButtonText: {
    color: colors.primaryDeep,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: '700',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 20,
    minWidth: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  emergencyButtonDisabled: {
    opacity: 0.55,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  emergencyButtonTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
  footnote: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.sans,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  disabled: {
    opacity: 0.65,
  },
});
