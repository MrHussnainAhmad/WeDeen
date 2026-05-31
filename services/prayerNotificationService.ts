import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRAYER_NOTIFICATION_IDS_KEY = 'prayer_notification_ids_v1';
const PRAYER_NOTIFICATION_SIGNATURE_KEY = 'prayer_notification_signature_v1';
const PRAYER_CHANNEL_ID = 'prayer-adhan';

type PrayerEntry = { label: string; time: string };

type ExpoNotifications = typeof import('expo-notifications');
let notificationsModule: ExpoNotifications | null = null;

async function getNotifications() {
  if (Constants.appOwnership === 'expo') return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }
  return notificationsModule;
}

function parsePrayerDate(timeHHmm: string, day = new Date()) {
  const [h, m] = (timeHHmm || '').split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export async function ensurePrayerNotificationPermission() {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const req = await Notifications.requestPermissionsAsync();
  return !!(req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

export async function configurePrayerNotificationChannel() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PRAYER_CHANNEL_ID, {
    name: 'Prayer Alerts',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'adhan_alert.m4a',
  });
}

async function clearPreviouslyScheduledPrayerNotifications() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const raw = await AsyncStorage.getItem(PRAYER_NOTIFICATION_IDS_KEY);
  const ids = raw ? (JSON.parse(raw) as string[]) : [];
  if (ids.length) {
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  }
  await AsyncStorage.removeItem(PRAYER_NOTIFICATION_IDS_KEY);
}

export async function schedulePrayerNotificationsForToday(prayers: PrayerEntry[]) {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const granted = await ensurePrayerNotificationPermission();
  if (!granted) return false;

  const signatureDate = new Date();
  signatureDate.setHours(0, 0, 0, 0);
  const signature = JSON.stringify({
    day: signatureDate.toISOString(),
    prayers: prayers.map((p) => ({ label: p.label, time: p.time })),
  });
  const previousSignature = await AsyncStorage.getItem(PRAYER_NOTIFICATION_SIGNATURE_KEY);
  if (previousSignature === signature) {
    return true;
  }

  await configurePrayerNotificationChannel();
  await clearPreviouslyScheduledPrayerNotifications();

  const now = new Date();
  const ids: string[] = [];

  for (const prayer of prayers) {
    if (!prayer.time || prayer.time === '--:--') continue;
    const target = parsePrayerDate(prayer.time, now);
    if (target.getTime() <= now.getTime()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Adhan Time: ${prayer.label}`,
        body: `It's time for ${prayer.label} prayer.`,
        sound: 'adhan_alert.m4a',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
        channelId: PRAYER_CHANNEL_ID,
      },
    });
    ids.push(id);
  }

  await AsyncStorage.setItem(PRAYER_NOTIFICATION_IDS_KEY, JSON.stringify(ids));
  await AsyncStorage.setItem(PRAYER_NOTIFICATION_SIGNATURE_KEY, signature);
  return true;
}

