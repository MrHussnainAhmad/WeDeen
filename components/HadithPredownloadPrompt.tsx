import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { EightPointStar, GeometricDivider } from '@/components/IslamicMotifs';
import { PressableScale } from '@/components/Anim';

/**
 * One-time onboarding prompt (shown over the boot screen after the Quran has
 * finished caching) offering to predownload the hadith books for offline use.
 */
export function HadithPredownloadPrompt({
  visible,
  onYes,
  onNo,
}: {
  visible: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.starWrap}>
            <EightPointStar size={30} color={colors.gold} filled={false} />
          </View>

          <Text style={styles.titleArabic}>{'كُتُب الحَديث'}</Text>
          <Text style={styles.title}>Download Hadith Books?</Text>

          <GeometricDivider color={colors.gold} style={{ marginVertical: 12 }} />

          <Text style={styles.body}>
            Save the hadith collections to your device so you can read them anytime — even
            offline. They&apos;ll download quietly in the background while you use the app.
          </Text>

          <View style={styles.actions}>
            <PressableScale style={styles.primaryBtn} onPress={onYes}>
              <Text style={styles.primaryText}>Download for offline</Text>
            </PressableScale>

            <PressableScale style={styles.secondaryBtn} onPress={onNo}>
              <Text style={styles.secondaryText}>Not now</Text>
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
    backgroundColor: 'rgba(6,53,40,0.55)',
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
  titleArabic: {
    fontFamily: fonts.arabic,
    color: colors.primaryDark,
    fontSize: 26,
    lineHeight: 44,
    writingDirection: 'rtl',
  },
  title: {
    fontFamily: fonts.serif,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 18,
  },
  actions: { alignSelf: 'stretch', width: '100%' },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    ...shadow.soft,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
});
