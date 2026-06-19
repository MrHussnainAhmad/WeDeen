import { useCallback, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colors, radius } from '@/theme/colors';
import { PressableScale } from '@/components/Anim';
import {
  getSalahFocusPermissionStatus,
  openSalahFocusOverlaySettings,
  openSalahFocusUsageStatsSettings,
} from '@/services/salahFocusNative';

type PermKey = 'overlay' | 'usageStats' | 'notifications';

type PermRow = {
  key: PermKey;
  title: string;
  description: string;
  guide: string;
  icon: keyof typeof Ionicons.glyphMap;
  open: () => void;
};

const PERMISSION_ROWS: PermRow[] = [
  {
    key: 'overlay',
    title: 'Display over other apps',
    description: 'Shows the WeDeen pause screen when a blocked app opens.',
    guide: 'Settings → WeDeen → turn on “Allow display over other apps”.',
    icon: 'layers-outline',
    open: openSalahFocusOverlaySettings,
  },
  {
    key: 'usageStats',
    title: 'Usage access',
    description: 'Detects which app is on screen so Prayer Lock can pause it.',
    guide: 'Usage access → find WeDeen → turn on “Permit usage access”.',
    icon: 'stats-chart-outline',
    open: openSalahFocusUsageStatsSettings,
  },
  {
    key: 'notifications',
    title: 'Notifications',
    description: 'Gentle alerts when Prayer Lock is active (Android 13+).',
    guide: 'App info → Notifications → allow WeDeen notifications.',
    icon: 'notifications-outline',
    open: () => {
      Linking.openSettings().catch(() => undefined);
    },
  },
];

export function SalahFocusPermissionsCard() {
  const [status, setStatus] = useState({
    overlay: false,
    usageStats: false,
    notifications: false,
    allGranted: false,
    supported: false,
  });

  const refresh = useCallback(() => {
    getSalahFocusPermissionStatus()
      .then((perms) => {
        setStatus({
          supported: perms.supported,
          allGranted: perms.allGranted,
          overlay: !!perms.overlay,
          usageStats: !!perms.usageStats,
          notifications: !!perms.notifications,
        });
      })
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (next) => {
        if (next === 'active') refresh();
      });
      return () => sub.remove();
    }, [refresh])
  );

  if (!status.supported) return null;

  const grantedCount = [status.overlay, status.usageStats, status.notifications].filter(Boolean).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {status.allGranted
            ? 'All permissions granted'
            : `${grantedCount} of 3 permissions granted`}
        </Text>
        {status.allGranted ? (
          <View style={styles.badgeOk}>
            <Ionicons name="checkmark-circle" size={14} color={colors.primaryDeep} />
            <Text style={styles.badgeOkText}>Ready</Text>
          </View>
        ) : (
          <View style={styles.badgePending}>
            <Text style={styles.badgePendingText}>Action needed</Text>
          </View>
        )}
      </View>

      <Text style={styles.lead}>
        Grant each permission below — open one setting at a time, enable WeDeen, then come back
        here. We never read your messages or screen content.
      </Text>

      {PERMISSION_ROWS.map((row, index) => {
        const granted = status[row.key];
        return (
          <View
            key={row.key}
            style={[styles.permCard, index < PERMISSION_ROWS.length - 1 && styles.permCardGap]}
          >
            <View style={styles.permHeader}>
              <View style={[styles.iconChip, granted && styles.iconChipOk]}>
                <Ionicons name={row.icon} size={18} color={granted ? colors.primaryDeep : colors.primary} />
              </View>
              <View style={styles.permTitleBlock}>
                <Text style={styles.permTitle}>{row.title}</Text>
                <Text style={styles.permDesc}>{row.description}</Text>
              </View>
              <View style={[styles.statusPill, granted ? styles.statusOk : styles.statusOff]}>
                <Ionicons
                  name={granted ? 'checkmark' : 'ellipse-outline'}
                  size={12}
                  color={granted ? colors.primaryDeep : colors.muted}
                />
                <Text style={[styles.statusText, granted && styles.statusTextOk]}>
                  {granted ? 'On' : 'Off'}
                </Text>
              </View>
            </View>

            {!granted ? (
              <>
                <View style={styles.guideBox}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
                  <Text style={styles.guideText}>{row.guide}</Text>
                </View>
                <PressableScale onPress={row.open} style={styles.openBtn}>
                  <Ionicons name="open-outline" size={15} color="#fff" />
                  <Text style={styles.openBtnText}>Open {row.title} settings</Text>
                </PressableScale>
              </>
            ) : null}
          </View>
        );
      })}

      {Platform.OS === 'android' ? (
        <Text style={styles.footnote}>
          Tip: after enabling a permission, press Back to return to WeDeen — the status updates
          automatically.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryText: { color: colors.text, fontWeight: '700', fontSize: 13.5, flex: 1 },
  badgeOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  badgeOkText: { color: colors.primaryDeep, fontWeight: '800', fontSize: 11.5 },
  badgePending: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  badgePendingText: { color: colors.goldDeep, fontWeight: '800', fontSize: 11.5 },
  lead: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  permCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    padding: 12,
  },
  permCardGap: { marginBottom: 0 },
  permHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
  },
  iconChipOk: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldBorder,
  },
  permTitleBlock: { flex: 1, paddingRight: 4 },
  permTitle: { color: colors.text, fontWeight: '800', fontSize: 13.5 },
  permDesc: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statusOk: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryTint,
  },
  statusOff: {
    backgroundColor: '#fff',
    borderColor: colors.border,
  },
  statusText: { color: colors.muted, fontWeight: '800', fontSize: 11 },
  statusTextOk: { color: colors.primaryDeep },
  guideBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 10,
  },
  guideText: { flex: 1, color: colors.primaryDeep, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  openBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 11,
  },
  openBtnText: { color: '#fff', fontWeight: '800', fontSize: 12.5 },
  footnote: {
    color: colors.faint,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 2,
  },
});
