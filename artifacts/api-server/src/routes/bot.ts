import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { db, ticketsTable, knowledgeArticlesTable, ticketCommentsTable, settingsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import OpenAI from "openai";

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

router.post("/bot/chat", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const { message, history, lang } = req.body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    lang?: string;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const resolvedLang: "it" | "en" = lang === "en" ? "en" : "it";
  const userLocation: string | null = currentUser.mainLocation || null;
  const isAdmin: boolean = currentUser.role === "admin";

  // Build a combined search query from all user turns so that short follow-up
  // messages (e.g. "sono in sede Verdi") still retrieve the relevant tickets.
  const userTurns = Array.isArray(history)
    ? history.filter((m) => m.role === "user").map((m) => m.content)
    : [];
  const searchQuery = [...userTurns, message].join(" ");

  const [context, categories, locations] = await Promise.all([
    searchContext(searchQuery, orgId, isAdmin),
    fetchOrgCategories(orgId),
    fetchOrgLocations(orgId),
  ]);
  const systemPrompt = buildSystemPrompt(context, resolvedLang, categories, locations, userLocation);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...(Array.isArray(history) ? history.slice(-10) : []),
    { role: "user", content: message },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      max_completion_tokens: 800,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
  } catch (err: any) {
    req.log.error({ err }, "Bot chat error");
    const errMsg = resolvedLang === "en" ? "Bot error. Please try again." : "Errore del bot. Riprova.";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
