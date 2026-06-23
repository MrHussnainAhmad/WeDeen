export interface TajweedSpan {
  text: string;
  rule?: string;
  meta?: string;
}

const WHITESPACE_RE = /\s/;
const MUTED_RULES = new Set(['h', 's', 'l']);

function chooseDisplayRule(spans: TajweedSpan[]): TajweedSpan | undefined {
  return spans.find((span) => span.rule && !MUTED_RULES.has(span.rule)) ?? spans.find((span) => span.rule);
}

function pushWordSpan(output: TajweedSpan[], wordParts: TajweedSpan[]) {
  if (!wordParts.length) return;
  const displayRule = chooseDisplayRule(wordParts);
  output.push({
    text: wordParts.map((part) => part.text).join(''),
    rule: displayRule?.rule,
    meta: displayRule?.meta,
  });
}

function groupByDisplayWords(spans: TajweedSpan[]): TajweedSpan[] {
  const output: TajweedSpan[] = [];
  let wordParts: TajweedSpan[] = [];

  for (const span of spans) {
    let currentText = '';

    for (const char of span.text) {
      if (WHITESPACE_RE.test(char)) {
        if (currentText) {
          wordParts.push({ ...span, text: currentText });
          currentText = '';
        }
        pushWordSpan(output, wordParts);
        wordParts = [];
        output.push({ text: char });
      } else {
        currentText += char;
      }
    }

    if (currentText) {
      wordParts.push({ ...span, text: currentText });
    }
  }

  pushWordSpan(output, wordParts);
  return output;
}

/**
 * Parses Tajweed annotated text from the AlQuran.cloud API `quran-tajweed` edition.
 *
 * The API format uses single-bracket-close tags:
 *   `[rule:meta[text]`  — e.g. `[h:1[ٱ]`
 *   `[rule[text]`       — e.g. `[l[ل]` or `[n[ـٰ]`
 *
 * Tags can appear adjacent to each other: `[h:2[ٱ][l[ل]`
 * Plain text (not wrapped in tags) appears between or around tags.
 *
 * This parser walks the string character-by-character to handle the
 * single-close-bracket format correctly. React Native can break Arabic
 * shaping when a word is split into many nested colored Text spans, so
 * display spans are grouped by full words after the tags are parsed.
 */
export function parseTajweed(text: string): TajweedSpan[] {
  if (!text) return [];

  const spans: TajweedSpan[] = [];
  let i = 0;
  const len = text.length;
  let plainStart = 0;

  while (i < len) {
    if (text[i] === '[') {
      // Flush any accumulated plain text before this tag
      if (i > plainStart) {
        spans.push({ text: text.substring(plainStart, i) });
      }

      // Parse the tag: [rule:meta[content] or [rule[content]
      const tagStart = i;
      i++; // skip opening '['

      // Read rule name (lowercase letters)
      let rule = '';
      while (i < len && text[i] >= 'a' && text[i] <= 'z') {
        rule += text[i];
        i++;
      }

      // Optionally read :meta
      let meta: string | undefined;
      if (i < len && text[i] === ':') {
        i++; // skip ':'
        meta = '';
        while (i < len && text[i] !== '[') {
          meta += text[i];
          i++;
        }
      }

      // Now expect '[' to open the content
      if (i < len && text[i] === '[') {
        i++; // skip inner '['

        // Read content until ']'
        let content = '';
        while (i < len && text[i] !== ']') {
          content += text[i];
          i++;
        }

        if (i < len && text[i] === ']') {
          i++; // skip closing ']'
        }

        spans.push({
          text: content,
          rule: rule || undefined,
          meta,
        });
      } else {
        // Malformed tag — just output everything from tagStart as plain text
        spans.push({ text: text.substring(tagStart, i) });
      }

      plainStart = i;
    } else {
      i++;
    }
  }

  // Flush remaining plain text
  if (plainStart < len) {
    spans.push({ text: text.substring(plainStart) });
  }

  return groupByDisplayWords(spans);
}

/**
 * Strips all Tajweed tags from the string, returning the raw Arabic text.
 * Handles the single-bracket-close format: `[rule:meta[text]` → `text`
 */
export function stripTajweedTags(text: string): string {
  if (!text) return '';
  // Match [rule:meta[content] or [rule[content] and replace with just content
  return text.replace(/\[[a-z]+(?::[^\[\]]+)?\[([^\]]*)\]/g, '$1');
}

/**
 * Matches a Tajweed rule code to its respective color hex.
 * Rich and contrasting colors in light mode, pastels in dark mode.
 */
export function getTajweedColor(rule: string, isDarkMode: boolean): string {
  if (isDarkMode) {
    switch (rule) {
      case 'h': // Hamzat ul Wasl
      case 's': // Silent
      case 'l': // Lam Shamsiyyah
        return '#667085'; // soft gray
      case 'n': // Madda Normal
        return '#90CDF4'; // soft blue
      case 'p': // Madda Permissible
        return '#63B3ED'; // medium soft blue
      case 'm': // Madda Necessary
        return '#4299E1'; // deep soft blue
      case 'q': // Qalaqah
        return '#FEB2B2'; // soft red/pink
      case 'o': // Madda Obligatory
        return '#FBD38D'; // soft orange
      case 'c': // Ikhafa Shafawi
      case 'f': // Ikhafa
        return '#D6BCFA'; // soft purple
      case 'w': // Idgham Shafawi
      case 'a': // Idgham w/ Ghunnah
      case 'd': // Idgham Mutajanisayn
      case 'b': // Idgham Mutaqaribayn
        return '#9AE6B4'; // soft green
      case 'i': // Iqlab
        return '#F6E05E'; // soft gold/yellow
      case 'u': // Idgham w/o Ghunnah
        return '#F6AD55'; // soft brown/orange
      case 'g': // Ghunnah
        return '#FBB6CE'; // soft pink
      default:
        return '#E8F0EB'; // fallback normal text color
    }
  } else {
    // Light Mode
    switch (rule) {
      case 'h': // Hamzat ul Wasl
      case 's': // Silent
      case 'l': // Lam Shamsiyyah
        return '#98A2B3'; // light gray
      case 'n': // Madda Normal
        return '#3182CE'; // rich blue
      case 'p': // Madda Permissible
        return '#2B6CB0'; // medium rich blue
      case 'm': // Madda Necessary
        return '#1A365D'; // deep blue
      case 'q': // Qalaqah
        return '#E53E3E'; // rich red
      case 'o': // Madda Obligatory
        return '#DD6B20'; // orange
      case 'c': // Ikhafa Shafawi
      case 'f': // Ikhafa
        return '#805AD5'; // purple
      case 'w': // Idgham Shafawi
      case 'a': // Idgham w/ Ghunnah
      case 'd': // Idgham Mutajanisayn
      case 'b': // Idgham Mutaqaribayn
        return '#38A169'; // rich green
      case 'i': // Iqlab
        return '#B7791F'; // rich gold/mustard
      case 'u': // Idgham w/o Ghunnah
        return '#9C4221'; // brown
      case 'g': // Ghunnah
        return '#D53F8C'; // rich deep pink
      default:
        return '#1B2A23'; // fallback normal text color
    }
  }
}
