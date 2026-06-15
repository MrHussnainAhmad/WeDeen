import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { decryptString, encryptString } from './contentCipher';

// Free, CDN-hosted hadith dataset (fawazahmed0/hadith-api). No key required.
const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';

// On-disk cache for full hadith text so a downloaded book reads fully offline.
// Files are AES-encrypted at rest (see contentCipher) so they are unreadable if
// extracted from the device. The catalog is cached separately in AsyncStorage.
// "_v2" bumps past any plaintext "_v1" cache so it is re-downloaded encrypted.
const HADITH_DIR = `${FileSystem.documentDirectory}hadith/`;
const BOOK_CACHED_PREFIX = 'hadith_book_cached_';
const BOOK_CACHED_SUFFIX = '_v2';

// Canonical display order: the six authentic books, then Muwatta, then the 40-hadith sets.
const ORDER = [
  'bukhari',
  'muslim',
  'abudawud',
  'tirmidhi',
  'nasai',
  'ibnmajah',
  'malik',
  'nawawi',
  'qudsi',
  'dehlawi',
];

// The API ships only English-ish collection names — add Arabic titles for the bilingual UI.
const ARABIC_NAMES: Record<string, string> = {
  bukhari: 'صحيح البخاري',
  muslim: 'صحيح مسلم',
  abudawud: 'سنن أبي داود',
  tirmidhi: 'جامع الترمذي',
  nasai: 'سنن النسائي',
  ibnmajah: 'سنن ابن ماجه',
  malik: 'موطأ مالك',
  nawawi: 'الأربعون النووية',
  qudsi: 'الأربعون القدسية',
  dehlawi: 'الأربعون للدهلوي',
};

export type HadithBook = {
  slug: string;
  name: string;
  arabicName?: string;
  engEdition: string;
  araEdition?: string;
  chapterCount: number; // real (non-empty) sections
  hadithCount: number;
  hasChapters: boolean; // chapterCount > 1 — otherwise we show content directly
};

export type HadithChapter = {
  number: string;
  title: string;
  hadithCount: number;
};

export type HadithGrade = { name: string; grade: string };

export type HadithItem = {
  number: number;
  arabic?: string;
  english: string;
  grades: HadithGrade[];
  reference?: { book: number; hadith: number };
};

type EditionEntry = { name: string; language: string; has_sections: boolean; direction: string };
type EditionsJson = Record<string, { name: string; collection: EditionEntry[] }>;
type SectionDetail = { hadithnumber_first: number; hadithnumber_last: number };
type InfoJson = Record<
  string,
  {
    metadata: {
      name: string;
      sections: Record<string, string>;
      last_hadithnumber: number;
      section_details: Record<string, SectionDetail>;
    };
  }
>;

// ---- Catalog cache -------------------------------------------------------
// editions.json + info.json are small and effectively static, so we cache them
// in AsyncStorage (cache-first) to make book/chapter lists instant and offline.
async function cachedCatalog<T>(key: string, url: string): Promise<T> {
  const storeKey = `hadith_cat_${key}_v1`;
  try {
    const cached = await AsyncStorage.getItem(storeKey);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    // ignore corrupt cache and refetch
  }
  const { data } = await axios.get<T>(url, { timeout: 15000 });
  AsyncStorage.setItem(storeKey, JSON.stringify(data)).catch(() => undefined);
  return data;
}

let catalogPromise: Promise<{ editions: EditionsJson; info: InfoJson }> | null = null;
function getCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      cachedCatalog<EditionsJson>('editions', `${CDN}/editions.json`),
      cachedCatalog<InfoJson>('info', `${CDN}/info.json`),
    ])
      .then(([editions, info]) => ({ editions, info }))
      .catch((e) => {
        catalogPromise = null; // allow retry on next call
        throw e;
      });
  }
  return catalogPromise;
}

function realChapterKeys(sections: Record<string, string>) {
  // Section "0" is an empty placeholder in this dataset — keep only titled sections.
  return Object.keys(sections).filter((k) => sections[k] && sections[k].trim().length > 0);
}

function findEdition(entries: EditionEntry[] | undefined, prefix: string) {
  return entries?.find((c) => c.name.startsWith(prefix));
}

function buildBook(slug: string, editions: EditionsJson, info: InfoJson): HadithBook | null {
  const col = editions[slug];
  const eng = findEdition(col?.collection, 'eng-');
  const meta = info[slug]?.metadata;
  // Require an English edition AND metadata — otherwise it would surface as a
  // phantom book with 0 chapters/hadith if the catalog response is incomplete.
  if (!col || !eng || !meta) return null;
  const ara = findEdition(col.collection, 'ara-');
  const chapterKeys = realChapterKeys(meta.sections);
  return {
    slug,
    name: col.name,
    arabicName: ARABIC_NAMES[slug],
    engEdition: eng.name,
    araEdition: ara?.name,
    chapterCount: chapterKeys.length,
    hadithCount: meta?.last_hadithnumber ?? 0,
    hasChapters: chapterKeys.length > 1,
  };
}

export async function getHadithBooks(): Promise<HadithBook[]> {
  const { editions, info } = await getCatalog();
  const books = Object.keys(editions)
    .map((slug) => buildBook(slug, editions, info))
    .filter((b): b is HadithBook => b !== null);

  books.sort((a, b) => {
    const ia = ORDER.indexOf(a.slug);
    const ib = ORDER.indexOf(b.slug);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return books;
}

export async function getHadithChapters(
  slug: string
): Promise<{ book: HadithBook | null; chapters: HadithChapter[] }> {
  const { editions, info } = await getCatalog();
  const book = buildBook(slug, editions, info);
  const meta = info[slug]?.metadata;
  if (!meta) return { book, chapters: [] };

  const details = meta.section_details || {};
  const chapters: HadithChapter[] = realChapterKeys(meta.sections).map((num) => {
    const d = details[num];
    const count = d ? Math.max(0, d.hadithnumber_last - d.hadithnumber_first + 1) : 0;
    return { number: num, title: meta.sections[num], hadithCount: count };
  });
  return { book, chapters };
}

export async function getHadithSection(
  slug: string,
  sectionNo: string
): Promise<{ title: string; hadiths: HadithItem[] }> {
  // Cache-first: a previously downloaded section reads straight from disk and
  // works fully offline (no catalog/network needed).
  const cached = await readSectionFromFile(slug, sectionNo);
  if (cached) return cached;

  const { editions, info } = await getCatalog();
  const col = editions[slug];
  const eng = findEdition(col?.collection, 'eng-');
  const ara = findEdition(col?.collection, 'ara-');
  const meta = info[slug]?.metadata;
  const title = meta?.sections?.[sectionNo] || col?.name || 'Hadith';

  if (!eng) throw new Error('This collection is not available in English.');

  const engUrl = `${CDN}/editions/${eng.name}/sections/${sectionNo}.min.json`;
  const engRes = await axios.get<{ hadiths: any[] }>(engUrl, { timeout: 20000 });

  // Arabic is best-effort: if it fails we still render the English text.
  const araMap = new Map<number, string>();
  if (ara) {
    try {
      const araUrl = `${CDN}/editions/${ara.name}/sections/${sectionNo}.min.json`;
      const araRes = await axios.get<{ hadiths: any[] }>(araUrl, { timeout: 20000 });
      for (const h of araRes.data?.hadiths ?? []) araMap.set(h.hadithnumber, h.text);
    } catch {
      // English-only fallback
    }
  }

  const hadiths: HadithItem[] = (engRes.data?.hadiths ?? []).map((h) => ({
    number: h.hadithnumber,
    english: h.text,
    arabic: araMap.get(h.hadithnumber),
    grades: Array.isArray(h.grades) ? h.grades : [],
    reference: h.reference,
  }));

  const result = { title, hadiths };
  // Persist so future reads (and offline use) hit disk. Non-fatal on failure.
  await writeSectionToFile(slug, sectionNo, result).catch(() => undefined);
  return result;
}

// ---- Offline book caching ------------------------------------------------
// Section text is stored one JSON file per (book, section) under HADITH_DIR.
// Each book gets a "cached" marker in AsyncStorage once all its sections are
// on disk, so we can tell whether a book / the whole library is offline-ready.

function bookDir(slug: string) {
  return `${HADITH_DIR}${slug}/`;
}

function sectionFilePath(slug: string, sectionNo: string) {
  return `${bookDir(slug)}${sectionNo}.json`;
}

async function readSectionFromFile(
  slug: string,
  sectionNo: string
): Promise<{ title: string; hadiths: HadithItem[] } | null> {
  try {
    const path = sectionFilePath(slug, sectionNo);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const json = await decryptString(raw);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.hadiths)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeSectionToFile(
  slug: string,
  sectionNo: string,
  data: { title: string; hadiths: HadithItem[] }
) {
  const payload = await encryptString(JSON.stringify(data));
  await FileSystem.makeDirectoryAsync(bookDir(slug), { intermediates: true });
  await FileSystem.writeAsStringAsync(sectionFilePath(slug, sectionNo), payload);
}

export async function isBookCached(slug: string): Promise<boolean> {
  const done = await AsyncStorage.getItem(`${BOOK_CACHED_PREFIX}${slug}${BOOK_CACHED_SUFFIX}`);
  return !!done;
}

async function setBookCached(slug: string) {
  await AsyncStorage.setItem(`${BOOK_CACHED_PREFIX}${slug}${BOOK_CACHED_SUFFIX}`, '1');
}

// Prevent the same book caching twice concurrently (e.g. opened while a bulk
// download is already in flight).
const inFlightBooks = new Map<string, Promise<void>>();

// The whole book in one file (all sections, all hadiths). Downloading this once
// is dramatically faster than fetching every section separately.
async function fetchFullEdition(name: string): Promise<{ hadiths: any[] } | null> {
  const { data } = await axios.get<{ hadiths: any[] }>(`${CDN}/editions/${name}.min.json`, {
    timeout: 60000,
  });
  return data;
}

/**
 * Fast path: download the book's full English (+ best-effort Arabic) edition in
 * a single request each, then split it into the same per-section files the
 * reader expects. ~2 requests per book instead of one per section.
 */
async function cacheBookFull(slug: string, onProgress?: (fraction: number) => void) {
  const { editions, info } = await getCatalog();
  const col = editions[slug];
  const eng = findEdition(col?.collection, 'eng-');
  const ara = findEdition(col?.collection, 'ara-');
  const meta = info[slug]?.metadata;
  if (!eng || !meta) throw new Error('NO_FULL_EDITION');

  onProgress?.(0.05);
  const engFull = await fetchFullEdition(eng.name);
  const engHadiths = Array.isArray(engFull?.hadiths) ? engFull!.hadiths : [];
  if (!engHadiths.length) throw new Error('EMPTY_FULL_EDITION');
  onProgress?.(0.5);

  const araMap = new Map<number, string>();
  if (ara) {
    try {
      const araFull = await fetchFullEdition(ara.name);
      for (const h of araFull?.hadiths ?? []) araMap.set(h.hadithnumber, h.text);
    } catch {
      // English-only fallback
    }
  }
  onProgress?.(0.8);

  const realKeys = realChapterKeys(meta.sections);
  const sectionKeys = realKeys.length ? realKeys : ['1'];
  const details = meta.section_details || {};

  for (let i = 0; i < sectionKeys.length; i += 1) {
    const key = sectionKeys[i];
    const d = details[key];
    // Split by the section's hadith-number range; chapter-less books keep all.
    const items: HadithItem[] = engHadiths
      .filter((h) => (d ? h.hadithnumber >= d.hadithnumber_first && h.hadithnumber <= d.hadithnumber_last : true))
      .map((h) => ({
        number: h.hadithnumber,
        english: h.text,
        arabic: araMap.get(h.hadithnumber),
        grades: Array.isArray(h.grades) ? h.grades : [],
        reference: h.reference,
      }));
    const title = meta.sections?.[key] || col?.name || 'Hadith';
    await writeSectionToFile(slug, key, { title, hadiths: items });
    onProgress?.(0.8 + 0.2 * ((i + 1) / sectionKeys.length));
  }
}

// Slow fallback (used only if the full-edition file is unavailable): fetch each
// section individually. getHadithSection persists each to disk.
async function cacheBookBySections(slug: string, onProgress?: (fraction: number) => void) {
  const { chapters } = await getHadithChapters(slug);
  const sections = chapters.length ? chapters.map((c) => c.number) : ['1'];
  for (let i = 0; i < sections.length; i += 1) {
    await getHadithSection(slug, sections[i]);
    onProgress?.((i + 1) / sections.length);
  }
}

/**
 * Download a book's full text to disk for offline reading. Idempotent: returns
 * immediately if already cached. Uses the fast whole-book download, falling back
 * to per-section fetching only if that's unavailable.
 */
export async function cacheBook(slug: string, onProgress?: (fraction: number) => void): Promise<void> {
  if (await isBookCached(slug)) {
    onProgress?.(1);
    return;
  }
  const existing = inFlightBooks.get(slug);
  if (existing) return existing;

  const run = (async () => {
    try {
      await cacheBookFull(slug, onProgress);
    } catch {
      await cacheBookBySections(slug, onProgress);
    }
    await setBookCached(slug);
  })();

  inFlightBooks.set(slug, run);
  try {
    await run;
  } finally {
    inFlightBooks.delete(slug);
  }
}

export async function areAllBooksCached(): Promise<boolean> {
  const books = await getHadithBooks();
  if (!books.length) return false;
  for (const b of books) {
    if (!(await isBookCached(b.slug))) return false;
  }
  return true;
}

// Guard so a full-library download can't run twice at once (boot "Yes" vs the
// inline "Download for offline" button).
let cachingAll = false;

export type HadithCacheProgress = {
  fraction: number; // overall 0..1 across all books (includes within-book progress)
  booksDone: number; // fully completed books
  booksTotal: number;
};

// How many books to download at once. Books are independent, so running a few
// in parallel cuts total wall-clock time without hammering the CDN.
const BOOK_DOWNLOAD_CONCURRENCY = 4;

/**
 * Cache every book for offline use. Non-blocking by design — call without
 * awaiting. Books download a few at a time; a failing book is skipped so the
 * rest still complete. The reported fraction blends each book's own progress.
 */
export async function cacheAllBooksInBackground(
  onProgress?: (p: HadithCacheProgress) => void
): Promise<void> {
  if (cachingAll) return;
  cachingAll = true;
  try {
    const books = await getHadithBooks();
    const total = books.length;
    const fractions = new Array(total).fill(0);

    const report = () => {
      const sum = fractions.reduce((a, b) => a + b, 0);
      onProgress?.({
        fraction: total ? sum / total : 1,
        booksDone: fractions.filter((f) => f >= 1).length,
        booksTotal: total,
      });
    };

    let next = 0;
    const worker = async () => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= total) return;
        try {
          await cacheBook(books[i].slug, (f) => {
            fractions[i] = f;
            report();
          });
        } catch {
          // Skip a failed book; the others still cache.
        }
        fractions[i] = 1;
        report();
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(BOOK_DOWNLOAD_CONCURRENCY, total || 1) }, () => worker())
    );
  } finally {
    cachingAll = false;
  }
}
