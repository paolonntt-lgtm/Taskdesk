import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { db, ticketsTable, knowledgeArticlesTable, ticketCommentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
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

async function searchContext(query: string, orgId: number | null): Promise<SearchContextResult> {
  const empty: SearchContextResult = { resolvedTickets: [], openTickets: [], articles: [] };
  if (!query.trim() || orgId == null) return empty;

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return empty;

  // FTS uses simplified keywords (avoids AND-all-terms mismatch on long messages)
  const ftsQuery = keywords.join(" ");
  // Regex fallback: any ticket containing at least one keyword (case-insensitive)
  const keywordRegex = keywords.join("|");

  // Resolved/closed tickets with a resolution note — most useful for self-service
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
      AND t.resolution_note IS NOT NULL
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
    const commentRows = await db
      .select({ commentText: ticketCommentsTable.commentText })
      .from(ticketCommentsTable)
      .where(and(eq(ticketCommentsTable.ticketId, row.id), eq(ticketCommentsTable.isSolution, true)))
      .limit(2);

    const solutionText = commentRows.map((c) => c.commentText).join("\n");
    const content = [
      row.description,
      row.resolution_note ? `Soluzione adottata: ${row.resolution_note}` : "",
      solutionText ? `Commento soluzione: ${solutionText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    resolvedTickets.push({
      type: "resolved_ticket",
      title: row.title,
      content: content.slice(0, 600),
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

function buildSystemPrompt(ctx: SearchContextResult, lang: "it" | "en"): string {
  const locale = lang === "en" ? "en-GB" : "it-IT";
  const now = new Date().toLocaleDateString(locale);
  const { resolvedTickets, openTickets, articles } = ctx;

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

Help users resolve issues before opening a ticket. Follow this order in every reply:
1. If the context below contains resolved tickets similar to the user's problem, mention them first: "I found a similar past case: [title] — here's how it was solved: [solution]."
2. If there are open tickets on the same topic, say: "There's already an open ticket for this: [title]."
3. Based on the context, suggest concrete steps to try. Do not invent solutions not supported by the context.
4. End your reply with: "Did that solve your problem?"
5. If the user says no or still has issues, write one short empathetic sentence, then on the next line output exactly: {"action":"create_ticket","title":"SHORT_TITLE","description":"DETAILED_DESCRIPTION"} — DETAILED_DESCRIPTION must include the problem, any similar past tickets found, and solutions already tried.

Always reply in English. Be concise and professional.${historySection}`;
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

Aiuta gli utenti a risolvere i problemi prima di aprire un ticket. In ogni risposta segui quest'ordine:
1. Se nel contesto qui sotto ci sono ticket risolti simili al problema dell'utente, citali subito: "Ho trovato un caso simile nello storico: [titolo] — ecco come è stato risolto: [soluzione]."
2. Se ci sono ticket aperti sullo stesso argomento, segnalalo: "Esiste già un ticket aperto per questo: [titolo]."
3. In base al contesto, suggerisci passi concreti da provare. Non inventare soluzioni non supportate dal contesto.
4. Concludi sempre la risposta con: "Hai risolto il problema?"
5. Se l'utente dice di no o ha ancora problemi, scrivi una frase empatica breve, poi nella riga successiva inserisci esattamente: {"action":"create_ticket","title":"TITOLO_BREVE","description":"DESCRIZIONE_DETTAGLIATA"} — DESCRIZIONE_DETTAGLIATA deve includere il problema, eventuali ticket simili trovati e le soluzioni già tentate.

Rispondi sempre in italiano. Sii sintetico e professionale.${historySection}`;
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
  const context = await searchContext(message, orgId);
  const systemPrompt = buildSystemPrompt(context, resolvedLang);

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
