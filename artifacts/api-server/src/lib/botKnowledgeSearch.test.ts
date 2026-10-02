import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  db,
  knowledgeArticlesTable,
  organizationsTable,
  usersTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { extractKeywords } from "./botKnowledge";
import { searchKnowledgeArticles } from "./botKnowledgeSearch";

const runId = randomUUID();
let organizationId: number;
let otherOrganizationId: number;
let creatorId: number;
const organizationIds: number[] = [];
const articleIds: number[] = [];
const userIds: number[] = [];

describe("Albert knowledge-base article search", () => {
  beforeAll(async () => {
    const organizations = await db
      .insert(organizationsTable)
      .values([
        { name: `BTM knowledge test ${runId}` },
        { name: `Other BTM knowledge test ${runId}` },
      ])
      .returning({ id: organizationsTable.id });
    organizationId = organizations[0].id;
    otherOrganizationId = organizations[1].id;
    organizationIds.push(organizationId, otherOrganizationId);

    const [creator] = await db
      .insert(usersTable)
      .values({
        name: `BTM KB Test ${runId}`,
        email: `btm-kb-test-${runId}@example.test`,
        passwordHash: "not-used-in-test",
        role: "admin",
        organizationId,
      })
      .returning({ id: usersTable.id });
    creatorId = creator.id;
    userIds.push(creatorId);

    const articles = await db
      .insert(knowledgeArticlesTable)
      .values([
        {
          organizationId,
          title: `Codici BTM: Porto (Verdi) ${runId}`,
          content: "Porto e Verdi indicano la stessa sede. BTM1: DEMO-BTM1-PORTO. Elenco parziale: BTM2 DEMO-BTM2-PORTO.",
          createdBy: creatorId,
        },
        {
          organizationId: otherOrganizationId,
          title: `Codici BTM: Porto (Verdi) ${runId}`,
          content: "Foreign code: FOREIGN-BTM1-PORTO.",
          createdBy: creatorId,
        },
      ])
      .returning({ id: knowledgeArticlesTable.id });
    articleIds.push(...articles.map((article) => article.id));
  });

  afterAll(async () => {
    if (articleIds.length > 0) {
      await db.delete(knowledgeArticlesTable).where(inArray(knowledgeArticlesTable.id, articleIds));
    }
    if (userIds.length > 0) {
      await db.delete(usersTable).where(inArray(usersTable.id, userIds));
    }
    if (organizationIds.length > 0) {
      await db.delete(organizationsTable).where(inArray(organizationsTable.id, organizationIds));
    }
  });

  it("retrieves the same alias-and-code article for questions using either site name", async () => {
    const portoResults = await searchKnowledgeArticles(
      extractKeywords("Mi dai il codice del BTM1 a Porto?"),
      organizationId,
    );
    const verdiResults = await searchKnowledgeArticles(
      extractKeywords("Qual è il codice del BTM1 a Verdi?"),
      organizationId,
    );

    expect(portoResults.map((article) => article.title)).toContain(`Codici BTM: Porto (Verdi) ${runId}`);
    expect(verdiResults.map((article) => article.title)).toContain(`Codici BTM: Porto (Verdi) ${runId}`);
    expect(portoResults[0]?.content).toContain("DEMO-BTM1-PORTO");
    expect(verdiResults[0]?.content).toContain("Porto e Verdi indicano la stessa sede");
  });

  it("never returns another organization's code list", async () => {
    const results = await searchKnowledgeArticles(
      extractKeywords("BTM1 Porto"),
      organizationId,
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).not.toContain("FOREIGN-BTM1-PORTO");
  });
});