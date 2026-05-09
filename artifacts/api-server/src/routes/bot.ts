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
  type: "ticket" | "article";
  title: string;
  content: string;
  rank: number;
}

async function searchContext(query: string, orgId: number | null): Promise<ContextResult[]> {
  const results: ContextResult[] = [];

  if (!query.trim()) return [];

  if (orgId != null) {
    const ticketRows = await db.execute(sql`
      SELECT
        t.id,
        t.title,
        t.description,
        t.resolution_note,
        ts_rank(
          to_tsvector('italian', t.title || ' ' || t.description || ' ' || COALESCE(t.resolution_note, '')),
          plainto_tsquery('italian', ${query})
        ) AS rank
      FROM tickets t
      WHERE
        t.organization_id = ${orgId}
        AND t.status IN ('resolved', 'closed')
        AND t.resolution_note IS NOT NULL
        AND (
          to_tsvector('italian', t.title || ' ' || t.description || ' ' || COALESCE(t.resolution_note, ''))
          @@ plainto_tsquery('italian', ${query})
          OR t.title ILIKE ${'%' + query + '%'}
          OR t.description ILIKE ${'%' + query + '%'}
        )
      ORDER BY rank DESC
      LIMIT 3
    `);

    for (const row of ticketRows.rows as any[]) {
      const commentRows = await db
        .select({ commentText: ticketCommentsTable.commentText, isSolution: ticketCommentsTable.isSolution })
        .from(ticketCommentsTable)
        .where(and(eq(ticketCommentsTable.ticketId, row.id), eq(ticketCommentsTable.isSolution, true)))
        .limit(2);

      const solutionText = commentRows.map((c) => c.commentText).join("\n");
      const content = [
        row.description,
        row.resolution_note ? `Nota risoluzione: ${row.resolution_note}` : "",
        solutionText ? `Soluzione: ${solutionText}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      results.push({
        type: "ticket",
        title: row.title,
        content: content.slice(0, 600),
        rank: Number(row.rank),
      });
    }

    const articleRows = await db.execute(sql`
      SELECT
        id,
        title,
        content,
        ts_rank(
          to_tsvector('italian', title || ' ' || content),
          plainto_tsquery('italian', ${query})
        ) AS rank
      FROM knowledge_articles
      WHERE
        organization_id = ${orgId}
        AND (
          to_tsvector('italian', title || ' ' || content) @@ plainto_tsquery('italian', ${query})
          OR title ILIKE ${'%' + query + '%'}
          OR content ILIKE ${'%' + query + '%'}
        )
      ORDER BY rank DESC
      LIMIT 3
    `);

    for (const row of articleRows.rows as any[]) {
      results.push({
        type: "article",
        title: row.title,
        content: String(row.content).slice(0, 600),
        rank: Number(row.rank),
      });
    }
  }

  return results.sort((a, b) => b.rank - a.rank).slice(0, 5);
}

function buildSystemPrompt(context: ContextResult[]): string {
  const now = new Date().toLocaleDateString("it-IT");

  let contextSection = "";
  if (context.length > 0) {
    contextSection = `\n\nRisorse disponibili:\n` + context.map((r, i) => {
      const source = r.type === "ticket" ? "Ticket risolto" : "Articolo KB";
      return `[${i + 1}] ${source}: "${r.title}"\n${r.content}`;
    }).join("\n\n");
  } else {
    contextSection = "\n\nNessuna risorsa trovata nel database per questo problema.";
  }

  return `Sei TaskBot, l'assistente AI di TaskDesk per il supporto IT interno. Data odierna: ${now}.

Il tuo compito è aiutare gli utenti a risolvere i problemi PRIMA di aprire un ticket. Segui queste istruzioni:

1. Analizza il problema dell'utente
2. Se hai risorse utili, presentale in modo chiaro e conciso con passi numerati
3. Dopo aver suggerito soluzioni, chiedi: "Hai risolto il problema?"
4. Se l'utente dice di no o ha ancora problemi, rispondi ESATTAMENTE con questo JSON (su una riga sola, senza testo aggiuntivo):
   {"action":"create_ticket","title":"TITOLO_BREVE","description":"DESCRIZIONE_DETTAGLIATA"}
   Dove TITOLO_BREVE è un titolo conciso del problema e DESCRIZIONE_DETTAGLIATA è una descrizione completa che includa il problema dell'utente e le soluzioni tentate.
5. Sii sintetico e professionale. Rispondi sempre in italiano.
6. Non inventare soluzioni che non conosci.${contextSection}`;
}

router.post("/bot/chat", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const { message, history } = req.body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const context = await searchContext(message, orgId);
  const systemPrompt = buildSystemPrompt(context);

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
      max_tokens: 800,
      temperature: 0.4,
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
    res.write(`data: ${JSON.stringify({ error: "Errore del bot. Riprova." })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
