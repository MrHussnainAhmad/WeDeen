import { parsePrayerDateTime, getMonthTimings } from './prayerTimingUtils';

export async function testAladhanKey() {
  const date = new Date();
  const location = {
    mode: 'city',
    city: 'London',
    country: 'UK'
  } as any;
  const timings = await getMonthTimings(location, date.getFullYear(), date.getMonth() + 1);
  const key = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
  console.log("Generated Key:", key);
  console.log("Keys in timings:", Object.keys(timings));
  console.log("Value:", timings[key]);
}

testAladhanKey().then(() => console.log('Done')).catch(console.error);
