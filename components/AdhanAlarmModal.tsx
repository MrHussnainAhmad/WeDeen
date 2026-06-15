import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar, GeometricDivider } from '@/components/IslamicMotifs';
import { PressableScale } from '@/components/Anim';
import { stopAdhan, useAdhanAlarm } from '@/services/adhanController';
import { snoozeAdhan } from '@/services/prayerNotificationService';

const SNOOZE_MINUTES = 5;

/**
 * Full-screen adhan alarm pop-up. Mounted once at the app root; appears whenever
 * an adhan rings (prayer time, test, or a tapped notification) with Stop and
 * Snooze controls.
 */
export function AdhanAlarmModal() {
  const visible = useAdhanAlarm((s) => s.visible);
  const prayer = useAdhanAlarm((s) => s.prayer) || 'Prayer';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={stopAdhan}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.starWrap}>
            <EightPointStar size={34} color={colors.gold} filled={false} />
          </View>

          <Text style={styles.kicker}>Adhan</Text>
          <Text style={styles.title}>{`It's time for ${prayer}`}</Text>
          <Text style={styles.arabic}>{'حَيَّ عَلَى الصَّلَاة'}</Text>

          <GeometricDivider color={colors.gold} style={{ marginVertical: 14 }} />

          <View style={styles.actions}>
            <PressableScale style={[styles.btn, styles.snoozeBtn]} onPress={() => snoozeAdhan(prayer, SNOOZE_MINUTES)}>
              <Ionicons name="alarm-outline" size={18} color={colors.primary} />
              <Text style={[styles.btnText, styles.snoozeText]}>Snooze {SNOOZE_MINUTES} min</Text>
            </PressableScale>

            <PressableScale style={[styles.btn, styles.stopBtn]} onPress={stopAdhan}>
              <Ionicons name="stop-circle-outline" size={18} color="#fff" />
              <Text style={[styles.btnText, styles.stopText]}>Stop</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6,53,40,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    ...shadow.raised,
  },
  starWrap: { marginBottom: 10 },
  kicker: {
    color: colors.goldDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.serif,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  arabic: {
    fontFamily: fonts.arabic,
    color: colors.primaryDark,
    fontSize: 26,
    lineHeight: 46,
    marginTop: 6,
    writingDirection: 'rtl',
  },
  actions: { alignSelf: 'stretch', gap: 10 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.md,
    ...shadow.soft,
  },
  btnText: { fontWeight: '800', fontSize: 15 },
  snoozeBtn: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  snoozeText: { color: colors.primary },
  stopBtn: { backgroundColor: colors.primary },
  stopText: { color: '#fff' },
});
