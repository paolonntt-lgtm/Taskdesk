import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type RetrievedKnowledgeArticle = {
  type: "article";
  title: string;
  content: string;
  rank: number;
};

export async function searchKnowledgeArticles(
  keywords: readonly string[],
  organizationId: number,
): Promise<RetrievedKnowledgeArticle[]> {
  if (keywords.length === 0) return [];

  const ftsQuery = keywords.join(" ");
  const keywordRegex = keywords.join("|");

  // Weight titles more strongly; the regex fallback is title-only so a generic
  // body word cannot make an unrelated article look relevant.
  const articleRows = await db.execute(sql`
    SELECT
      id,
      title,
      content,
      ts_rank(
        setweight(to_tsvector('italian', title), 'A') ||
        setweight(to_tsvector('italian', content), 'B'),
        plainto_tsquery('italian', ${ftsQuery})
      ) AS rank
    FROM knowledge_articles
    WHERE
      organization_id = ${organizationId}
      AND (
        (
          setweight(to_tsvector('italian', title), 'A') ||
          setweight(to_tsvector('italian', content), 'B')
        ) @@ plainto_tsquery('italian', ${ftsQuery})
        OR title ~* ${keywordRegex}
      )
    ORDER BY rank DESC
    LIMIT 3
  `);

  return (articleRows.rows as Array<{ title: string; content: string; rank: number }>).map((row) => ({
    type: "article",
    title: row.title,
    content: row.content,
    rank: Number(row.rank),
  }));
}