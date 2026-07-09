// All keys are stored without diacritics — normalize() strips accents at lookup time.
// Each unique (deduplicated) string is listed once.
export const MONTH_MAP: Record<string, number> = {
  // January
  gennaio: 1, january: 1, janvier: 1, enero: 1, januar: 1, janeiro: 1,
  // February
  febbraio: 2, february: 2, fevrier: 2, febrero: 2, februar: 2, fevereiro: 2,
  // March — marzo shared by IT+ES; marz=DE; mars=FR; marco=PT
  marzo: 3, march: 3, mars: 3, marz: 3, marco: 3,
  // April — abril shared by ES+PT
  aprile: 4, april: 4, avril: 4, abril: 4,
  // May — mai shared by FR+DE; maio=PT
  maggio: 5, may: 5, mai: 5, mayo: 5, maio: 5,
  // June
  giugno: 6, june: 6, juin: 6, junio: 6, juni: 6, junho: 6,
  // July
  luglio: 7, july: 7, juillet: 7, julio: 7, juli: 7, julho: 7,
  // August — agosto shared by IT+ES+PT; august shared by EN+DE
  agosto: 8, august: 8, aout: 8,
  // September
  settembre: 9, september: 9, septembre: 9, septiembre: 9, setembro: 9,
  // October
  ottobre: 10, october: 10, octobre: 10, octubre: 10, oktober: 10, outubro: 10,
  // November — novembre shared by IT+FR; november shared by EN+DE
  novembre: 11, november: 11, noviembre: 11, novembro: 11,
  // December
  dicembre: 12, december: 12, decembre: 12, diciembre: 12, dezember: 12, dezembro: 12,
  // Common abbreviations
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  gen: 1, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, dic: 12,
};

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function fuzzyMatchMonth(raw: string): number | null {
  const key = normalize(raw);

  // Exact match first (on normalized form)
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (normalize(name) === key) return num;
  }

  // Find closest candidate within edit distance threshold
  const unique = new Map<string, number>();
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    unique.set(normalize(name), num);
  }

  let best: number | null = null;
  let bestDist = Infinity;
  const threshold = Math.max(2, Math.floor(key.length / 3));

  for (const [name, num] of unique) {
    if (Math.abs(name.length - key.length) > threshold + 1) continue;
    const d = levenshtein(key, name);
    if (d < bestDist) {
      bestDist = d;
      best = num;
    }
  }

  return bestDist <= threshold ? best : null;
}

export const HASHTAG_REGEX = /#([a-zA-Z\u00C0-\u024F]+)(\d{2,4})/i;

export interface HashtagParseResult {
  monthOverride: string;
  strippedBody: string;
}

export interface HashtagParseError {
  badMonth: string;
}

export function parseHashtag(text: string): HashtagParseResult | HashtagParseError | null {
  const match = HASHTAG_REGEX.exec(text);
  if (!match) return null;

  const monthRaw = match[1];
  const yearRaw = match[2];

  const monthNum = fuzzyMatchMonth(monthRaw);
  if (!monthNum) {
    return { badMonth: monthRaw };
  }

  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const monthStr = String(monthNum).padStart(2, '0');
  const monthOverride = `${year}-${monthStr}`;

  const strippedBody = text.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
  return { monthOverride, strippedBody };
}
