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
  title: string;
  content: string;
  rank: number;
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

async function fetchOrgCategories(orgId: number): Promise<string[]> {
  const orgKey = `org_${orgId}_categories`;
  const globalKey = "categories";
  // Try org-specific first, then fall back to global key (same logic as settings route)
  const rows = await db
    .select()
    .from(settingsTable)
    .where(sql`${settingsTable.key} IN (${orgKey}, ${globalKey})`);
  const orgRow = rows.find((r) => r.key === orgKey);
  const row = orgRow ?? rows.find((r) => r.key === globalKey);
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function searchContext(query: string, orgId: number | null): Promise<SearchContextResult> {
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
      ts_rank(
        to_tsvector('italian', t.title || ' ' || t.description),
        plainto_tsquery('italian', ${ftsQuery})
      ) AS rank
    FROM tickets t
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

  const openTickets: ContextResult[] = (openRows.rows as any[]).map((row) => ({
    type: "open_ticket" as const,
    title: row.title,
    content: `${row.description}\nStato attuale: ${row.status}`.slice(0, 400),
    rank: Number(row.rank),
  }));

  // KB articles
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

function buildSystemPrompt(ctx: SearchContextResult, lang: "it" | "en", categories: string[]): string {
  const locale = lang === "en" ? "en-GB" : "it-IT";
  const now = new Date().toLocaleDateString(locale);
  const { resolvedTickets, openTickets, articles } = ctx;
  const categoryList = categories.length > 0 ? categories.join(", ") : "—";

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
      historySection += openTickets.map((r, i) =>
        `[O${i + 1}] "${r.title}"\n${r.content}`
      ).join("\n\n");
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

    return `You are TaskBot, the AI assistant for TaskDesk internal IT support. Today's date: ${now}.

Help users resolve issues before opening a ticket. Follow these rules strictly:

- If RESOLVED TICKETS are found in the context: first check whether the specific symptom or component the user mentioned (e.g. "monitor") actually appears in the historical ticket content. If the historical ticket is about a DIFFERENT component (e.g. "printer") than the one the user described, do NOT present it as a solution — treat it as "nothing found" and ask the user for more details. Only present the ticket if the specific issue genuinely matches.
- If the ticket IS relevant: present each solution step on a NUMBERED line (1. … 2. … 3. …). Use ONLY what is recorded in the ticket. End with exactly this line: "1 - No  2 - Already tried  3 - Resolved ✓"
- If OPEN TICKETS are found on the same topic: inform the user ("There's already an open ticket for this: [title].") and ask if they want to add details to it or open a new one.
- If NO tickets are found but KB articles exist: present each suggested step on a NUMBERED line (1. … 2. …). End with exactly: "1 - No  2 - Already tried  3 - Resolved ✓"
- If NOTHING is found: say you have no historical data for this issue and ask the user to describe the problem in more detail.
- If the user replies with "1" or says it did not work: output ONLY this JSON on a single line with no other text:
{"action":"create_ticket","title":"TITLE","description":"DESCRIPTION","category":"CATEGORY","resource":"RESOURCE"}
- If the user replies with "2" or says they already tried it: acknowledge it briefly and ask if they want to open a ticket anyway or provide more details.
- If the user replies with "3" or says it is resolved: congratulate them briefly and close.

Rules for the JSON fields:
  - title: copy the EXACT device code or identifier from the user's message (e.g. "BTM6", "PC-MARIO"). Do NOT shorten, rephrase or generalise it. Append a 2-3 word symptom summary.
  - description: summarise the CURRENT problem from the whole conversation (what broke, symptoms, when). Do NOT copy solutions or text from past tickets.
  - category: you MUST choose EXACTLY one value from this list — ${categoryList}. Do NOT invent a new category. Pick the closest match.
  - resource: the PHYSICAL device with the problem (e.g. "printer", "PC", "screen"). Do NOT put asset codes like "BTM6" here — those go in the title. Leave empty string if no physical device is mentioned.

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
    historySection += openTickets.map((r, i) =>
      `[O${i + 1}] "${r.title}"\n${r.content}`
    ).join("\n\n");
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

  return `Sei TaskBot, l'assistente AI di TaskDesk per il supporto IT interno. Data odierna: ${now}.

Aiuta gli utenti a risolvere i problemi prima di aprire un ticket. Segui queste regole in modo rigoroso:

- Se nel contesto ci sono TICKET RISOLTI: verifica PRIMA che il sintomo o componente specifico menzionato dall'utente (es. "monitor") sia effettivamente trattato nel contenuto del ticket storico. Se il ticket storico riguarda un componente DIVERSO (es. "stampante") rispetto a quello che l'utente ha descritto (es. "monitor"), NON presentarlo come soluzione — trattalo come "nessun dato trovato" e chiedi all'utente di descrivere meglio il problema. Presenta il ticket solo se il problema specifico corrisponde davvero.
- Se il ticket È pertinente: presenta ogni passo/azione su una riga NUMERATA (1. … 2. … 3. …). Usa SOLO ciò che è registrato nel ticket. Concludi con esattamente questa riga: "1 - No  2 - Già provato  3 - Risolto ✓"
- Se ci sono TICKET APERTI sullo stesso argomento: informa l'utente ("Esiste già un ticket aperto per questo: [titolo].") e chiedi se vuole aggiungere dettagli o aprirne uno nuovo.
- Se NON ci sono ticket ma ci sono articoli KB: presenta ogni passo suggerito su una riga NUMERATA (1. … 2. …). Concludi con esattamente: "1 - No  2 - Già provato  3 - Risolto ✓"
- Se NON è stato trovato nulla: di' che non hai dati storici su questo problema e chiedi all'utente di descriverlo meglio.
- Se l'utente risponde con "1" o dice che non ha funzionato: inserisci SOLO questo JSON su una riga senza altro testo prima o dopo:
{"action":"create_ticket","title":"TITOLO","description":"DESCRIZIONE","category":"CATEGORIA","resource":"DISPOSITIVO"}
- Se l'utente risponde con "2" o dice che ha già provato: riconosci brevemente e chiedi se vuole aprire un ticket oppure fornire altri dettagli.
- Se l'utente risponde con "3" o dice che è risolto: congratulati brevemente e chiudi.

Regole per i campi JSON:
  - title: copia ESATTAMENTE il codice o nome del dispositivo dal messaggio dell'utente (es. "BTM6", "PC-MARIO"). NON abbreviare, NON riformulare, NON generalizzare. Aggiungi 2-3 parole sul sintomo.
  - description: sintetizza il problema attuale dall'intera conversazione (cosa non funziona, sintomi, quando). NON copiare soluzioni o testo dai ticket passati.
  - category: OBBLIGATORIO — scegli ESATTAMENTE un valore da questa lista: ${categoryList}. NON inventare nuove categorie. Scegli quella più vicina al problema.
  - resource: il DISPOSITIVO FISICO con il problema (es. "stampante", "PC", "schermo"). NON mettere qui codici asset come "BTM6" — quelli vanno nel titolo. Stringa vuota se non menzionato un dispositivo fisico specifico.

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
  const [context, categories] = await Promise.all([
    searchContext(message, orgId),
    fetchOrgCategories(orgId),
  ]);
  const systemPrompt = buildSystemPrompt(context, resolvedLang, categories);

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
      model: "gpt-5-mini",
      messages,
      stream: true,
      max_completion_tokens: 4000,
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
