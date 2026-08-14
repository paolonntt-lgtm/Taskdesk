import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { botChatRateLimiter } from "../lib/rateLimiter";
import { db, ticketsTable, knowledgeArticlesTable, ticketCommentsTable, settingsTable, dailyReportsTable, dailyReportReadsTable, ticketActivityLogsTable, usersTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lt, ne, inArray } from "drizzle-orm";
import OpenAI from "openai";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CONTENT_CHARS = 8000;

const router: IRouter = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface ContextResult {
  type: "resolved_ticket" | "open_ticket" | "article";
  id?: number;
  title: string;
  content: string;
  rank: number;
  createdAt?: string;
  priority?: string;
  status?: string;
  category?: string;
  location?: string;
  assignee?: string;
}

interface SearchContextResult {
  resolvedTickets: ContextResult[];
  openTickets: ContextResult[];
  articles: ContextResult[];
}

// Strip common Italian/English stop words and extract meaningful keywords for search
function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    "il","lo","la","i","gli","le","un","uno","una","del","dello","della","dei","degli","delle",
    "al","allo","alla","ai","agli","alle","dal","dallo","dalla","dai","dagli","dalle",
    "nel","nello","nella","nei","negli","nelle","sul","sullo","sulla","sui","sugli","sulle",
    "di","a","da","in","con","su","per","tra","fra","e","o","ma","se","che","chi","cui",
    "non","ho","ha","ho","è","si","mi","ti","ci","vi","lo","la","li","le","ne",
    "the","a","an","is","are","was","were","be","been","have","has","had","do","does","did",
    "not","no","it","i","you","he","she","we","they","and","or","but","if","of","in","on","at",
    "to","for","with","this","that","these","those","my","your","his","her","our","their",
    "dice","dire","viene","vado","sono","ho","avere","fare","può","tutto","anche","già","ancora",
    "come","quando","dove","perché","cosa","quale","quali","questo","questa","questi","queste",
    "molto","sempre","subito","dopo","prima","poi","però","quindi","dunque","allora",
  ]);

  return message
    .toLowerCase()
    .replace(/[^\wàèéìòùáíóú\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .slice(0, 5);
}

async function fetchOrgSettings(orgId: number, base: string): Promise<string[]> {
  const orgKey = `org_${orgId}_${base}`;
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, orgKey));
  const row = rows[0];
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const fetchOrgCategories = (orgId: number) => fetchOrgSettings(orgId, "categories");
const fetchOrgLocations  = (orgId: number) => fetchOrgSettings(orgId, "locations");

async function searchContext(query: string, orgId: number | null, isAdmin: boolean): Promise<SearchContextResult> {
  const empty: SearchContextResult = { resolvedTickets: [], openTickets: [], articles: [] };
  if (!query.trim() || orgId == null) return empty;

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return empty;

  // FTS uses simplified keywords (avoids AND-all-terms mismatch on long messages)
  const ftsQuery = keywords.join(" ");
  // Regex fallback: any ticket containing at least one keyword (case-insensitive)
  const keywordRegex = keywords.join("|");

  // Resolved/closed tickets — note di risoluzione opzionali, usiamo anche i commenti
  const resolvedRows = await db.execute(sql`
    SELECT
      t.id,
      t.title,
      t.description,
      t.resolution_note,
      ts_rank(
        to_tsvector('italian', t.title || ' ' || t.description || ' ' || COALESCE(t.resolution_note, '')),
        plainto_tsquery('italian', ${ftsQuery})
      ) AS rank
    FROM tickets t
    WHERE
      t.organization_id = ${orgId}
      AND t.status IN ('resolved', 'closed')
      AND (
        to_tsvector('italian', t.title || ' ' || t.description || ' ' || COALESCE(t.resolution_note, ''))
        @@ plainto_tsquery('italian', ${ftsQuery})
        OR t.title ~* ${keywordRegex}
        OR t.description ~* ${keywordRegex}
      )
    ORDER BY rank DESC
    LIMIT 3
  `);

  const resolvedTickets: ContextResult[] = [];
  for (const row of resolvedRows.rows as any[]) {
    // Prefer comments marked as solution; fall back to the last 3 comments
    let commentRows = await db
      .select({ commentText: ticketCommentsTable.commentText })
      .from(ticketCommentsTable)
      .where(and(eq(ticketCommentsTable.ticketId, row.id), eq(ticketCommentsTable.isSolution, true)))
      .limit(3);

    if (commentRows.length === 0) {
      // No solution-marked comments — take the 5 most recent to capture resolutions
      // that appear near the end of the thread (not always the very last comment)
      const allComments = await db
        .select({ commentText: ticketCommentsTable.commentText })
        .from(ticketCommentsTable)
        .where(eq(ticketCommentsTable.ticketId, row.id))
        .orderBy(desc(ticketCommentsTable.createdAt))
        .limit(5);
      // Reverse so the context reads chronologically
      commentRows = allComments.reverse();
    }

    const commentText = commentRows.map((c) => c.commentText).join("\n");
    const content = [
      row.description,
      row.resolution_note ? `Soluzione adottata: ${row.resolution_note}` : "",
      commentText ? `Aggiornamenti dal ticket: ${commentText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    resolvedTickets.push({
      type: "resolved_ticket",
      title: row.title,
      content: content.slice(0, 1200),
      rank: Number(row.rank),
    });
  }

  // Open/in-progress tickets on the same topic — shows the issue may already be tracked
  const openRows = await db.execute(sql`
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.category,
      t.location,
      t.created_at,
      u.name AS assignee_name,
      ts_rank(
        to_tsvector('italian', t.title || ' ' || t.description),
        plainto_tsquery('italian', ${ftsQuery})
      ) AS rank
    FROM tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE
      t.organization_id = ${orgId}
      AND t.status NOT IN ('resolved', 'closed')
      AND (
        to_tsvector('italian', t.title || ' ' || t.description)
        @@ plainto_tsquery('italian', ${ftsQuery})
        OR t.title ~* ${keywordRegex}
        OR t.description ~* ${keywordRegex}
      )
    ORDER BY rank DESC
    LIMIT 2
  `);

  const openTickets: ContextResult[] = (openRows.rows as any[]).map((row) => {
    const createdDate = row.created_at
      ? new Date(row.created_at).toLocaleDateString("it-IT")
      : undefined;
    return {
      type: "open_ticket" as const,
      id: Number(row.id),
      title: row.title,
      content: String(row.description ?? "").slice(0, 500),
      rank: Number(row.rank),
      createdAt: createdDate,
      status: row.status ?? undefined,
      priority: row.priority ?? undefined,
      category: row.category ?? undefined,
      location: row.location ?? undefined,
      assignee: row.assignee_name ?? undefined,
    };
  });

  // KB articles — available to all authenticated users of the organization
  const articleRows = await db.execute(sql`
    SELECT
      id,
      title,
      content,
      ts_rank(
        to_tsvector('italian', title || ' ' || content),
        plainto_tsquery('italian', ${ftsQuery})
      ) AS rank
    FROM knowledge_articles
    WHERE
      organization_id = ${orgId}
      AND (
        to_tsvector('italian', title || ' ' || content) @@ plainto_tsquery('italian', ${ftsQuery})
        OR title ~* ${keywordRegex}
        OR content ~* ${keywordRegex}
      )
    ORDER BY rank DESC
    LIMIT 3
  `);

  const articles: ContextResult[] = (articleRows.rows as any[]).map((row) => ({
    type: "article" as const,
    title: row.title,
    content: String(row.content).slice(0, 600),
    rank: Number(row.rank),
  }));

  return { resolvedTickets, openTickets, articles };
}

function buildSystemPrompt(
  ctx: SearchContextResult,
  lang: "it" | "en",
  categories: string[],
  locations: string[],
  userLocation: string | null,
): string {
  const locale = lang === "en" ? "en-GB" : "it-IT";
  const now = new Date().toLocaleDateString(locale);
  const { resolvedTickets, openTickets, articles } = ctx;
  const categoryList = categories.length > 0 ? categories.join(", ") : "—";
  const multiLocation = locations.length > 1 && !userLocation;
  const locationList = locations.join(", ");

  if (lang === "en") {
    let historySection = "";
    if (resolvedTickets.length > 0) {
      historySection += "\n\n--- RESOLVED TICKETS (similar past issues from your company) ---\n";
      historySection += resolvedTickets.map((r, i) =>
        `[R${i + 1}] "${r.title}"\n${r.content}`
      ).join("\n\n");
    }
    if (openTickets.length > 0) {
      historySection += "\n\n--- OPEN TICKETS (currently tracked issues) ---\n";
      historySection += openTickets.map((r, i) => {
        const meta = [
          r.createdAt ? `opened on ${r.createdAt}` : null,
          r.status ? `status: ${r.status}` : null,
          r.priority ? `priority: ${r.priority}` : null,
          r.category ? `category: ${r.category}` : null,
          r.location ? `location: ${r.location}` : null,
          r.assignee ? `assigned to: ${r.assignee}` : null,
        ].filter(Boolean).join(" | ");
        return `[O${i + 1}] ID:${r.id} "${r.title}" (${meta})\nProblem description: ${r.content}`;
      }).join("\n\n");
    }
    if (articles.length > 0) {
      historySection += "\n\n--- KNOWLEDGE BASE ARTICLES ---\n";
      historySection += articles.map((r, i) =>
        `[K${i + 1}] "${r.title}"\n${r.content}`
      ).join("\n\n");
    }
    if (!historySection) {
      historySection = "\n\nNo matching tickets or KB articles found in the company database for this issue.";
    }

    const locationAsk = multiLocation
      ? ` Which location is affected? (${locationList})`
      : "";

    return `You are TaskBot, the AI assistant for TaskDesk internal IT support. Today's date: ${now}.

Help users resolve issues before opening a ticket. Follow these rules strictly:

INTAKE — Always do this first, in strict order:
1. If the user's message is vague (no specific device/symptom/error): ask them to describe the problem clearly — what is happening, which device, any error message.${multiLocation ? ` Also ask which location. Do NOT show solutions yet.` : ""}
2. If the message is specific BUT the location is still unknown and there are multiple locations: ask ONLY for the location in that reply. Do NOT show solutions or historical content until the location is known.
3. Once you have a clear problem description${multiLocation ? " and the location" : ""}, proceed with the rules below.

- If at ANY POINT in the conversation the user says they want to open a ticket right away (e.g. "open a ticket", "open it directly", "create ticket", "yes open it", "1" when options shown): output ONLY this JSON on a single line with no other text, using whatever information has been gathered so far:
{"action":"create_ticket","title":"TITLE","description":"DESCRIPTION","category":"CATEGORY","resource":"RESOURCE","location":"LOCATION"}
- When asking the user multiple diagnostic/follow-up questions, ALWAYS number them (1. 2. 3. …). Never list them as bullet points or prose.
- If RESOLVED TICKETS are found in the context: first verify that the specific component/symptom the user mentioned (e.g. "monitor") actually appears in the historical ticket. If the historical ticket concerns a DIFFERENT component, treat it as "nothing found".
- If the ticket IS relevant: first check the conversation history. If you have ALREADY presented the historical summary in a previous assistant turn, do NOT repeat it — acknowledge the new information the user provided and ask NUMBERED diagnostic questions to dig deeper, or ask directly whether to open a ticket. If this is the FIRST time presenting it: present EACH found resolved ticket as a separate numbered case (Case 1, Case 2, …) with a brief narrative summary of what happened and how it was resolved. Historical tickets are chronicles of real incidents — do NOT format them as numbered steps to try. After listing all cases, end with exactly: "1 - Open a ticket  2 - Need more help  3 - Resolved ✓"
- If OPEN TICKETS are found on the same topic: present the existing ticket with ALL of the following details on separate lines so the operator can clearly assess it — title, opening date, current status, priority, category, location, assignee (if any), and a short summary of the problem description. Then output ONLY this JSON on a single line with no other text after it:
{"action":"view_ticket","id":NUMERIC_ID,"title":"TITLE","date":"DATE"}
- If NO tickets found but KB articles exist: present each article step as a NUMBERED line (1. … 2. …). End with exactly: "1 - No  2 - Already tried  3 - Resolved ✓"
- If NOTHING is found: say you have no historical data, ask the user for more details using NUMBERED questions (1. 2. 3. …).
- If the user replies with "2" or says they need more help: acknowledge briefly and ask for more details using NUMBERED questions.
- If the user replies with "3" or says it is resolved: congratulate them briefly and close.
- If the user provides new information after you have already presented historical context (e.g. "nobody pulled the card", "it always happens like this"): acknowledge the new info in one sentence, do NOT repeat the historical tickets, ask at most 2-3 NUMBERED specific questions to gather further details, and always end with exactly: "1 - Open a ticket  2 - Need more help  3 - Resolved ✓". Do NOT add "Open a ticket" as a numbered question item.

Rules for the JSON fields:
  - title: copy the EXACT device code or identifier from the user's message (e.g. "BTM6", "PC-MARIO"). Do NOT shorten, rephrase or generalise it. Append a 2-3 word symptom summary.
  - description: summarise the CURRENT problem from the whole conversation (what broke, symptoms, when). Do NOT copy solutions, location info, or text from past tickets.
  - category: you MUST choose EXACTLY one value from this list — ${categoryList}. Do NOT invent a new category. Pick the closest match.
  - resource: the PHYSICAL device with the problem (e.g. "printer", "PC", "screen"). Do NOT put asset codes like "BTM6" here — those go in the title. Leave empty string if no physical device is mentioned.
  - location: the location/branch mentioned by the user. MUST be EXACTLY one of these values — ${locationList || ""}. Leave empty string if unknown or not applicable.

Always reply in English. Be concise. Never add steps or advice not grounded in the provided context.${historySection}`;
  }

  // Italian
  let historySection = "";
  if (resolvedTickets.length > 0) {
    historySection += "\n\n--- TICKET RISOLTI (casi simili già gestiti dalla tua azienda) ---\n";
    historySection += resolvedTickets.map((r, i) =>
      `[R${i + 1}] "${r.title}"\n${r.content}`
    ).join("\n\n");
  }
  if (openTickets.length > 0) {
    historySection += "\n\n--- TICKET APERTI (problemi attualmente in gestione) ---\n";
    historySection += openTickets.map((r, i) => {
      const meta = [
        r.createdAt ? `aperto il ${r.createdAt}` : null,
        r.status ? `stato: ${r.status}` : null,
        r.priority ? `priorità: ${r.priority}` : null,
        r.category ? `categoria: ${r.category}` : null,
        r.location ? `sede: ${r.location}` : null,
        r.assignee ? `assegnato a: ${r.assignee}` : null,
      ].filter(Boolean).join(" | ");
      return `[O${i + 1}] ID:${r.id} "${r.title}" (${meta})\nDescrizione problema: ${r.content}`;
    }).join("\n\n");
  }
  if (articles.length > 0) {
    historySection += "\n\n--- ARTICOLI KNOWLEDGE BASE ---\n";
    historySection += articles.map((r, i) =>
      `[K${i + 1}] "${r.title}"\n${r.content}`
    ).join("\n\n");
  }
  if (!historySection) {
    historySection = "\n\nNessun ticket o articolo KB corrispondente trovato nel database aziendale per questo problema.";
  }

  const locationAsk = multiLocation
    ? ` In quale sede si trova il problema? (${locationList})`
    : "";

  return `Sei TaskBot, l'assistente AI di TaskDesk per il supporto IT interno. Data odierna: ${now}.

Aiuta gli utenti a risolvere i problemi prima di aprire un ticket. Segui queste regole in modo rigoroso:

INTAKE — Segui sempre questo ordine:
1. Se il messaggio è vago (nessun dispositivo/sintomo/errore specifico): chiedi di descrivere il problema chiaramente — cosa sta succedendo, quale dispositivo, eventuali errori.${multiLocation ? ` Chiedi anche la sede. NON mostrare ancora soluzioni.` : ""}
2. Se il messaggio è specifico MA la sede non è ancora nota e ci sono più sedi: chiedi SOLO la sede in quella risposta. NON mostrare soluzioni o contenuti storici finché la sede non è nota.
3. Una volta che hai una descrizione chiara${multiLocation ? " e la sede" : ""}, procedi con le regole seguenti.

- Se IN QUALSIASI MOMENTO l'utente dice di voler aprire un ticket subito (es. "apri ticket", "apri direttamente", "crea ticket", "sì apri", "1" quando le opzioni sono mostrate): inserisci SUBITO SOLO questo JSON su una riga, usando le informazioni raccolte finora dalla conversazione:
{"action":"create_ticket","title":"TITOLO","description":"DESCRIZIONE","category":"CATEGORIA","resource":"DISPOSITIVO","location":"SEDE"}
- Quando fai più domande diagnostiche/di approfondimento all'utente, NUMERALE SEMPRE (1. 2. 3. …). Non usare mai elenchi puntati o prosa.
- Se nel contesto ci sono TICKET RISOLTI: verifica prima che il componente/sintomo menzionato dall'utente sia presente nel ticket storico. Se riguarda un componente diverso, trattalo come "nessun dato trovato".
- Se il ticket È pertinente: controlla prima la cronologia della conversazione. Se hai GIÀ presentato il riepilogo storico in un tuo messaggio precedente, NON ripeterlo — riconosci la nuova informazione fornita dall'utente e fai domande NUMERATE per approfondire, oppure chiedi direttamente se aprire un ticket. Se invece è la prima volta che presenti il contesto storico: presenta OGNI ticket risolto trovato come un caso numerato separato (Caso 1, Caso 2, …), ciascuno con una breve sintesi narrativa di cosa è successo e come è stato risolto. I ticket storici sono cronache di incidenti reali — NON formattare il loro contenuto come passi numerati da provare. Dopo aver elencato tutti i casi, concludi con esattamente: "1 - Apri ticket  2 - Ho bisogno di altro  3 - Risolto ✓"
- Se ci sono TICKET APERTI sullo stesso argomento: mostra tutte le informazioni disponibili sul ticket esistente, su righe separate, così l'operatore può valutare con certezza se è lo stesso problema — includi: titolo, data di apertura, stato, priorità, categoria, sede, assegnatario (se presente) e un breve riassunto della descrizione del problema. Poi inserisci SOLO questo JSON su una riga senza altro testo dopo:
{"action":"view_ticket","id":ID_NUMERICO,"title":"TITOLO","date":"DATA"}
- Se NON ci sono ticket ma ci sono articoli KB: presenta ogni passo dell'articolo su una riga NUMERATA (1. … 2. …). Concludi con esattamente: "1 - No  2 - Già provato  3 - Risolto ✓"
- Se NON è stato trovato nulla: di' che non hai dati storici e chiedi all'utente di descrivere meglio il problema con domande NUMERATE (1. 2. 3. …).
- Se l'utente risponde con "2" o chiede altro aiuto: riconosci brevemente e fai domande NUMERATE per raccogliere più dettagli.
- Se l'utente risponde con "3" o dice che è risolto: congratulati brevemente e chiudi.
- Se l'utente fornisce nuove informazioni dopo che hai già presentato il contesto storico (es. "non ho tirato la schedina", "succede sempre così", ecc.): riconosci la nuova info in una frase, NON ripetere i ticket storici, fai al massimo 2-3 domande NUMERATE specifiche per raccogliere altri dettagli, e concludi SEMPRE con esattamente: "1 - Apri ticket  2 - Ho bisogno di altro  3 - Risolto ✓". Non aggiungere "Apri ticket" come voce numerata nelle domande.

Regole per i campi JSON:
  - title: copia ESATTAMENTE il codice o nome del dispositivo dal messaggio dell'utente (es. "BTM6", "PC-MARIO"). NON abbreviare, NON riformulare, NON generalizzare. Aggiungi 2-3 parole sul sintomo.
  - description: sintetizza il problema attuale dall'intera conversazione (cosa non funziona, sintomi, quando). NON copiare soluzioni, info sulla sede o testo dai ticket passati.
  - category: OBBLIGATORIO — scegli ESATTAMENTE un valore da questa lista: ${categoryList}. NON inventare nuove categorie. Scegli quella più vicina al problema.
  - resource: il DISPOSITIVO FISICO con il problema (es. "stampante", "PC", "schermo"). NON mettere qui codici asset come "BTM6" — quelli vanno nel titolo. Stringa vuota se non menzionato un dispositivo fisico specifico.
  - location: la sede menzionata dall'utente nella conversazione. DEVE essere ESATTAMENTE uno di questi valori: ${locationList || ""}. Stringa vuota se non specificata.

Rispondi sempre in italiano. Sii sintetico. Non aggiungere mai passi o consigli non presenti nel contesto fornito.${historySection}`;
}

// ── Daily report / briefing types ────────────────────────────────────────────

interface ActivityTicket {
  id: number;
  ticketNumber?: number | null;
  title: string;
  status: string;
  priority: string;
  category?: string | null;
  actions: string[];
}

interface BriefingReport {
  id: number;
  date: string;
  content: string;
  authorName: string;
}

interface TicketSummary {
  openTickets: number;
  overdueTickets: number;
  urgentTickets: number;
}

interface BriefingContext {
  reports: BriefingReport[];
  ticketSummary: TicketSummary;
}

// ── Report-mode system prompt ─────────────────────────────────────────────────

function buildReportModePrompt(
  userName: string,
  activityToday: ActivityTicket[],
  lang: "it" | "en",
  location?: string | null,
): string {
  const locale = lang === "en" ? "en-GB" : "it-IT";
  const today = new Date().toLocaleDateString(locale);
  const locationLine = location
    ? (lang === "it" ? `Sede: ${location}.` : `Location: ${location}.`)
    : "";

  const ticketList = activityToday.length === 0
    ? (lang === "it" ? "Nessun ticket registrato oggi nel sistema per questa sede." : "No tickets recorded today in the system for this location.")
    : activityToday.map((t, i) => {
        const num = t.ticketNumber ?? t.id;
        const actions = t.actions.join(", ");
        return lang === "it"
          ? `${i + 1}. #${num} — "${t.title}" (${t.status}, ${t.priority}${t.category ? `, ${t.category}` : ""}) — azioni: ${actions}`
          : `${i + 1}. #${num} — "${t.title}" (${t.status}, ${t.priority}${t.category ? `, ${t.category}` : ""}) — actions: ${actions}`;
      }).join("\n");

  if (lang === "en") {
    return `You are TaskBot in END-OF-DAY REPORT mode. Today: ${today}. ${locationLine}

The operator ${userName} is writing their daily report. Here are the tickets they worked on today (from the system activity log):

${ticketList}

Your task:
1. Present this list in a friendly summary format${location ? ` for the ${location} location` : ""}.
2. Ask if they want to add any notes or context not visible in the system (e.g. "customer X will call back tomorrow", "issue resolved but waiting for confirmation").
3. When the operator confirms (says "ok", "publish", "send", "fine", "pubblica", "invia", "sì", "perfetto", or similar): output ONLY this JSON on a single line with no other text:
{"action":"submit_daily_report","content":"FULL_REPORT_TEXT"}

The content field must be a complete, readable report in plain text that includes the location, the ticket list, and any additional notes the operator provided.

Always reply in English.`;
  }

  return `Sei TaskBot in modalità REPORT DI FINE GIORNATA. Data: ${today}. ${locationLine}

L'operatore ${userName} sta scrivendo il report giornaliero${location ? ` per la sede di ${location}` : ""}. Ecco i ticket su cui ha lavorato oggi (dall'activity log di sistema):

${ticketList}

Il tuo compito:
1. Presenta questo elenco in modo amichevole e leggibile${location ? `, indicando la sede (${location})` : ""}.
2. Chiedi se vuole aggiungere note o contesto che non risulta dal sistema (es. "il cliente X richiamerà domani", "problema risolto ma in attesa di conferma").
3. Quando l'operatore conferma (dice "ok", "pubblica", "invia", "sì", "perfetto" o simili): emetti SOLO questo JSON su una riga senza altro testo:
{"action":"submit_daily_report","content":"TESTO_COMPLETO_DEL_REPORT"}

Il campo content deve contenere un report completo e leggibile in testo semplice che includa la sede, l'elenco dei ticket e le note aggiuntive fornite dall'operatore.

Rispondi sempre in italiano.`;
}

// ── Briefing system prompt ─────────────────────────────────────────────────────

function buildBriefingPrompt(
  ctx: BriefingContext,
  userName: string,
  lang: "it" | "en",
): string {
  const locale = lang === "en" ? "en-GB" : "it-IT";
  const today = new Date().toLocaleDateString(locale);
  const { reports, ticketSummary } = ctx;

  const reportsSection = reports.length === 0
    ? (lang === "it" ? "Nessun report di colleghi da leggere." : "No colleague reports to read.")
    : reports.map((r, i) => {
        const date = new Date(r.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
        return lang === "it"
          ? `--- Report di ${r.authorName} (${date}) ---\n${r.content.slice(0, 600)}`
          : `--- Report by ${r.authorName} (${date}) ---\n${r.content.slice(0, 600)}`;
      }).join("\n\n");

  if (lang === "en") {
    return `You are TaskBot in AUTO-BRIEFING mode. Today: ${today}.

${userName} just opened the bot. Deliver a concise morning/shift briefing based on the data below.

=== UNREAD COLLEAGUE REPORTS ===
${reportsSection}

=== CURRENT TICKET SITUATION ===
- Open tickets: ${ticketSummary.openTickets}
- Overdue tickets: ${ticketSummary.overdueTickets}
- Urgent tickets: ${ticketSummary.urgentTickets}

Instructions:
1. Start immediately with the briefing — no preamble.
2. Summarise each colleague report in 1–3 sentences.
3. Mention the ticket situation if there is anything urgent or overdue.
4. End with a short offer to help: "Any questions, or shall I help you with something?"
5. You can answer questions about any of the reports above or about the ticket situation.

Always reply in English.`;
  }

  return `Sei TaskBot in modalità BRIEFING AUTOMATICO. Data: ${today}.

${userName} ha appena aperto il bot. Fornisci un briefing conciso basato sui dati seguenti.

=== REPORT DEI COLLEGHI NON LETTI ===
${reportsSection}

=== SITUAZIONE TICKET ATTUALE ===
- Ticket aperti: ${ticketSummary.openTickets}
- Ticket scaduti: ${ticketSummary.overdueTickets}
- Ticket urgenti: ${ticketSummary.urgentTickets}

Istruzioni:
1. Inizia subito con il briefing — nessun preambolo.
2. Riassumi ogni report del collega in 1–3 frasi.
3. Segnala la situazione ticket se ci sono urgenze o scaduti.
4. Concludi con una breve offerta di aiuto: "Hai domande, o posso aiutarti con qualcosa?"
5. Puoi rispondere a domande su qualunque report sopra o sulla situazione ticket.

Rispondi sempre in italiano.`;
}

/** Fetch a single report by id, validated against the org. */
async function fetchSingleReport(reportId: number, orgId: number): Promise<BriefingReport | null> {
  const rows = await db.execute(sql`
    SELECT dr.id, dr.date::text AS date, SUBSTRING(dr.content FOR 1200) AS content, u.name AS "authorName"
    FROM daily_reports dr
    JOIN users u ON u.id = dr.author_user_id
    WHERE dr.id = ${reportId}
      AND dr.organization_id = ${orgId}
    LIMIT 1
  `);
  const result = rows.rows as unknown as BriefingReport[];
  return result[0] ?? null;
}

/** Prompt for reading one specific colleague report in detail. */
function buildSingleReportBriefingPrompt(
  report: BriefingReport,
  userName: string,
  lang: "it" | "en",
): string {
  const locale = lang === "en" ? "en-GB" : "it-IT";
  const date = new Date(report.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  if (lang === "en") {
    return `You are TaskBot in SINGLE REPORT BRIEFING mode.

${userName} wants to read the daily report written by ${report.authorName} on ${date}.

Report content:
---
${report.content}
---

Instructions:
1. Summarise the report in 2–4 concise sentences highlighting the main points.
2. Call out any notable items (urgent issues, follow-ups needed, blockers).
3. End with: "Any questions about this report?"

Always reply in English.`;
  }

  return `Sei TaskBot in modalità LETTURA REPORT.

${userName} vuole leggere il report giornaliero scritto da ${report.authorName} il ${date}.

Contenuto del report:
---
${report.content}
---

Istruzioni:
1. Riassumi il report in 2–4 frasi concise mettendo in evidenza i punti principali.
2. Segnala eventuali elementi rilevanti (problemi urgenti, follow-up necessari, blocchi).
3. Concludi con: "Hai domande su questo report?"

Rispondi sempre in italiano.`;
}

// ── Historical keyword detection ──────────────────────────────────────────────

const HISTORICAL_KEYWORDS_IT = ["ieri", "settimana scorsa", "settimana fa", "mese scorso", "scorso", "giorni fa", "ieri l'altro"];
const HISTORICAL_KEYWORDS_EN = ["yesterday", "last week", "last month", "days ago", "week ago", "the other day"];

function hasHistoricalRef(text: string, lang: "it" | "en"): boolean {
  const lower = text.toLowerCase();
  const keywords = lang === "it" ? HISTORICAL_KEYWORDS_IT : HISTORICAL_KEYWORDS_EN;
  return keywords.some((k) => lower.includes(k));
}

async function fetchRecentReports(orgId: number, limit = 10): Promise<BriefingReport[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db.execute(sql`
    SELECT dr.id, dr.date, SUBSTRING(dr.content FOR 600) AS content, u.name AS "authorName"
    FROM daily_reports dr
    JOIN users u ON u.id = dr.author_user_id
    WHERE dr.organization_id = ${orgId}
      AND dr.created_at >= ${sevenDaysAgo.toISOString()}
    ORDER BY dr.date DESC, dr.created_at DESC
    LIMIT ${limit}
  `);
  return rows.rows as unknown as BriefingReport[];
}

// ── Server-side data fetching for bot special modes ───────────────────────────

/** Fetch unread reports from colleagues (up to 10, content capped at 600 chars). */
async function fetchUnreadReportsForBriefing(orgId: number, userId: number): Promise<BriefingReport[]> {
  const rows = await db.execute(sql`
    SELECT dr.id, dr.date::text AS date, SUBSTRING(dr.content FOR 600) AS content, u.name AS "authorName"
    FROM daily_reports dr
    JOIN users u ON u.id = dr.author_user_id
    WHERE dr.organization_id = ${orgId}
      AND dr.author_user_id <> ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM daily_report_reads drr
        WHERE drr.daily_report_id = dr.id AND drr.user_id = ${userId}
      )
    ORDER BY dr.date DESC, dr.created_at DESC
    LIMIT 10
  `);
  return rows.rows as unknown as BriefingReport[];
}

/** Fetch current org ticket summary for the briefing prompt. */
async function fetchTicketSummary(orgId: number): Promise<TicketSummary> {
  const [counts] = await db.select({
    openTickets: sql<number>`count(*) filter (where status = 'open')`,
    overdueTickets: sql<number>`count(*) filter (where due_at is not null and due_at < now() and status not in ('resolved','closed'))`,
    urgentTickets: sql<number>`count(*) filter (where priority = 'urgent' and status not in ('resolved','closed'))`,
  }).from(ticketsTable).where(eq(ticketsTable.organizationId, orgId));
  return {
    openTickets: Number(counts.openTickets),
    overdueTickets: Number(counts.overdueTickets),
    urgentTickets: Number(counts.urgentTickets),
  };
}

/** Fetch tickets the operator interacted with today (UTC day boundary).
 *  If `location` is provided, only tickets at that location are returned. */
async function fetchTodayActivity(userId: number, orgId: number, location?: string | null): Promise<ActivityTicket[]> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  const activityRows = await db
    .select({ ticketId: ticketActivityLogsTable.ticketId, actionType: ticketActivityLogsTable.actionType })
    .from(ticketActivityLogsTable)
    .where(and(
      eq(ticketActivityLogsTable.userId, userId),
      gte(ticketActivityLogsTable.createdAt, todayStart),
      lt(ticketActivityLogsTable.createdAt, tomorrowStart),
    ));

  const ticketActionMap = new Map<number, Set<string>>();
  for (const row of activityRows) {
    if (!ticketActionMap.has(row.ticketId)) ticketActionMap.set(row.ticketId, new Set());
    ticketActionMap.get(row.ticketId)!.add(row.actionType);
  }
  if (ticketActionMap.size === 0) return [];

  const ticketIds = Array.from(ticketActionMap.keys());
  const locationFilter = location ? eq(ticketsTable.location, location) : undefined;
  const tickets = await db
    .select({
      id: ticketsTable.id, ticketNumber: ticketsTable.ticketNumber,
      title: ticketsTable.title, status: ticketsTable.status,
      priority: ticketsTable.priority, category: ticketsTable.category,
    })
    .from(ticketsTable)
    .where(and(inArray(ticketsTable.id, ticketIds), eq(ticketsTable.organizationId, orgId), locationFilter));

  return tickets.map((t) => ({ ...t, actions: Array.from(ticketActionMap.get(t.id) ?? []) }));
}

// ── Main chat route ───────────────────────────────────────────────────────────

router.post("/bot/chat", requireAuth, botChatRateLimiter, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  // Only accept the mode flags from the client — all report/activity data is
  // fetched server-side from the authenticated user's organization so that
  // client-supplied content never reaches the system prompt.
  const { message, history, lang, reportMode, briefingMode, reportLocation, briefingReportId } = req.body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    lang?: string;
    reportMode?: boolean;
    briefingMode?: boolean;
    reportLocation?: string;
    briefingReportId?: number;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: "message too long" });
    return;
  }

  const resolvedLang: "it" | "en" = lang === "en" ? "en" : "it";
  const userLocation: string | null = currentUser.mainLocation || null;
  const isAdmin: boolean = currentUser.role === "admin";

  // Sanitise and cap history to avoid deliberately expensive payloads.
  const rawHistory = Array.isArray(history) ? history : [];
  const cappedHistory = rawHistory
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-MAX_HISTORY_TURNS)
    .reduce<{ role: "user" | "assistant"; content: string }[]>((acc, m) => {
      const totalSoFar = acc.reduce((s, x) => s + x.content.length, 0);
      if (totalSoFar >= MAX_HISTORY_CONTENT_CHARS) return acc;
      const remaining = MAX_HISTORY_CONTENT_CHARS - totalSoFar;
      acc.push({ role: m.role, content: m.content.slice(0, remaining) });
      return acc;
    }, []);

  let systemPrompt: string;
  let maxTokens = 800;
  // IDs of unread reports fetched for this briefing — marked read after success
  let briefingUnreadIds: number[] = [];

  if (briefingMode) {
    if (typeof briefingReportId === "number" && Number.isInteger(briefingReportId)) {
      // Single-report briefing: the user chose a specific colleague's report to read.
      const report = await fetchSingleReport(briefingReportId, orgId);
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }
      briefingUnreadIds = [briefingReportId];
      systemPrompt = buildSingleReportBriefingPrompt(report, currentUser.name ?? "Operatore", resolvedLang);
      maxTokens = 500;
    } else {
      // All-unread briefing (kept for backward compat; UI now uses the single-report path)
      const [unreadReports, ticketSummary] = await Promise.all([
        fetchUnreadReportsForBriefing(orgId, currentUser.id),
        fetchTicketSummary(orgId),
      ]);
      briefingUnreadIds = unreadReports.map((r) => r.id);
      systemPrompt = buildBriefingPrompt({ reports: unreadReports, ticketSummary }, currentUser.name ?? "Operatore", resolvedLang);
      maxTokens = 600;
    }
  } else if (reportMode) {
    // Validate reportLocation against org locations (server-side) before using it in the prompt.
    const orgLocations: string[] = (await fetchOrgLocations(orgId)) as unknown as string[];
    const validatedLocation = (typeof reportLocation === "string" && orgLocations.includes(reportLocation))
      ? reportLocation
      : null;
    const activityToday = await fetchTodayActivity(currentUser.id, orgId, validatedLocation);
    systemPrompt = buildReportModePrompt(currentUser.name ?? "Operatore", activityToday, resolvedLang, validatedLocation);
    maxTokens = 700;
  } else {
    // Normal support mode — check if message has historical references → inject recent reports
    const allUserText = [...cappedHistory.filter(m => m.role === "user").map(m => m.content), message].join(" ");
    const [context, categories, locations, historicalReports] = await Promise.all([
      searchContext(allUserText, orgId, isAdmin),
      fetchOrgCategories(orgId),
      fetchOrgLocations(orgId),
      hasHistoricalRef(allUserText, resolvedLang) ? fetchRecentReports(orgId) : Promise.resolve([] as BriefingReport[]),
    ]);

    systemPrompt = buildSystemPrompt(context, resolvedLang, categories, locations, userLocation);

    if (historicalReports.length > 0) {
      const locale = resolvedLang === "en" ? "en-GB" : "it-IT";
      const section = historicalReports.map((r) => {
        const date = new Date(r.date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
        return resolvedLang === "it"
          ? `Report di ${r.authorName} (${date}): ${r.content}`
          : `Report by ${r.authorName} (${date}): ${r.content}`;
      }).join("\n\n");
      const header = resolvedLang === "it"
        ? "\n\n--- REPORT GIORNALIERI RECENTI (ultimi 7 giorni, per rispondere a domande storiche) ---\n"
        : "\n\n--- RECENT DAILY REPORTS (last 7 days, for answering historical questions) ---\n";
      systemPrompt += header + section;
    }
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...cappedHistory,
    { role: "user", content: message },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let streamedDone = false;
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages,
      stream: true,
      max_completion_tokens: maxTokens,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    streamedDone = true;

    // Mark briefing reports as read only after the full briefing has been
    // streamed successfully. If the bot API fails, reports remain unread.
    if (briefingMode && briefingUnreadIds.length > 0) {
      await db
        .insert(dailyReportReadsTable)
        .values(briefingUnreadIds.map((id) => ({ userId: currentUser.id, dailyReportId: id })))
        .onConflictDoNothing();
    }
  } catch (err: any) {
    req.log.error({ err }, "Bot chat error");
    const errMsg = resolvedLang === "en" ? "Bot error. Please try again." : "Errore del bot. Riprova.";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
