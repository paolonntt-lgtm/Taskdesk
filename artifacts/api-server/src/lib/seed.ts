import { db, usersTable, ticketsTable, ticketCommentsTable, ticketActivityLogsTable, ticketInternalNotesTable, settingsTable } from "@workspace/db";
import { hashPassword } from "../routes/auth";
import { logger } from "./logger";

export async function seedIfEmpty(): Promise<void> {
  const existing = await db.select().from(usersTable);
  if (existing.length > 0) {
    logger.info("Data already seeded, skipping.");
    return;
  }

  logger.info("Seeding demo data...");

  const [adminHash, user1Hash, user2Hash] = await Promise.all([
    hashPassword("admin123"),
    hashPassword("user123"),
    hashPassword("user123"),
  ]);

  const [admin, user1, user2] = await db.insert(usersTable).values([
    { name: "Admin Sistema", email: "admin@example.com", passwordHash: adminHash, role: "admin", mainLocation: "Sede A" },
    { name: "Marco Rossi", email: "utente@example.com", passwordHash: user1Hash, role: "user", mainLocation: "Sede B" },
    { name: "Sara Bianchi", email: "sara@example.com", passwordHash: user2Hash, role: "user", mainLocation: "Sede C" },
  ]).returning();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 86400000);
  const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000);
  const twentyFiveDaysAgo = new Date(now.getTime() - 25 * 86400000);

  const tickets = await db.insert(ticketsTable).values([
    {
      title: "Stampante non stampa",
      description: "La stampante principale della Sede A non stampa. Mostra errore carta inceppata ma non c'e carta inceppata visibile. Il problema persiste anche dopo il riavvio.",
      category: "Stampante",
      location: "Sede A",
      resource: "stampante principale",
      priority: "high",
      status: "open",
      createdBy: user1.id,
      assignedTo: admin.id,
      createdAt: yesterday,
      updatedAt: yesterday,
    },
    {
      title: "PC banco lento",
      description: "Il PC al banco cassa e diventato molto lento nell ultimo giorno. L avvio richiede piu di 5 minuti e anche le operazioni normali sono molto lente.",
      category: "PC",
      location: "Sede B",
      resource: "PC banco",
      priority: "medium",
      status: "waiting",
      createdBy: user1.id,
      assignedTo: admin.id,
      createdAt: twoDaysAgo,
      updatedAt: yesterday,
    },
    {
      title: "Problema connessione internet",
      description: "La connessione internet alla Sede A e intermittente. Si disconnette ogni 10-15 minuti e richiede il riavvio del router. Questo sta bloccando tutte le operazioni che richiedono connessione.",
      category: "Internet / Rete",
      location: "Sede A",
      resource: "router",
      priority: "urgent",
      status: "open",
      createdBy: user2.id,
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      title: "Software gestionale bloccato",
      description: "Il software gestionale cassa si blocca ogni volta che si tenta di aprire il modulo fatturazione. Viene mostrato un errore Database connection failed. Impossibile emettere fatture.",
      category: "Software",
      location: "Sede C",
      resource: "gestionale cassa",
      priority: "high",
      status: "waiting",
      createdBy: user2.id,
      assignedTo: admin.id,
      createdAt: fiveDaysAgo,
      updatedAt: twoDaysAgo,
    },
    {
      title: "Telefono fisso non funziona",
      description: "Il telefono fisso della reception non ha linea. Non si sente il segnale di chiamata. Il problema e presente da stamattina.",
      category: "Telefonia",
      location: "Sede B",
      resource: "telefono reception",
      priority: "medium",
      status: "open",
      createdBy: user1.id,
      assignedTo: null,
      createdAt: yesterday,
      updatedAt: yesterday,
    },
    {
      title: "Aggiornamento Windows completato",
      description: "Aggiornamento mensile di sicurezza Windows eseguito su tutti i PC della Sede A. Tutti i sistemi funzionanti regolarmente.",
      category: "PC",
      location: "Sede A",
      resource: "tutti i PC",
      priority: "low",
      status: "closed",
      createdBy: admin.id,
      assignedTo: admin.id,
      createdAt: tenDaysAgo,
      updatedAt: fiveDaysAgo,
      closedAt: fiveDaysAgo,
    },
    {
      title: "Cassa non accetta carte di credito",
      description: "Il POS della cassa principale non legge le carte di credito contactless. Le carte fisiche con chip funzionano normalmente. Problema verificato su piu carte diverse.",
      category: "Cassa / Gestionale",
      location: "Sede A",
      resource: "cassa",
      priority: "urgent",
      status: "waiting",
      createdBy: user2.id,
      assignedTo: admin.id,
      createdAt: yesterday,
      updatedAt: now,
    },
    {
      title: "Richiesta nuovo mouse ergonomico",
      description: "Richiesta di acquisto di un mouse ergonomico per problemi al polso. Il medico ha consigliato l utilizzo di dispositivi ergonomici.",
      category: "PC",
      location: "Sede C",
      resource: "postazione ufficio",
      priority: "low",
      status: "resolved",
      createdBy: user2.id,
      assignedTo: admin.id,
      createdAt: tenDaysAgo,
      updatedAt: fiveDaysAgo,
      closedAt: fiveDaysAgo,
    },
    {
      title: "Configurazione VPN aziendale",
      description: "Necessaria la configurazione della VPN su 3 laptop dei commerciali che lavorano in smart working.",
      category: "Internet / Rete",
      location: "Sede B",
      resource: "laptop commerciali",
      priority: "medium",
      status: "resolved",
      createdBy: admin.id,
      assignedTo: admin.id,
      createdAt: fifteenDaysAgo,
      updatedAt: tenDaysAgo,
      closedAt: tenDaysAgo,
    },
    {
      title: "Monitor ufficio con linee verticali",
      description: "Il monitor della postazione di lavoro dell ufficio amministrativo presenta linee verticali colorate. Il problema e progressivo.",
      category: "PC",
      location: "Sede C",
      resource: "monitor ufficio amministrativo",
      priority: "medium",
      status: "open",
      createdBy: user2.id,
      assignedTo: null,
      createdAt: twentyDaysAgo,
      updatedAt: twentyDaysAgo,
    },
    {
      title: "Backup dati non eseguito",
      description: "Il backup automatico notturno non si e eseguito per 3 notti consecutive. Necessario verificare lo stato del sistema di backup.",
      category: "Software",
      location: "Sede A",
      resource: "server backup",
      priority: "high",
      status: "closed",
      createdBy: admin.id,
      assignedTo: admin.id,
      createdAt: twentyFiveDaysAgo,
      updatedAt: twentyDaysAgo,
      closedAt: twentyDaysAgo,
    },
  ]).returning();

  await db.insert(ticketActivityLogsTable).values([
    { ticketId: tickets[0].id, userId: user1.id, actionType: "created", actionDescription: "Ticket creato da Marco Rossi", createdAt: yesterday },
    { ticketId: tickets[0].id, userId: admin.id, actionType: "assigned", actionDescription: "Ticket assegnato ad Admin Sistema", createdAt: yesterday },
    { ticketId: tickets[1].id, userId: user1.id, actionType: "created", actionDescription: "Ticket creato da Marco Rossi", createdAt: twoDaysAgo },
    { ticketId: tickets[1].id, userId: admin.id, actionType: "status_changed", actionDescription: `Stato cambiato da "Aperto" a "In lavorazione"`, createdAt: yesterday },
    { ticketId: tickets[2].id, userId: user2.id, actionType: "created", actionDescription: "Ticket creato da Sara Bianchi", createdAt: now },
    { ticketId: tickets[3].id, userId: user2.id, actionType: "created", actionDescription: "Ticket creato da Sara Bianchi", createdAt: fiveDaysAgo },
    { ticketId: tickets[3].id, userId: admin.id, actionType: "assigned", actionDescription: "Ticket assegnato ad Admin Sistema", createdAt: fiveDaysAgo },
    { ticketId: tickets[3].id, userId: admin.id, actionType: "status_changed", actionDescription: `Stato cambiato da "Aperto" a "In attesa"`, createdAt: twoDaysAgo },
    { ticketId: tickets[4].id, userId: user1.id, actionType: "created", actionDescription: "Ticket creato da Marco Rossi", createdAt: yesterday },
    { ticketId: tickets[5].id, userId: admin.id, actionType: "created", actionDescription: "Ticket creato da Admin Sistema", createdAt: tenDaysAgo },
    { ticketId: tickets[5].id, userId: admin.id, actionType: "status_changed", actionDescription: `Stato cambiato da "Risolto" a "Chiuso"`, createdAt: fiveDaysAgo },
    { ticketId: tickets[6].id, userId: user2.id, actionType: "created", actionDescription: "Ticket creato da Sara Bianchi", createdAt: yesterday },
    { ticketId: tickets[6].id, userId: admin.id, actionType: "status_changed", actionDescription: `Stato cambiato da "Aperto" a "In lavorazione"`, createdAt: now },
    { ticketId: tickets[7].id, userId: user2.id, actionType: "created", actionDescription: "Ticket creato da Sara Bianchi", createdAt: tenDaysAgo },
    { ticketId: tickets[7].id, userId: admin.id, actionType: "status_changed", actionDescription: `Stato cambiato da "Aperto" a "Risolto"`, createdAt: fiveDaysAgo },
    { ticketId: tickets[8].id, userId: admin.id, actionType: "created", actionDescription: "Ticket creato da Admin Sistema", createdAt: fifteenDaysAgo },
    { ticketId: tickets[8].id, userId: admin.id, actionType: "status_changed", actionDescription: `Stato cambiato da "Aperto" a "Risolto"`, createdAt: tenDaysAgo },
    { ticketId: tickets[9].id, userId: user2.id, actionType: "created", actionDescription: "Ticket creato da Sara Bianchi", createdAt: twentyDaysAgo },
    { ticketId: tickets[10].id, userId: admin.id, actionType: "created", actionDescription: "Ticket creato da Admin Sistema", createdAt: twentyFiveDaysAgo },
    { ticketId: tickets[10].id, userId: admin.id, actionType: "status_changed", actionDescription: `Stato cambiato da "Risolto" a "Chiuso"`, createdAt: twentyDaysAgo },
  ]);

  await db.insert(ticketCommentsTable).values([
    { ticketId: tickets[0].id, authorId: admin.id, commentText: "Ho controllato la stampante. Il sensore carta sembra malfunzionante. Sto contattando l assistenza tecnica.", createdAt: yesterday },
    { ticketId: tickets[0].id, authorId: user1.id, commentText: "Grazie. Nel frattempo usiamo la stampante della Sede B per le urgenze.", createdAt: yesterday },
    { ticketId: tickets[1].id, authorId: admin.id, commentText: "Ho effettuato una scansione antivirus. Trovati 3 file sospetti, ora in quarantena. Il PC dovrebbe essere piu veloce.", createdAt: yesterday },
    { ticketId: tickets[3].id, authorId: admin.id, commentText: "Ho contattato il fornitore del software. Stiamo aspettando una patch. Previsto entro 2 giorni lavorativi.", createdAt: twoDaysAgo },
    { ticketId: tickets[3].id, authorId: user2.id, commentText: "Ok, nel frattempo usiamo il registro cartaceo per le fatture urgenti.", createdAt: twoDaysAgo },
    { ticketId: tickets[6].id, authorId: admin.id, commentText: "Ho contattato il fornitore del POS. Potrebbe essere un aggiornamento firmware. Mandano un tecnico domani.", createdAt: now },
  ]);

  await db.insert(ticketInternalNotesTable).values([
    { ticketId: tickets[0].id, authorId: admin.id, noteText: "Verificare garanzia stampante. Modello HP LaserJet Pro M404dn. Acquistata 18 mesi fa.", createdAt: yesterday },
    { ticketId: tickets[3].id, authorId: admin.id, noteText: "Il problema sembra legato all ultimo aggiornamento del gestionale (v3.2.1). Verificare rollback come piano B.", createdAt: twoDaysAgo },
    { ticketId: tickets[6].id, authorId: admin.id, noteText: "Numero seriale POS: TRX-2024-0891. Contratto assistenza attivo fino a dicembre 2025.", createdAt: now },
  ]);

  // Seed default groups for org 1 (orgKey format: org_<orgId>_groups)
  const orgId = admin.organizationId;
  if (orgId != null) {
    await db
      .insert(settingsTable)
      .values({ key: `org_${orgId}_groups`, value: JSON.stringify(["IT Support", "Reception", "Administration", "Operations"]) })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: JSON.stringify(["IT Support", "Reception", "Administration", "Operations"]) } });
  }

  logger.info("Seed completed successfully!");
}
