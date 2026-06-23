import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

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

export const ISLAMIC_EVENTS: IslamicEvent[] = [
  {
    id: 'ashura',
    title: 'Ashura',
    hijriMonth: 1,
    hijriDay: 10,
    type: 'fasting',
    description: 'A blessed day in Muharram. Many users fast on this day and the day before or after.',
    dua: 'Use the day for repentance, fasting, charity, and extra remembrance.',
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
];

function cacheKey(month: number, year: number) {
  return `${HIJRI_CACHE_PREFIX}${year}_${month}`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
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
