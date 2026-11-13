const MONTHS: Record<string, number> = {
  gennaio: 1, january: 1, janvier: 1, enero: 1, januar: 1, janeiro: 1, jan: 1, gen: 1,
  febbraio: 2, february: 2, fevrier: 2, febrero: 2, februar: 2, fevereiro: 2, feb: 2,
  marzo: 3, march: 3, mars: 3, marz: 3, marco: 3, mar: 3,
  aprile: 4, april: 4, avril: 4, abril: 4, apr: 4,
  maggio: 5, may: 5, mai: 5, mayo: 5, maio: 5, mag: 5,
  giugno: 6, june: 6, juin: 6, junio: 6, juni: 6, junho: 6, jun: 6, giu: 6,
  luglio: 7, july: 7, juillet: 7, julio: 7, juli: 7, julho: 7, jul: 7, lug: 7,
  agosto: 8, august: 8, aout: 8, aug: 8, ago: 8,
  settembre: 9, september: 9, septembre: 9, septiembre: 9, setembro: 9, sep: 9, sept: 9, set: 9,
  ottobre: 10, october: 10, octobre: 10, octubre: 10, oktober: 10, outubro: 10, oct: 10, ott: 10,
  novembre: 11, november: 11, noviembre: 11, novembro: 11, nov: 11,
  dicembre: 12, december: 12, decembre: 12, diciembre: 12, dezember: 12, dezembro: 12, dec: 12, dic: 12,
};

export type ClientNoteDeclarative = {
  id: string;
  name: string;
  alias: string;
};

export type ClientNoteTagResult = {
  body: string;
  monthOverride: string | null;
  categories: string[];
};

export type ClientNoteTagError = { badMonth: string };

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function levenshtein(a: string, b: string): number {
  const distances = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) distances[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      distances[i][j] = a[i - 1] === b[j - 1]
        ? distances[i - 1][j - 1]
        : 1 + Math.min(distances[i - 1][j], distances[i][j - 1], distances[i - 1][j - 1]);
    }
  }
  return distances[a.length][b.length];
}

function fuzzyMatchMonth(raw: string): number | null {
  const key = normalize(raw);
  if (MONTHS[key]) return MONTHS[key];
  const threshold = Math.max(2, Math.floor(key.length / 3));
  let bestMonth: number | null = null;
  let bestDistance = Infinity;
  for (const [name, month] of Object.entries(MONTHS)) {
    const candidate = normalize(name);
    if (Math.abs(candidate.length - key.length) > threshold + 1) continue;
    const distance = levenshtein(key, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMonth = month;
    }
  }
  return bestDistance <= threshold ? bestMonth : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMonthTag(text: string, now: Date): { body: string; monthOverride: string } | { badMonth: string } | null {
  for (const match of text.matchAll(/#([a-zA-Z\u00C0-\u024F]+)(\d{2,4})?/gi)) {
    if (normalize(match[1]) === "cu") continue;
    const month = fuzzyMatchMonth(match[1]);
    if (!month) {
      if (match[2]) return { badMonth: match[1] };
      continue;
    }
    const year = match[2]
      ? match[2].length === 2 ? `20${match[2]}` : match[2]
      : new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", year: "numeric" }).format(now);
    return {
      monthOverride: `${year}-${String(month).padStart(2, "0")}`,
      body: text
        .replace(match[0], "")
        .replace(/^\s*[:,-]\s*/, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    };
  }
  return null;
}

export function hasUnavailableBuiltInClientNoteTag(
  text: string,
  canUseBuiltIns: boolean,
  declaratives: ClientNoteDeclarative[],
): string | null {
  if (canUseBuiltIns) return null;
  for (const match of text.matchAll(/(^|\s)#(770|CU)(\d{2}|\d{4})?(?![\w])/gi)) {
    const baseAlias = `#${match[2]}`.toLowerCase();
    const fullAlias = `${baseAlias}${match[3] ?? ""}`;
    const configured = declaratives.some((item) => {
      const alias = item.alias.toLowerCase();
      return alias === fullAlias || (!!match[3] && alias === baseAlias);
    });
    if (!configured) return `#${match[2]}`;
  }
  return null;
}

export function getClientNoteMonthKey(
  monthOverride: string | null | undefined,
  createdAt: string | Date,
): string {
  if (monthOverride) return monthOverride;
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Could not determine client note month");
  return `${year}-${month}`;
}

export function parseClientNoteTags(
  text: string,
  declaratives: ClientNoteDeclarative[] = [],
  includeBuiltIns = true,
  now = new Date(),
) : ClientNoteTagResult | ClientNoteTagError {
  const tagMatches: Array<{ index: number; length: number; category: string }> = [];
  const currentYear = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Rome",
    year: "2-digit",
  }).format(now);

  if (includeBuiltIns) {
    for (const match of text.matchAll(/(^|\s)#(770|CU)(\d{2}|\d{4})?(?![\w])/gi)) {
      const year = match[3] ? match[3].slice(-2) : currentYear;
      tagMatches.push({
        index: match.index ?? 0,
        length: match[0].length,
        category: `${match[2].toUpperCase()}${year}`,
      });
    }
  }

  for (const declarative of declaratives) {
    const alias = declarative.alias.trim().replace(/^#/, "");
    if (!alias || (includeBuiltIns && /^#?(?:CU|770)$/i.test(alias))) continue;
    const regex = new RegExp(`(^|\\s)#${escapeRegExp(alias)}(?:(\\d{2}|\\d{4}))?(?![\\p{L}\\p{N}_])`, "giu");
    for (const match of text.matchAll(regex)) {
      const year = match[2] ? match[2].slice(-2) : currentYear;
      tagMatches.push({
        index: match.index ?? 0,
        length: match[0].length,
        category: `declarative:${declarative.id}:${year}`,
      });
    }
  }

  const categories = [...new Set(tagMatches.map((match) => match.category))];
  let strippedBody = text;
  const removals = [...new Map(tagMatches.map((match) => [`${match.index}:${match.length}`, match])).values()]
    .sort((a, b) => b.index - a.index);
  for (const match of removals) {
    strippedBody = strippedBody.slice(0, match.index) + strippedBody.slice(match.index + match.length);
  }
  strippedBody = strippedBody
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  const monthResult = parseMonthTag(strippedBody, now);
  if (monthResult && "badMonth" in monthResult) return monthResult;
  return {
    body: monthResult?.body ?? strippedBody,
    monthOverride: monthResult?.monthOverride ?? null,
    categories,
  };
}

export function parseClientNoteMonthTag(
  text: string,
  now = new Date(),
): { body: string; monthOverride: string | null } {
  const result = parseMonthTag(text, now);
  return result && "badMonth" in result
    ? { body: text.trim(), monthOverride: null }
    : result ?? { body: text.trim(), monthOverride: null };
}

export function formatClientNoteMonth(monthOverride: string, language: string): string {
  const date = new Date(`${monthOverride}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat(language === "it" ? "it-IT" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
