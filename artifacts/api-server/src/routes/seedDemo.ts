import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, ticketsTable, ticketCommentsTable, inboundEmailChannelsTable } from "@workspace/db";
import { hashPassword } from "./auth";

const router: IRouter = Router();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

router.post("/seed-demo", async (req: Request, res: Response): Promise<void> => {
  const secret = req.headers["x-seed-secret"];
  if (!secret || secret !== process.env.SEED_SECRET) {
    res.status(401).json({ message: "Non autorizzato" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, "demo.admin@taskdesk.it"));

  if (existing.length > 0) {
    res.json({ message: "Demo già presente", skipped: true });
    return;
  }

  const pw = await hashPassword("Demo2024!");

  const [admin] = await db.insert(usersTable).values({
    name: "Marco Bianchi",
    email: "demo.admin@taskdesk.it",
    passwordHash: pw,
    role: "admin",
    mainLocation: "Milano",
    group: "IT",
    isActive: true,
  }).returning();

  const [tech] = await db.insert(usersTable).values({
    name: "Giulia Ferrari",
    email: "demo.tecnico@taskdesk.it",
    passwordHash: pw,
    role: "user",
    mainLocation: "Roma",
    group: "IT",
    isActive: true,
  }).returning();

  const [user1] = await db.insert(usersTable).values({
    name: "Luca Marino",
    email: "demo.utente@taskdesk.it",
    passwordHash: pw,
    role: "user",
    mainLocation: "Milano",
    group: "Amministrazione",
    isActive: true,
  }).returning();

  // Create demo inbound email channels
  const [channelIT, channelGeneral] = await db.insert(inboundEmailChannelsTable).values([
    {
      organizationId: admin.organizationId!,
      label: "Supporto IT",
      token: `demo-it-${admin.id}-${Date.now()}`,
      defaultCategory: "Informatica",
      defaultGroup: "IT",
      enabled: true,
    },
    {
      organizationId: admin.organizationId!,
      label: "Assistenza Generale",
      token: `demo-gen-${admin.id}-${Date.now()}`,
      defaultCategory: null,
      defaultGroup: null,
      enabled: true,
    },
  ]).returning();

  const ticketData = [
    {
      title: "Stampante Ufficio 3 non risponde",
      description: "La stampante HP LaserJet al terzo piano non stampa. Il LED lampeggia in arancione e il documento rimane in coda.",
      category: "Informatica",
      location: "Milano",
      resource: "Stampante HP LaserJet 4015",
      priority: "high" as const,
      status: "open" as const,
      createdBy: user1.id,
      assignedTo: tech.id,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      title: "Account email bloccato dopo cambio password",
      description: "Dopo aver cambiato la password questa mattina, non riesco più ad accedere all'email aziendale da Outlook.",
      category: "Informatica",
      location: "Roma",
      priority: "urgent" as const,
      status: "waiting" as const,
      createdBy: user1.id,
      assignedTo: tech.id,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      title: "Richiesta nuovo monitor per postazione sviluppo",
      description: "Richiedo un secondo monitor (minimo 24\") per la postazione di sviluppo. Attualmente lavoro con un solo schermo e la produttività è ridotta.",
      category: "Attrezzatura",
      location: "Milano",
      priority: "medium" as const,
      status: "waiting" as const,
      createdBy: user1.id,
      assignedTo: admin.id,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(3),
    },
    {
      title: "VPN aziendale non si connette da remoto",
      description: "Lavorando da casa non riesco a connettermi alla VPN. L'errore è \"Authentication failed\" anche con le credenziali corrette.",
      category: "Informatica",
      location: "Milano",
      priority: "urgent" as const,
      status: "open" as const,
      createdBy: tech.id,
      assignedTo: admin.id,
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      title: "Aggiornamento software gestionale ver. 4.2",
      description: "Pianificare e distribuire l'aggiornamento del gestionale alla versione 4.2 su tutti i client dell'ufficio amministrativo.",
      category: "Software",
      location: "Roma",
      priority: "medium" as const,
      status: "waiting" as const,
      createdBy: admin.id,
      assignedTo: tech.id,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(2),
    },
    {
      title: "Tastiera e mouse wireless non funzionanti",
      description: "Il set tastiera/mouse wireless Logitech sulla postazione 12 non risponde. Ho cambiato le batterie ma il problema persiste.",
      category: "Attrezzatura",
      location: "Milano",
      resource: "Postazione 12",
      priority: "low" as const,
      status: "resolved" as const,
      createdBy: user1.id,
      assignedTo: tech.id,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(8),
      closedAt: daysAgo(8),
      resolutionNote: "Sostituito il ricevitore USB. Periferica funzionante.",
    },
    {
      title: "Backup automatico non eseguito da 3 giorni",
      description: "Il sistema di backup notturno non ha eseguito correttamente le ultime 3 sessioni. Verificare log e ripristinare il servizio.",
      category: "Informatica",
      location: "Milano",
      priority: "high" as const,
      status: "waiting" as const,
      createdBy: admin.id,
      assignedTo: tech.id,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(1),
    },
    {
      title: "Accesso al portale fornitori negato",
      description: "Non riesco ad accedere al portale fornitori per inserire un nuovo ordine. La pagina restituisce errore 403.",
      category: "Software",
      location: "Roma",
      priority: "medium" as const,
      status: "open" as const,
      createdBy: user1.id,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      title: "Proiettore sala riunioni B non si accende",
      description: "Il proiettore Epson della sala riunioni B non si accende. Serve per una presentazione domani mattina.",
      category: "Attrezzatura",
      location: "Milano",
      resource: "Sala Riunioni B",
      priority: "high" as const,
      status: "resolved" as const,
      createdBy: user1.id,
      assignedTo: tech.id,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(5),
      closedAt: daysAgo(5),
      resolutionNote: "Il cavo HDMI era guasto. Sostituito con spare disponibile in magazzino.",
    },
    {
      title: "Configurazione firma email per nuovi assunti",
      description: "Configurare la firma email aziendale standard per i 3 nuovi assunti del reparto commerciale: F. Conti, A. De Luca, M. Esposito.",
      category: "Informatica",
      location: "Roma",
      priority: "low" as const,
      status: "open" as const,
      createdBy: admin.id,
      assignedTo: tech.id,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      title: "PC lento all'avvio — postazione contabilità",
      description: "Il PC della signora Russo (contabilità) impiega oltre 10 minuti per avviarsi. Il problema persiste da circa una settimana.",
      category: "Informatica",
      location: "Roma",
      resource: "PC-CONT-007",
      priority: "medium" as const,
      status: "waiting" as const,
      createdBy: user1.id,
      assignedTo: tech.id,
      createdAt: daysAgo(8),
      updatedAt: daysAgo(6),
    },
    {
      title: "Installazione software CAD su nuova workstation",
      description: "Installare AutoCAD 2024 e licenze correlate sulla nuova workstation del reparto tecnico. Codice licenza in allegato.",
      category: "Software",
      location: "Milano",
      priority: "medium" as const,
      status: "resolved" as const,
      createdBy: admin.id,
      assignedTo: tech.id,
      createdAt: daysAgo(14),
      updatedAt: daysAgo(12),
      closedAt: daysAgo(12),
      resolutionNote: "Software installato e attivato correttamente. Test completato con l'utente.",
    },
    {
      title: "Problema accesso al gestionale dopo aggiornamento",
      description: "Buongiorno, dopo l'aggiornamento di ieri non riesco più ad accedere al gestionale. Il sistema mostra un errore di autenticazione. Potete aiutarmi?\n\nGrazie,\nMaria Conti",
      category: "Informatica",
      location: "Milano",
      resource: "maria.conti@acmecorp.it",
      priority: "high" as const,
      status: "open" as const,
      createdBy: admin.id,
      assignedTo: tech.id,
      inboundChannelId: channelIT.id,
      emailMessageId: `email-demo-${Date.now()}-1@acmecorp.it`,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      title: "Richiesta accesso VPN per lavoro da remoto",
      description: "Salve, sono un nuovo assunto del reparto commerciale e ho bisogno di accedere alla VPN per lavorare da casa. Come posso procedere?\n\nGrazie,\nFrancesco Belli",
      category: "Informatica",
      location: "Roma",
      resource: "f.belli@partner-agency.com",
      priority: "medium" as const,
      status: "waiting" as const,
      createdBy: admin.id,
      assignedTo: tech.id,
      inboundChannelId: channelGeneral.id,
      emailMessageId: `email-demo-${Date.now()}-2@partner-agency.com`,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
  ];

  const insertedTickets = await db.insert(ticketsTable).values(ticketData).returning();

  const comments = [
    {
      ticketId: insertedTickets[0].id,
      authorId: tech.id,
      commentText: "Ho verificato: la coda di stampa è bloccata. Sto procedendo con il reset del servizio spooler.",
      createdAt: daysAgo(1),
    },
    {
      ticketId: insertedTickets[1].id,
      authorId: tech.id,
      commentText: "Il token MFA risulta desincronizzato. Ho avviato la procedura di reset. Riprova tra 5 minuti.",
      createdAt: daysAgo(2),
    },
    {
      ticketId: insertedTickets[1].id,
      authorId: user1.id,
      commentText: "Perfetto, ora funziona. Grazie!",
      createdAt: daysAgo(1),
    },
    {
      ticketId: insertedTickets[4].id,
      authorId: tech.id,
      commentText: "Aggiornamento completato su 8 dei 12 client. Proseguo domani con i restanti durante la pausa pranzo.",
      createdAt: daysAgo(3),
    },
    {
      ticketId: insertedTickets[6].id,
      authorId: tech.id,
      commentText: "Il servizio di backup era in stato 'paused' per un errore di spazio su disco. Ho liberato 40GB e riavviato il job. Monitoraggio in corso.",
      createdAt: daysAgo(2),
    },
    {
      ticketId: insertedTickets[6].id,
      authorId: admin.id,
      commentText: "Ottimo. Verifica che anche il backup differenziale di ieri notte sia andato a buon fine.",
      createdAt: daysAgo(1),
    },
  ];

  await db.insert(ticketCommentsTable).values(comments);

  res.json({
    message: "Demo creato con successo",
    users: [
      { email: "demo.admin@taskdesk.it", password: "Demo2024!", role: "admin" },
      { email: "demo.tecnico@taskdesk.it", password: "Demo2024!", role: "tecnico" },
      { email: "demo.utente@taskdesk.it", password: "Demo2024!", role: "utente" },
    ],
    tickets: insertedTickets.length,
  });
});

export default router;
