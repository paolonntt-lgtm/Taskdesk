import { Router, type IRouter } from "express";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db, settingsTable, organizationsTable, usersTable, groupsTable, ticketTimeSessionsTable, ticketStatusesTable, ticketsTable, ticketActivityLogsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { stripeService } from "../stripeService";
import { type SmtpConfig } from "../lib/email";
import { validateSmtpHost } from "../lib/smtpHostValidator";

const router: IRouter = Router();

const DEFAULT_LOCATIONS = ["Main office"];
export const STANDARD_CATEGORIES = [
  "PC",
  "Printer",
  "Internet / Network",
  "Software",
  "Telephony",
  "Cash register / ERP",
  "Other",
];
const DEFAULT_CATEGORIES = STANDARD_CATEGORIES;
const DEFAULT_GROUPS = ["IT Support", "Reception", "Administration"];
const DEFAULT_MOTIVATIONAL_MESSAGES_IT = [
  "Ogni richiesta gestita bene libera spazio per il lavoro che conta.",
  "Un passo alla volta: oggi facciamo avanzare ciò che conta.",
  "La chiarezza nel team trasforma la pressione in progresso.",
  "Una buona risposta oggi costruisce fiducia per domani.",
  "Il lavoro ben organizzato si vede nelle giornate più semplici.",
  "La costanza trasforma le piccole azioni in risultati concreti.",
  "Ogni ticket chiuso con cura rende più semplice il prossimo passo.",
  "Le priorità chiare aiutano il team a lavorare con serenità.",
  "Anche una piccola soluzione può sbloccare una grande giornata.",
  "Quando il team collabora, ogni problema trova una direzione.",
  "La calma nelle decisioni lascia spazio alle soluzioni migliori.",
  "Un problema ben descritto è già più vicino alla soluzione.",
  "Ogni aggiornamento puntuale rafforza la fiducia del team.",
  "La collaborazione trasforma il lavoro individuale in progresso condiviso.",
  "Oggi basta un passo utile per far avanzare tutto il resto.",
  "Una coda ordinata rende più visibile ciò che conta davvero.",
  "La cura nei dettagli costruisce risultati che durano nel tempo.",
  "Un buon passaggio di consegne mantiene il lavoro in movimento.",
  "Le giornate produttive nascono da priorità semplici e condivise.",
  "Risolvere bene è importante; comunicare bene lo rende ancora più efficace.",
  "Ogni dettaglio gestito oggi evita un ostacolo domani.",
  "Il progresso cresce quando il team condivide informazioni e responsabilità.",
  "Una risposta chiara è un gesto concreto di attenzione.",
  "La fiducia si costruisce con tante piccole promesse mantenute.",
  "Dare un nome al problema è il primo passo per affrontarlo.",
  "Un team allineato trasforma la complessità in azioni sostenibili.",
  "Ogni priorità rispettata crea spazio per la successiva.",
  "Quando ascoltiamo con attenzione, troviamo soluzioni più precise.",
  "La precisione accelera il lavoro e riduce i passaggi inutili.",
  "Un ticket alla volta: il risultato arriva attraverso la continuità.",
  "La pazienza aiuta a scegliere la soluzione giusta, non solo quella più rapida.",
  "Il lavoro condiviso rende più leggero anche il carico più intenso.",
  "Una decisione chiara vale più di molte ipotesi lasciate in sospeso.",
  "La trasparenza rende il team più forte e le giornate più semplici.",
  "Ogni ostacolo affrontato insieme diventa esperienza per tutti.",
  "La migliore organizzazione è quella che aiuta le persone a respirare.",
  "Con metodo, anche le richieste più complesse diventano gestibili.",
  "Un buon ritmo nasce dall'equilibrio tra urgenza, qualità e attenzione.",
  "La disponibilità verso gli altri è una parte concreta del lavoro ben fatto.",
  "Ogni chiusura corretta libera energia per una nuova priorità.",
  "Le soluzioni migliori tengono insieme efficienza e cura delle persone.",
  "Quando il carico aumenta, il coordinamento diventa la nostra forza.",
  "La responsabilità condivisa rende ogni risultato più solido.",
  "Un messaggio chiaro può risparmiare tempo a tutto il team.",
  "Il valore del lavoro si vede anche nei problemi che non tornano più.",
  "La giornata migliora quando ogni persona sa da dove iniziare.",
  "Ogni richiesta è un'occasione per rendere il servizio più affidabile.",
  "Un passo preciso oggi prepara un percorso più semplice domani.",
  "La forza del team cresce ogni volta che ci aiutiamo davvero.",
  "Dalla complessità nasce chiarezza quando la affrontiamo con ordine.",
  "La gentilezza rende più efficace anche la comunicazione più operativa.",
  "Ogni consegna completata avvicina il team al risultato comune.",
  "Un team allineato trova prima le risposte e mantiene meglio il ritmo.",
  "La continuità trasforma il buon lavoro di oggi in un metodo per domani.",
  "Oggi facciamo bene ciò che è nelle nostre mani, un passo alla volta.",
];
const DEFAULT_MOTIVATIONAL_MESSAGES_EN = [
  "Every request handled well creates space for the work that matters.",
  "One step at a time: today we move forward what matters.",
  "Clarity in the team turns pressure into progress.",
  "A good answer today builds trust for tomorrow.",
  "Well-organized work makes the simplest days possible.",
  "Consistency turns small actions into tangible results.",
  "Every ticket closed with care makes the next step easier.",
  "Clear priorities help the team work with confidence.",
  "Even a small solution can unlock a much better day.",
  "When the team collaborates, every problem finds a direction.",
  "Calm decisions leave room for better solutions.",
  "A well-described problem is already closer to a solution.",
  "Every timely update strengthens the team's trust.",
  "Collaboration turns individual effort into shared progress.",
  "Today, one useful step is enough to move everything forward.",
  "An organized queue makes what truly matters easier to see.",
  "Attention to detail builds results that last.",
  "A good handoff keeps the work moving.",
  "Productive days begin with simple, shared priorities.",
  "Solving well matters; communicating well makes it even more effective.",
  "Every detail handled today prevents an obstacle tomorrow.",
  "Progress grows when the team shares information and responsibility.",
  "A clear answer is a practical way to show care.",
  "Trust is built through many small promises kept.",
  "Naming the problem is the first step toward solving it.",
  "An aligned team turns complexity into sustainable action.",
  "Every priority completed creates room for the next one.",
  "When we listen carefully, we find more precise solutions.",
  "Precision speeds up the work and reduces unnecessary steps.",
  "One ticket at a time: results come through consistency.",
  "Patience helps us choose the right solution, not only the fastest one.",
  "Shared work makes even the heaviest workload feel lighter.",
  "A clear decision is worth more than many open-ended assumptions.",
  "Transparency makes the team stronger and the day simpler.",
  "Every obstacle faced together becomes experience for everyone.",
  "The best organization is the one that helps people breathe.",
  "With a clear method, even complex requests become manageable.",
  "A good pace balances urgency, quality, and attention.",
  "Being available to others is a practical part of good work.",
  "Every correct closure frees energy for a new priority.",
  "The best solutions combine efficiency with care for people.",
  "When the workload grows, coordination becomes our strength.",
  "Shared responsibility makes every result stronger.",
  "A clear message can save time for the whole team.",
  "The value of good work is also visible in the problems that do not return.",
  "The day gets better when everyone knows where to begin.",
  "Every request is an opportunity to make the service more reliable.",
  "One precise step today prepares an easier path for tomorrow.",
  "The team grows stronger every time we genuinely help one another.",
  "Complexity becomes clarity when we approach it with order.",
  "Kindness makes even operational communication more effective.",
  "Every completed handoff brings the team closer to its shared goal.",
  "An aligned team finds answers sooner and keeps a steadier pace.",
  "Consistency turns today's good work into tomorrow's method.",
  "Today, we do well what is in our hands, one step at a time.",
];
const MAX_MOTIVATIONAL_MESSAGES = 55;
const DEFAULT_MOTIVATIONAL_MESSAGES = {
  it: DEFAULT_MOTIVATIONAL_MESSAGES_IT,
  en: DEFAULT_MOTIVATIONAL_MESSAGES_EN,
};
type MotivationalMessagesByLanguage = { it: string[]; en: string[] };
export { DEFAULT_LOCATIONS };

function orgKey(orgId: number | null | undefined, base: string): string {
  return orgId != null ? `org_${orgId}_${base}` : base;
}

async function getSetting(key: string, defaultValue: string[]): Promise<string[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return defaultValue;
  }
}

function cleanMotivationalMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 240))
        .filter(Boolean),
    ),
  ).slice(0, MAX_MOTIVATIONAL_MESSAGES);
}

async function getMotivationalMessages(key: string): Promise<MotivationalMessagesByLanguage> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return DEFAULT_MOTIVATIONAL_MESSAGES;

  try {
    const parsed: unknown = JSON.parse(row.value);
    if (Array.isArray(parsed)) {
      const legacy = cleanMotivationalMessages(parsed);
      return {
        it: legacy.length > 0 ? legacy : DEFAULT_MOTIVATIONAL_MESSAGES_IT,
        en: DEFAULT_MOTIVATIONAL_MESSAGES_EN,
      };
    }
    if (parsed && typeof parsed === "object") {
      const byLanguage = parsed as { it?: unknown; en?: unknown };
      const it = cleanMotivationalMessages(byLanguage.it);
      const en = cleanMotivationalMessages(byLanguage.en);
      return {
        it: it.length > 0 ? it : DEFAULT_MOTIVATIONAL_MESSAGES_IT,
        en: en.length > 0 ? en : DEFAULT_MOTIVATIONAL_MESSAGES_EN,
      };
    }
  } catch {
    // Fall through to the translated defaults for malformed legacy settings.
  }
  return DEFAULT_MOTIVATIONAL_MESSAGES;
}

router.get("/settings/locations", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "locations");
  const value = await getSetting(key, DEFAULT_LOCATIONS);
  res.json({ value });
});

router.get("/settings/categories", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "categories");
  const value = await getSetting(key, DEFAULT_CATEGORIES);
  const sorted = [...value].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  res.json({ value: sorted });
});

router.get("/settings/default-category", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "default_category");
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  const value = row ? row.value : null;
  res.json({ value });
});

router.put("/settings/default-category", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (value !== null && typeof value !== "string") {
    res.status(400).json({ message: "Valore non valido" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "default_category");
  if (!value) {
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
    res.json({ value: null });
    return;
  }
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
  res.json({ value });
});

router.put("/settings/locations", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "locations");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

router.put("/settings/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "categories");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  const sorted = [...cleaned].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(sorted) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(sorted) } });
  res.json({ value: sorted });
});

router.get("/settings/motivational-messages", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "motivational_messages");
  const messagesByLanguage = await getMotivationalMessages(key);
  res.json({ messages: messagesByLanguage.it, messagesByLanguage });
});

router.put("/settings/motivational-messages", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { messages, messagesByLanguage } = req.body ?? {};
  let nextMessages: MotivationalMessagesByLanguage;
  if (messagesByLanguage && typeof messagesByLanguage === "object" && !Array.isArray(messagesByLanguage)) {
    const candidate = messagesByLanguage as { it?: unknown; en?: unknown };
    if ((candidate.it !== undefined && !Array.isArray(candidate.it)) || (candidate.en !== undefined && !Array.isArray(candidate.en))) {
      res.status(400).json({ message: "I messaggi devono essere array di stringhe per lingua" });
      return;
    }
    nextMessages = {
      it: cleanMotivationalMessages(candidate.it),
      en: cleanMotivationalMessages(candidate.en),
    };
  } else if (Array.isArray(messages) && messages.every((message: unknown) => typeof message === "string")) {
    // Keep older clients compatible: the old single list is the Italian list.
    nextMessages = { it: cleanMotivationalMessages(messages), en: [] };
  } else {
    res.status(400).json({ message: "I messaggi devono essere array di stringhe per lingua" });
    return;
  }

  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "motivational_messages");
  const cleaned = {
    it: nextMessages.it.length > 0 ? nextMessages.it : DEFAULT_MOTIVATIONAL_MESSAGES_IT,
    en: nextMessages.en.length > 0 ? nextMessages.en : DEFAULT_MOTIVATIONAL_MESSAGES_EN,
  };

  if (nextMessages.it.length === 0 && nextMessages.en.length === 0) {
    await db.delete(settingsTable).where(eq(settingsTable.key, key));
    res.json({ messages: cleaned.it, messagesByLanguage: cleaned });
    return;
  }

  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(nextMessages) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(nextMessages) } });
  res.json({ messages: cleaned.it, messagesByLanguage: cleaned });
});

router.get("/settings/groups", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (orgId != null) {
    const realGroups = await db
      .select({ name: groupsTable.name })
      .from(groupsTable)
      .where(eq(groupsTable.organizationId, orgId))
      .orderBy(groupsTable.name);
    if (realGroups.length > 0) {
      res.json({ value: realGroups.map((g) => g.name) });
      return;
    }
  }
  const key = orgKey(orgId, "groups");
  const value = await getSetting(key, DEFAULT_GROUPS);
  res.json({ value });
});

router.put("/settings/groups", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    res.status(400).json({ message: "Valore non valido: deve essere un array di stringhe" });
    return;
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "groups");
  const cleaned = value.map((v: string) => v.trim()).filter(Boolean);
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(cleaned) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(cleaned) } });
  res.json({ value: cleaned });
});

// Group permissions: { [groupName]: string[] } where permissions are "change_status" | "add_notes"
router.get("/settings/group-permissions", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "group_permissions");
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  let value: Record<string, string[]> = {};
  if (row) {
    try { value = JSON.parse(row.value); } catch { value = {}; }
  }
  res.json({ value });
});

router.put("/settings/group-permissions", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { value } = req.body ?? {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    res.status(400).json({ message: "Valore non valido: deve essere un oggetto { gruppo: permessi[] }" });
    return;
  }
  const VALID_PERMS = new Set(["change_status", "add_notes"]);
  for (const [k, v] of Object.entries(value)) {
    if (typeof k !== "string" || !Array.isArray(v) || (v as any[]).some((p) => !VALID_PERMS.has(p))) {
      res.status(400).json({ message: `Permessi non validi per il gruppo "${k}"` });
      return;
    }
  }
  const currentUser = (req as any).currentUser;
  const key = orgKey(currentUser.organizationId, "group_permissions");
  await db
    .insert(settingsTable)
    .values({ key, value: JSON.stringify(value) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(value) } });
  res.json({ value });
});

router.get("/settings/billing", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, currentUser.organizationId));
  if (!org) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  res.json({
    ragioneSociale: org.ragioneSociale,
    piva: org.piva,
    codiceFiscale: org.codiceFiscale,
    indirizzo: org.indirizzo,
    cap: org.cap,
    citta: org.citta,
    provincia: org.provincia,
    paese: org.paese,
    sdiCode: org.sdiCode,
    pec: org.pec,
  });
});

router.put("/settings/billing", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { ragioneSociale, piva, codiceFiscale, indirizzo, cap, citta, provincia, paese, sdiCode, pec } = req.body ?? {};

  const [updated] = await db
    .update(organizationsTable)
    .set({
      ragioneSociale: ragioneSociale || null,
      piva: piva || null,
      codiceFiscale: codiceFiscale || null,
      indirizzo: indirizzo || null,
      cap: cap || null,
      citta: citta || null,
      provincia: provincia || null,
      paese: paese || 'IT',
      sdiCode: sdiCode || null,
      pec: pec || null,
    })
    .where(eq(organizationsTable.id, currentUser.organizationId))
    .returning();

  // Sync to Stripe: find admin users of this org who have a Stripe customer
  try {
    const adminUsers = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(and(eq(usersTable.organizationId, currentUser.organizationId), eq(usersTable.role, 'admin')));

    const billingInfo = {
      ragioneSociale: updated.ragioneSociale,
      piva: updated.piva,
      codiceFiscale: updated.codiceFiscale,
      indirizzo: updated.indirizzo,
      cap: updated.cap,
      citta: updated.citta,
      provincia: updated.provincia,
      paese: updated.paese,
      sdiCode: updated.sdiCode,
      pec: updated.pec,
    };

    await Promise.allSettled(
      adminUsers
        .filter((u) => !!u.stripeCustomerId)
        .map((u) => stripeService.updateCustomerBilling(u.stripeCustomerId!, billingInfo))
    );
  } catch {
    // Stripe sync failure should not block saving
  }

  res.json({
    ragioneSociale: updated.ragioneSociale,
    piva: updated.piva,
    codiceFiscale: updated.codiceFiscale,
    indirizzo: updated.indirizzo,
    cap: updated.cap,
    citta: updated.citta,
    provincia: updated.provincia,
    paese: updated.paese,
    sdiCode: updated.sdiCode,
    pec: updated.pec,
  });
});

const VALID_BUSINESS_TYPES = ["it_support", "professional_studio", "agency", "other"];

router.get("/settings/organization", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, currentUser.organizationId));
  if (!org) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  res.json({
    name: org.name,
    businessType: org.businessType,
    clientsEnabled: org.clientsEnabled,
    workedTimeEnabled: org.workedTimeEnabled,
    timeTrackingModuleEnabled: org.timeTrackingModuleEnabled,
    entitySingular: org.entitySingular,
    entityPlural: org.entityPlural,
  });
});

router.patch("/settings/organization", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { name, businessType, clientsEnabled, workedTimeEnabled, timeTrackingModuleEnabled, entitySingular, entityPlural } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ message: "Il nome azienda deve avere almeno 2 caratteri" });
    return;
  }
  if (businessType !== undefined && businessType !== null && !VALID_BUSINESS_TYPES.includes(businessType)) {
    res.status(400).json({ message: "Tipo di attività non valido" });
    return;
  }
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) {
    res.status(404).json({ message: "Organizzazione non trovata" });
    return;
  }
  const updateData: Record<string, unknown> = { name: name.trim() };
  if (businessType !== undefined) updateData.businessType = businessType || null;
  if (typeof clientsEnabled === "boolean") updateData.clientsEnabled = clientsEnabled;
  if (typeof workedTimeEnabled === "boolean") updateData.workedTimeEnabled = workedTimeEnabled;
  if (typeof timeTrackingModuleEnabled === "boolean") updateData.timeTrackingModuleEnabled = timeTrackingModuleEnabled;
  if (typeof entitySingular === "string") updateData.entitySingular = entitySingular.trim() || null;
  if (typeof entityPlural === "string") updateData.entityPlural = entityPlural.trim() || null;
  const [updated] = await db
    .update(organizationsTable)
    .set(updateData as any)
    .where(eq(organizationsTable.id, currentUser.organizationId))
    .returning();
  if (timeTrackingModuleEnabled === false) {
    const endedAt = new Date();
    const activeSessions = await db.select({ ticketId: ticketTimeSessionsTable.ticketId })
      .from(ticketTimeSessionsTable)
      .where(and(eq(ticketTimeSessionsTable.organizationId, currentUser.organizationId), isNull(ticketTimeSessionsTable.endedAt)));
    const activeTicketIds = [...new Set(activeSessions.map((session) => session.ticketId))];
    await db.update(ticketTimeSessionsTable)
      .set({ endedAt })
      .where(and(eq(ticketTimeSessionsTable.organizationId, currentUser.organizationId), isNull(ticketTimeSessionsTable.endedAt)));
    if (activeTicketIds.length > 0) {
      const statuses = await db.select({ key: ticketStatusesTable.key, label: ticketStatusesTable.label, isClosed: ticketStatusesTable.isClosed })
        .from(ticketStatusesTable)
        .where(eq(ticketStatusesTable.organizationId, currentUser.organizationId));
      const waitingStatus = statuses.find((status) =>
        !status.isClosed && (status.key === "waiting" || /attesa|waiting/i.test(status.label)),
      );
      if (waitingStatus) {
        await db.update(ticketsTable)
          .set({ status: waitingStatus.key, updatedAt: endedAt })
          .where(and(eq(ticketsTable.organizationId, currentUser.organizationId), inArray(ticketsTable.id, activeTicketIds)));
        await db.insert(ticketActivityLogsTable).values(activeTicketIds.map((ticketId) => ({
          ticketId,
          userId: currentUser.id,
          actionType: "status_changed",
          actionDescription: `Timer interrotto dopo la disattivazione del modulo; ticket spostato in "${waitingStatus.label}"`,
        })));
      }
    }
  }
  res.json({
    name: updated.name,
    businessType: updated.businessType,
    clientsEnabled: updated.clientsEnabled,
    workedTimeEnabled: updated.workedTimeEnabled,
    timeTrackingModuleEnabled: updated.timeTrackingModuleEnabled,
    entitySingular: updated.entitySingular,
    entityPlural: updated.entityPlural,
  });
});

// ── CLIENT SHARED LAYOUT ───────────────────────────────────────────────────

router.get("/settings/client-layout", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  const [org] = await db.select({ clientSharedLayout: organizationsTable.clientSharedLayout })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, currentUser.organizationId));
  if (!org) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  res.json({ layout: org.clientSharedLayout ?? null });
});

router.patch("/settings/client-layout", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { layout } = req.body ?? {};
  if (!Array.isArray(layout)) { res.status(400).json({ message: "Layout non valido" }); return; }

  const VALID_BUILTIN_IDS = new Set(["company-info", "fixed-notes", "fixed-notes-2", "client-notes", "linked-tickets"]);
  const normalized: Array<{
    id: string;
    instanceId: string;
    type?: string;
    visible: boolean;
    customName?: string;
  }> = [];

  for (const item of layout) {
    if (typeof item !== "object" || item === null) {
      res.status(400).json({ message: "Ogni elemento del layout deve essere un oggetto" }); return;
    }
    const instanceId: string = typeof item.instanceId === "string" ? item.instanceId
      : typeof item.id === "string" ? item.id : "";
    if (!instanceId) {
      res.status(400).json({ message: "Ogni elemento del layout deve avere un instanceId" }); return;
    }
    if (typeof item.visible !== "boolean") {
      res.status(400).json({ message: `Campo 'visible' mancante o non booleano per ${instanceId}` }); return;
    }
    const id: string = typeof item.id === "string" ? item.id : instanceId;
    const type: string | undefined = typeof item.type === "string" ? item.type : undefined;
    const customName: string | undefined =
      typeof item.customName === "string" && item.customName.trim()
        ? item.customName.trim().slice(0, 100)
        : undefined;

    if (!VALID_BUILTIN_IDS.has(instanceId) && !type) {
      res.status(400).json({ message: `Tipo mancante per il blocco personalizzato ${instanceId}` }); return;
    }

    normalized.push({ id, instanceId, ...(type ? { type } : {}), visible: item.visible, ...(customName ? { customName } : {}) });
  }

  const currentUser = (req as any).currentUser;
  if (!currentUser.organizationId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  await db.update(organizationsTable)
    .set({ clientSharedLayout: normalized } as any)
    .where(eq(organizationsTable.id, currentUser.organizationId));
  res.json({ layout: normalized });
});

// ── EMAIL NOTIFICATIONS ────────────────────────────────────────────────────

router.get("/settings/email-notifications", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  const [org] = await db.select({ sendClosureEmail: organizationsTable.sendClosureEmail }).from(organizationsTable).where(eq(organizationsTable.id, orgId));
  if (!org) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  res.json({ sendClosureEmail: org.sendClosureEmail });
});

router.put("/settings/email-notifications", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }
  const { sendClosureEmail } = req.body ?? {};
  if (typeof sendClosureEmail !== "boolean") { res.status(400).json({ message: "sendClosureEmail deve essere un booleano" }); return; }
  await db.update(organizationsTable).set({ sendClosureEmail }).where(eq(organizationsTable.id, orgId));
  res.json({ sendClosureEmail });
});

// ── OUTBOUND EMAIL (SMTP) ──────────────────────────────────────────────────

router.get("/settings/outbound-email", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const key = `org_${orgId}_smtp_config`;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) { res.json({ config: null }); return; }

  let config: SmtpConfig;
  try { config = JSON.parse(row.value); } catch { res.json({ config: null }); return; }

  res.json({
    config: { host: config.host, port: config.port, secure: config.secure, user: config.user, password: "***", from: config.from },
  });
});

router.put("/settings/outbound-email", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { host, port, secure, user, password, from } = req.body ?? {};
  if (!host || typeof host !== "string") { res.status(400).json({ message: "Host SMTP obbligatorio" }); return; }
  if (!user || typeof user !== "string") { res.status(400).json({ message: "Utente SMTP obbligatorio" }); return; }
  if (!from || typeof from !== "string") { res.status(400).json({ message: "Indirizzo mittente obbligatorio" }); return; }

  const hostErrPut = await validateSmtpHost(host);
  if (hostErrPut) { res.status(400).json({ message: hostErrPut }); return; }

  const key = `org_${orgId}_smtp_config`;
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  let existingPassword = "";
  if (existing) {
    try { existingPassword = (JSON.parse(existing.value) as SmtpConfig).password ?? ""; } catch {}
  }

  const resolvedPassword = (typeof password === "string" && password !== "***" && password.length > 0)
    ? password : existingPassword;
  if (!resolvedPassword) { res.status(400).json({ message: "Password SMTP obbligatoria" }); return; }

  const config: SmtpConfig = {
    host: host.trim(),
    port: typeof port === "number" ? port : parseInt(String(port), 10) || 587,
    secure: secure === true,
    user: user.trim(),
    password: resolvedPassword,
    from: from.trim(),
  };

  await db.insert(settingsTable).values({ key, value: JSON.stringify(config) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(config) } });

  res.json({ config: { ...config, password: "***" } });
});

router.post("/settings/outbound-email/test", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;
  if (!orgId) { res.status(404).json({ message: "Organizzazione non trovata" }); return; }

  const { host, port, secure, user, password, from } = req.body ?? {};
  if (!host || !user) { res.status(400).json({ message: "Host e utente SMTP obbligatori" }); return; }

  const hostErrTest = await validateSmtpHost(String(host).trim());
  if (hostErrTest) { res.status(400).json({ message: hostErrTest }); return; }

  let resolvedPassword = password;
  if (!resolvedPassword || resolvedPassword === "***") {
    const key = `org_${orgId}_smtp_config`;
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (existing) {
      try { resolvedPassword = (JSON.parse(existing.value) as SmtpConfig).password; } catch {}
    }
  }
  if (!resolvedPassword) { res.status(400).json({ message: "Password obbligatoria per il test" }); return; }

  try {
    const nodemailerMod = await import("nodemailer");
    const transporter = nodemailerMod.default.createTransport({
      host: String(host).trim(),
      port: typeof port === "number" ? port : parseInt(String(port), 10) || 587,
      secure: secure === true,
      auth: { user: String(user).trim(), pass: resolvedPassword },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: from || user,
      to: currentUser.email!,
      subject: "TaskDesk — Test email uscente SMTP",
      text: `Configurazione SMTP verificata per ${user}. Messaggio automatico di test.`,
      html: `<p>Configurazione SMTP verificata per <strong>${user}</strong>.</p><p>Messaggio automatico di test da <strong>TaskDesk</strong>.</p>`,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.json({ ok: false, error: err?.message ?? "Connessione fallita" });
  }
});

export default router;
