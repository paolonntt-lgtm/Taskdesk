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

export type ClientNoteMonthTagResult = {
  body: string;
  monthOverride: string | null;
};

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

export function parseClientNoteMonthTag(
  text: string,
  now = new Date(),
): ClientNoteMonthTagResult {
  for (const match of text.matchAll(/#([a-zA-Z\u00C0-\u024F]+)(\d{2,4})?/gi)) {
    const month = MONTHS[match[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
    if (!month) continue;

    const year = match[2]
      ? match[2].length === 2 ? `20${match[2]}` : match[2]
      : new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", year: "numeric" }).format(now);
    const body = text
      .replace(match[0], "")
      .replace(/^\s*[:,-]\s*/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return {
      body,
      monthOverride: `${year}-${String(month).padStart(2, "0")}`,
    };
  }
  return { body: text.trim(), monthOverride: null };
}

export function formatClientNoteMonth(monthOverride: string, language: string): string {
  const date = new Date(`${monthOverride}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat(language === "it" ? "it-IT" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
