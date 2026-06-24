import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ensurePrayerNotificationPermission } from './prayerNotificationService';

export type HijriCalendarDay = {
  hijri?: {
    day?: string;
    year?: string;
    month?: { number?: number; en?: string };
  };
  gregorian?: {
    date?: string;
    day?: string;
    year?: string;
    month?: { en?: string; number?: number };
    weekday?: { en?: string };
  };
};

export type IslamicEvent = {
  id: string;
  title: string;
  hijriMonth: number;
  hijriDay: number;
  type: 'fasting' | 'eid' | 'ramadan' | 'knowledge' | 'worship';
  description: string;
  dua?: string;
};

const HIJRI_CACHE_PREFIX = 'hijri_month_calendar_v1_';
const ISLAMIC_EVENT_NOTIFICATION_IDS_KEY = 'islamic_event_notification_ids_v1';
const ISLAMIC_EVENT_NOTIFICATION_SIGNATURE_KEY = 'islamic_event_notification_signature_v1';

export const ISLAMIC_EVENTS: IslamicEvent[] = [
  {
    id: 'islamic-new-year',
    title: 'Islamic New Year',
    hijriMonth: 1,
    hijriDay: 1,
    type: 'knowledge',
    description: 'The first day of Muharram and the beginning of a new Hijri year.',
    dua: 'Reflect on the Hijrah, renew intentions, and begin the year with worship and gratitude.',
  },
  {
    id: 'tasua',
    title: '9 Muharram',
    hijriMonth: 1,
    hijriDay: 9,
    type: 'fasting',
    description: 'The day before Ashura. Many users fast on the 9th and 10th of Muharram.',
    dua: 'Prepare for Ashura with fasting, repentance, charity, and remembrance.',
  },
  {
    id: 'ashura',
    title: 'Ashura Day',
    hijriMonth: 1,
    hijriDay: 10,
    type: 'fasting',
    description: 'A blessed day in Muharram. Many users fast on this day and the day before or after.',
    dua: 'Use the day for repentance, fasting, charity, and extra remembrance.',
  },
  {
    id: 'mawlid',
    title: 'Birthday of Prophet (PBUH)',
    hijriMonth: 3,
    hijriDay: 12,
    type: 'knowledge',
    description: '12 Rabi al-Awwal. A reminder to send salawat and revisit the Seerah of Prophet Muhammad (PBUH).',
    dua: 'Increase salawat, learn from the Seerah, and renew love for the Messenger of Allah (PBUH).',
  },
  {
    id: 'isra-miraj',
    title: 'Isra and Miraj',
    hijriMonth: 7,
    hijriDay: 27,
    type: 'knowledge',
    description: 'A night associated with the miraculous journey and the gift of Salah.',
  },
  {
    id: 'nisf-shaban',
    title: 'Mid-Shaaban',
    hijriMonth: 8,
    hijriDay: 15,
    type: 'worship',
    description: 'A reminder to prepare spiritually before Ramadan with repentance and sincere dua.',
  },
  {
    id: 'ramadan-start',
    title: 'Ramadan Begins',
    hijriMonth: 9,
    hijriDay: 1,
    type: 'ramadan',
    description: 'The first day of Ramadan fasting, Quran, charity, and renewed worship.',
    dua: 'Allahumma ballighna Ramadan and accept our fasting and standing.',
  },
  {
    id: 'ramadan-last-ten',
    title: 'Last Ten Nights of Ramadan',
    hijriMonth: 9,
    hijriDay: 21,
    type: 'worship',
    description: 'The last ten nights of Ramadan begin. Increase Quran, dua, charity, and night prayer.',
    dua: 'Seek Laylatul Qadr often with: Allahumma innaka afuwwun tuhibbul afwa fafu anni.',
  },
  {
    id: 'laylatul-qadr',
    title: 'Laylatul Qadr',
    hijriMonth: 9,
    hijriDay: 27,
    type: 'worship',
    description: 'One of the last ten nights of Ramadan. Seek it especially on odd nights.',
    dua: 'Allahumma innaka afuwwun tuhibbul afwa fafu anni.',
  },
  {
    id: 'eid-fitr',
    title: 'Eid al-Fitr',
    hijriMonth: 10,
    hijriDay: 1,
    type: 'eid',
    description: 'A day of gratitude after Ramadan. Remember Zakat al-Fitr before Eid prayer.',
  },
  {
    id: 'shawwal-six',
    title: 'Six Days of Shawwal',
    hijriMonth: 10,
    hijriDay: 2,
    type: 'fasting',
    description: 'A reminder to begin the optional six fasts of Shawwal after Eid al-Fitr.',
    dua: 'Plan gentle, consistent fasting days during Shawwal if you are able.',
  },
  {
    id: 'dhul-hijjah-start',
    title: 'First Ten Days of Dhul Hijjah',
    hijriMonth: 12,
    hijriDay: 1,
    type: 'worship',
    description: 'The blessed first ten days of Dhul Hijjah begin. Increase dhikr, fasting, charity, and good deeds.',
    dua: 'Increase tahleel, takbeer, tahmeed, dua, and sincere repentance.',
  },
  {
    id: 'tarwiyah',
    title: 'Day of Tarwiyah',
    hijriMonth: 12,
    hijriDay: 8,
    type: 'worship',
    description: 'The 8th of Dhul Hijjah and the beginning of key Hajj rites.',
  },
  {
    id: 'arafah',
    title: 'Day of Arafah',
    hijriMonth: 12,
    hijriDay: 9,
    type: 'fasting',
    description: 'A deeply blessed day for dua and fasting for those not performing Hajj.',
    dua: 'Increase in la ilaha illa Allah, dua, and sincere repentance.',
  },
  {
    id: 'eid-adha',
    title: 'Eid al-Adha',
    hijriMonth: 12,
    hijriDay: 10,
    type: 'eid',
    description: 'The day of sacrifice, gratitude, Eid prayer, and remembering Ibrahim عليه السلام.',
  },
  {
    id: 'tashreeq-start',
    title: 'Days of Tashreeq Begin',
    hijriMonth: 12,
    hijriDay: 11,
    type: 'worship',
    description: 'The Days of Tashreeq begin. Continue takbeer, gratitude, and remembrance after Eid al-Adha.',
  },
];

function cacheKey(month: number, year: number) {
  return `${HIJRI_CACHE_PREFIX}${year}_${month}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseGregorianApiDate(date?: string | null) {
  if (!date) return null;
  const [day, month, year] = date.split('-').map((part) => Number(part));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function nextHijriMonth(month: number, year: number) {
  if (month >= 12) return { month: 1, year: year + 1 };
  return { month: month + 1, year };
}

export function getIslamicEventsForMonth(month: number) {
  return ISLAMIC_EVENTS.filter((event) => event.hijriMonth === month).sort(
    (a, b) => a.hijriDay - b.hijriDay
  );
}

export function getIslamicEventForDay(month: number, day: number) {
  return ISLAMIC_EVENTS.find((event) => event.hijriMonth === month && event.hijriDay === day) ?? null;
}

export async function getHijriMonthCalendar(month: number, year: number): Promise<HijriCalendarDay[]> {
  try {
    const res = await fetch(`https://api.aladhan.com/v1/hToGCalendar/${month}/${year}`);
    const json = await res.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    if (data.length) {
      await AsyncStorage.setItem(cacheKey(month, year), JSON.stringify(data));
      return data;
    }
  } catch {
    // fall back to cache below
  }

  const cached = await AsyncStorage.getItem(cacheKey(month, year));
  if (!cached) return [];
  try {
    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function convertGregorianToHijri(date: Date) {
  const query = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${query}`);
  const json = await res.json();
  return json?.data ?? null;
}

export async function convertHijriToGregorian(day: number, month: number, year: number) {
  const res = await fetch(`https://api.aladhan.com/v1/hToG?date=${day}-${month}-${year}`);
  const json = await res.json();
  return json?.data ?? null;
}

export function moonSightingNote(monthName?: string) {
  return `Hijri dates for ${monthName || 'this month'} are calculated estimates. Local moon sighting can shift Islamic dates by one day, so confirm Ramadan and Eid dates with your local scholars or mosque.`;
}

export async function scheduleIslamicEventReminder(event: IslamicEvent, date: Date) {
  const granted = await ensurePrayerNotificationPermission();
  if (!granted) return null;

  const fireAt = new Date(date);
  fireAt.setHours(9, 0, 0, 0);
  if (fireAt.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: event.title,
      body: event.description,
      sound: true,
      data: { type: 'islamic_event', eventId: event.id, fireAt: fireAt.getTime() },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
    },
  });
  return id;
}

export async function scheduleUpcomingIslamicEventReminders(monthsAhead = 13) {
  const granted = await ensurePrayerNotificationPermission();
  if (!granted) return false;

  const today = new Date();
  const todayHijri = await convertGregorianToHijri(today).catch(() => null);
  const startMonth = Number(todayHijri?.hijri?.month?.number);
  const startYear = Number(todayHijri?.hijri?.year);
  if (!Number.isFinite(startMonth) || !Number.isFinite(startYear)) return false;

  const signature = JSON.stringify({
    startMonth,
    startYear,
    monthsAhead,
    events: ISLAMIC_EVENTS.map((event) => `${event.id}:${event.hijriMonth}:${event.hijriDay}`),
  });
  const previousSignature = await AsyncStorage.getItem(ISLAMIC_EVENT_NOTIFICATION_SIGNATURE_KEY);
  if (previousSignature === signature) return true;

  const oldIdsRaw = await AsyncStorage.getItem(ISLAMIC_EVENT_NOTIFICATION_IDS_KEY);
  if (oldIdsRaw) {
    try {
      const oldIds = JSON.parse(oldIdsRaw);
      if (Array.isArray(oldIds)) {
        await Promise.all(
          oldIds.map((id) => Notifications.cancelScheduledNotificationAsync(String(id)).catch(() => undefined))
        );
      }
    } catch {
      // Ignore malformed stored ids and replace them below.
    }
  }

  const scheduledIds: string[] = [];
  let cursor = { month: startMonth, year: startYear };

  for (let i = 0; i < monthsAhead; i += 1) {
    const events = getIslamicEventsForMonth(cursor.month);
    for (const event of events) {
      const converted = await convertHijriToGregorian(event.hijriDay, event.hijriMonth, cursor.year).catch(() => null);
      const gregorianDate = parseGregorianApiDate(converted?.gregorian?.date);
      if (!gregorianDate) continue;
      const id = await scheduleIslamicEventReminder(event, gregorianDate).catch(() => null);
      if (id) scheduledIds.push(id);
    }
    cursor = nextHijriMonth(cursor.month, cursor.year);
  }

  await AsyncStorage.setItem(ISLAMIC_EVENT_NOTIFICATION_IDS_KEY, JSON.stringify(scheduledIds));
  await AsyncStorage.setItem(ISLAMIC_EVENT_NOTIFICATION_SIGNATURE_KEY, signature);
  return scheduledIds.length > 0;
}
