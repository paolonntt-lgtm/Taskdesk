export type ProfessionId =
  | "commercialisti"
  | "avvocati"
  | "consulenti-del-lavoro"
  | "helpdesk-it"
  | "agenzie";
export type ProfessionLanguage = "it" | "en";

export interface ProfessionExample {
  title: string;
  description: string;
  tag: string;
}

export interface ProfessionUseCase {
  title: string;
  description: string;
}

export interface ProfessionPageCopy {
  name: string;
  navLabel: string;
  eyebrow: string;
  headline: string;
  intro: string;
  primaryCta: string;
  reassurance: string;
  useCasesHeading: string;
  useCasesIntro: string;
  useCases: ProfessionUseCase[];
  examplesHeading: string;
  examplesIntro: string;
  examples: ProfessionExample[];
  messageHeading: string;
  messageBody: string;
  workflowHeading: string;
  workflowSteps: string[];
  boundaryNote: string;
  pricingHeading: string;
  pricingIntro: string;
  relatedHeading: string;
  homeLink: string;
  finalHeading: string;
  finalBody: string;
}

export const PROFESSIONS: Record<ProfessionId, Record<ProfessionLanguage, ProfessionPageCopy>> = {
  commercialisti: {
    it: {
      name: "Commercialisti",
      navLabel: "Commercialisti",
      eyebrow: "Per studi di commercialisti",
      headline: "Ogni scadenza cliente, al posto giusto.",
      intro: "Dalla richiesta di un documento alla chiusura di una pratica: TaskDesk aiuta lo studio a raccogliere il lavoro in ingresso, assegnarlo al team e tenere visibile il prossimo passo.",
      primaryCta: "Prova TaskDesk",
      reassurance: "Organizzazione dello studio, senza cambiare il tuo software contabile.",
      useCasesHeading: "Il lavoro ricorrente, senza rincorrere le informazioni.",
      useCasesIntro: "Uno spazio condiviso per richieste e attività che oggi arrivano da email, telefonate e messaggi sparsi.",
      useCases: [
        { title: "Documenti per le scadenze", description: "Raccogli richieste di CU, fatture o documentazione per una dichiarazione, con responsabile e data attesa ben visibili." },
        { title: "Adempimenti ricorrenti", description: "Tieni insieme le attività periodiche di ciascun cliente: apertura, assegnazione, aggiornamenti e completamento." },
        { title: "Domande che diventano attività", description: "Trasforma una richiesta arrivata via email in un caso tracciabile, con conversazione e allegati collegati." },
      ],
      examplesHeading: "Richieste che il team riconosce subito.",
      examplesIntro: "Esempi quotidiani di lavoro organizzabile con TaskDesk, non consulenza fiscale automatizzata.",
      examples: [
        { title: "Invio documenti per la dichiarazione", description: "Il cliente carica la documentazione mancante; lo studio assegna la verifica e registra cosa resta da ricevere.", tag: "Documenti cliente" },
        { title: "Richiesta di registrazione fattura", description: "Una fattura da controllare entra nella coda corretta, con il referente e la conversazione già associati.", tag: "Contabilità" },
        { title: "Avvio pratica di apertura attività", description: "Il team raccoglie i dati iniziali e coordina i passaggi interni senza perdere gli aggiornamenti tra una casella email e l’altra.", tag: "Nuovo incarico" },
      ],
      messageHeading: "Meno “a che punto siamo?”, più chiarezza sul prossimo passo.",
      messageBody: "Ogni richiesta ha un responsabile, uno stato e una cronologia consultabile. Così il team può rispondere con contesto e il cliente non deve ricostruire la conversazione da capo.",
      workflowHeading: "Una routine semplice per lo studio.",
      workflowSteps: ["Il cliente invia una richiesta o un documento.", "Lo studio assegna il lavoro alla persona giusta.", "Stato, scadenza e conversazione restano collegati."],
      boundaryNote: "TaskDesk organizza richieste, attività e comunicazioni. Non fornisce consulenza fiscale e non sostituisce il gestionale o gli strumenti professionali dello studio.",
      pricingHeading: "Un piano che segue la dimensione del tuo studio.",
      pricingIntro: "Scegli il numero di postazioni adatto al team. Prova TaskDesk e valuta il flusso di lavoro con i tuoi casi reali.",
      relatedHeading: "Scopri TaskDesk anche per altri studi",
      homeLink: "Vai alla pagina generale di TaskDesk",
      finalHeading: "Porta ordine nelle richieste del tuo studio.",
      finalBody: "Inizia da una richiesta reale e rendi visibile il lavoro che viene dopo.",
    },
    en: {
      name: "Accountants",
      navLabel: "Accountants",
      eyebrow: "For accounting practices",
      headline: "Put every client deadline in its place.",
      intro: "From a missing document to a new engagement, TaskDesk gives your practice one clear way to collect incoming work, assign it across the team and keep the next step in view.",
      primaryCta: "Try TaskDesk",
      reassurance: "A clearer way to run requests, alongside your accounting software.",
      useCasesHeading: "Recurring work, without chasing the context.",
      useCasesIntro: "Bring requests and follow-up tasks together when they currently arrive through inboxes, calls and scattered messages.",
      useCases: [
        { title: "Documents ahead of deadlines", description: "Collect a client’s tax-return or payroll documents in one request, with an owner and expected date the team can see." },
        { title: "Repeatable client work", description: "Keep each client’s recurring tasks together, from opening and assignment through updates and completion." },
        { title: "Turn questions into owned work", description: "Move an email request into a trackable case, with its attachments and conversation connected." },
      ],
      examplesHeading: "Familiar requests, easier to pick up.",
      examplesIntro: "Everyday examples your team can organise in TaskDesk—not automated tax advice.",
      examples: [
        { title: "Collecting tax-return documents", description: "A client sends the missing records; the practice assigns a review and notes what is still outstanding.", tag: "Client documents" },
        { title: "Invoice-entry question", description: "An invoice to review reaches the right work queue, already linked to its client contact and discussion.", tag: "Bookkeeping" },
        { title: "Starting a new business engagement", description: "The team gathers initial details and coordinates internal steps without losing updates between inboxes.", tag: "New engagement" },
      ],
      messageHeading: "Fewer “where are we?” messages. A clearer next step.",
      messageBody: "Each request has an owner, a status and a history the team can revisit. That makes it easier to reply with context instead of reconstructing a conversation from scratch.",
      workflowHeading: "A practical rhythm for your practice.",
      workflowSteps: ["A client sends a request or a document.", "Your team assigns it to the right person.", "Status, due date and conversation stay together."],
      boundaryNote: "TaskDesk organises requests, tasks and communication. It does not provide tax advice or replace your practice-management or accounting tools.",
      pricingHeading: "A plan that fits the size of your practice.",
      pricingIntro: "Choose the number of seats that suits your team. Try TaskDesk with real requests from your day-to-day work.",
      relatedHeading: "See TaskDesk for other professional firms",
      homeLink: "Visit the TaskDesk overview",
      finalHeading: "Bring order to your practice’s incoming work.",
      finalBody: "Start with one real request and make the next step visible to everyone.",
    },
  },
  avvocati: {
    it: {
      name: "Avvocati",
      navLabel: "Avvocati",
      eyebrow: "Per studi legali",
      headline: "Le comunicazioni di una pratica, finalmente insieme.",
      intro: "Quando una pratica si muove tra clienti, collaboratori e scadenze, il contesto non dovrebbe restare in una casella personale. TaskDesk organizza richieste, assegnazioni e aggiornamenti in un unico flusso di lavoro.",
      primaryCta: "Prova TaskDesk",
      reassurance: "Più controllo operativo, senza sostituire il gestionale legale.",
      useCasesHeading: "Dalla prima richiesta al prossimo aggiornamento.",
      useCasesIntro: "Organizza la collaborazione quotidiana dello studio e mantieni il filo delle comunicazioni legate a ciascun caso.",
      useCases: [
        { title: "Nuove richieste e verifiche preliminari", description: "Raccogli il motivo del contatto, i documenti iniziali e chi deve ricontattare il potenziale cliente." },
        { title: "Attività e scadenze di pratica", description: "Assegna una ricerca, una raccolta documentale o un aggiornamento al cliente, con responsabilità e stato condivisi." },
        { title: "Comunicazioni collegate al caso", description: "Tieni le domande e le risposte nel contesto della richiesta, così chi subentra trova la cronologia." },
      ],
      examplesHeading: "Esempi concreti di coordinamento.",
      examplesIntro: "TaskDesk aiuta a gestire il lavoro operativo dello studio, lasciando valutazioni e decisioni professionali ai legali.",
      examples: [
        { title: "Richiesta di revisione di un contratto", description: "Il documento e le domande del cliente vengono raccolti insieme, poi assegnati al professionista incaricato.", tag: "Contrattualistica" },
        { title: "Aggiornamento su una pratica in corso", description: "Una domanda ricevuta via email diventa un’attività con referente, priorità e risposta tracciabile.", tag: "Relazione cliente" },
        { title: "Preparazione dei documenti per un incontro", description: "Il team coordina raccolta e revisione dei materiali prima dell’appuntamento, senza passaggi dispersi.", tag: "Preparazione" },
      ],
      messageHeading: "Il caso resta leggibile anche quando cambia chi lo segue.",
      messageBody: "Con assegnatario, stato e conversazione nello stesso posto, lo studio vede cosa è in attesa e chi deve muoversi. Meno ricostruzioni interne, più continuità nel servizio al cliente.",
      workflowHeading: "Dal contatto al lavoro assegnato.",
      workflowSteps: ["Una richiesta e i relativi materiali vengono raccolti.", "Il referente assegna il prossimo passaggio al team.", "Il cliente e i colleghi ritrovano gli aggiornamenti nello stesso caso."],
      boundaryNote: "TaskDesk supporta l’organizzazione delle richieste e del lavoro. Non fornisce consulenza legale, non valuta i casi e non sostituisce gli strumenti professionali dello studio.",
      pricingHeading: "Postazioni per il tuo modo di lavorare.",
      pricingIntro: "Confronta i piani in base al numero di persone che collaborano sulle richieste. Avvia la prova con un flusso reale dello studio.",
      relatedHeading: "Scopri TaskDesk anche per altri studi",
      homeLink: "Vai alla pagina generale di TaskDesk",
      finalHeading: "Dai a ogni pratica un filo di lavoro condiviso.",
      finalBody: "Raccogli il prossimo aggiornamento, assegnalo e tienilo nel suo contesto.",
    },
    en: {
      name: "Law firms",
      navLabel: "Law firms",
      eyebrow: "For legal practices",
      headline: "Keep every matter’s conversations together.",
      intro: "When a matter moves between clients, colleagues and deadlines, its context should not live in one person’s inbox. TaskDesk organises requests, ownership and updates in a shared workflow.",
      primaryCta: "Try TaskDesk",
      reassurance: "More operational visibility, without replacing your legal practice software.",
      useCasesHeading: "From the first enquiry to the next client update.",
      useCasesIntro: "Coordinate the firm’s day-to-day work and keep each conversation connected to the matter it belongs to.",
      useCases: [
        { title: "New enquiries and intake", description: "Capture why someone got in touch, the first documents received and who will follow up." },
        { title: "Matter tasks and due dates", description: "Assign research, document collection or a client update with clear ownership and shared status." },
        { title: "Conversations connected to a case", description: "Keep questions and replies with the request, so a colleague stepping in can find the history." },
      ],
      examplesHeading: "Everyday coordination, made visible.",
      examplesIntro: "TaskDesk helps organise a firm’s operations while legal judgement and decisions stay with its professionals.",
      examples: [
        { title: "Request to review an agreement", description: "The client’s document and questions arrive together, then go to the lawyer responsible for the review.", tag: "Contracts" },
        { title: "A client asks for a matter update", description: "An email becomes an owned task with priority, a clear point person and a traceable reply.", tag: "Client communication" },
        { title: "Preparing materials for a meeting", description: "Colleagues coordinate collecting and reviewing documents before the appointment, without scattered hand-offs.", tag: "Preparation" },
      ],
      messageHeading: "The matter stays clear when its owner changes.",
      messageBody: "With an owner, status and conversation in one place, the firm can see what is waiting and who needs to act. Less internal reconstruction, more continuity for the client.",
      workflowHeading: "Turn an enquiry into owned work.",
      workflowSteps: ["Collect a request and its supporting materials.", "Assign the next action to the right colleague.", "Keep client and team updates with the same case."],
      boundaryNote: "TaskDesk supports request and workflow organisation. It does not provide legal advice, assess matters or replace a firm’s professional tools.",
      pricingHeading: "Seats for the way your firm works.",
      pricingIntro: "Compare plans by the number of people coordinating requests. Start a trial with a real workflow from your firm.",
      relatedHeading: "See TaskDesk for other professional firms",
      homeLink: "Visit the TaskDesk overview",
      finalHeading: "Give every matter a shared thread of work.",
      finalBody: "Capture the next update, assign it and keep it in context.",
    },
  },
  "consulenti-del-lavoro": {
    it: {
      name: "Consulenti del lavoro",
      navLabel: "Consulenti del lavoro",
      eyebrow: "Per studi di consulenza del lavoro",
      headline: "Le richieste del personale, con un prossimo passo chiaro.",
      intro: "Assunzioni, variazioni e documenti dei dipendenti generano continui passaggi tra azienda e studio. TaskDesk aiuta a raccogliere ogni richiesta, assegnarla e tenere aggiornati tutti i referenti.",
      primaryCta: "Prova TaskDesk",
      reassurance: "Un flusso più ordinato, accanto al software paghe che già usi.",
      useCasesHeading: "Coordinare le persone dietro ogni adempimento.",
      useCasesIntro: "Dai dati da chiedere all’azienda agli aggiornamenti da inviare: rendi esplicito chi sta seguendo ogni passaggio.",
      useCases: [
        { title: "Avvio di un’assunzione", description: "Raccogli dati e documenti richiesti all’azienda, assegna le verifiche interne e segnala ciò che manca." },
        { title: "Variazioni e comunicazioni", description: "Tieni traccia di una variazione anagrafica o contrattuale, dei referenti coinvolti e della risposta inviata." },
        { title: "Richieste ricorrenti delle aziende", description: "Organizza dubbi su cedolini, presenze o documenti del personale come richieste con responsabile e cronologia." },
      ],
      examplesHeading: "Dal dato mancante alla richiesta completata.",
      examplesIntro: "Esempi di coordinamento amministrativo: le valutazioni e gli adempimenti restano affidati ai professionisti e ai loro strumenti.",
      examples: [
        { title: "Documenti per una nuova assunzione", description: "L’azienda invia i dati iniziali, lo studio assegna i controlli e mantiene visibile la documentazione ancora da ricevere.", tag: "Assunzioni" },
        { title: "Aggiornamento di una variazione", description: "La richiesta di modifica viene collegata al referente aziendale, alla persona incaricata e alle comunicazioni successive.", tag: "Variazioni" },
        { title: "Domanda su presenze e cedolino", description: "Una domanda urgente viene instradata al membro del team competente, senza separare la risposta dal contesto.", tag: "Richieste azienda" },
      ],
      messageHeading: "Più continuità tra studio, azienda e collaboratori.",
      messageBody: "Ogni passaggio ha un responsabile e una traccia consultabile. Il team capisce cosa attende una risposta dell’azienda e cosa è già stato preso in carico, anche nei periodi più intensi.",
      workflowHeading: "Una richiesta, tre passaggi visibili.",
      workflowSteps: ["L’azienda invia dati, documenti o una domanda.", "Lo studio assegna verifiche e attività al team.", "Stato e comunicazioni restano collegati fino alla chiusura."],
      boundaryNote: "TaskDesk organizza le richieste e il coordinamento. Non elabora paghe, non fornisce consulenza del lavoro e non sostituisce il software professionale dello studio.",
      pricingHeading: "Scegli il piano per il tuo team.",
      pricingIntro: "I piani condivisi di TaskDesk si adattano a team di dimensioni diverse. Valuta la prova con le richieste che lo studio gestisce ogni giorno.",
      relatedHeading: "Scopri TaskDesk anche per altri studi",
      homeLink: "Vai alla pagina generale di TaskDesk",
      finalHeading: "Rendi visibile ogni passaggio tra studio e azienda.",
      finalBody: "Inizia da una richiesta ricorrente e dai al team un punto condiviso da cui proseguire.",
    },
    en: {
      name: "Labour consultants",
      navLabel: "Labour consultants",
      eyebrow: "For employment advisory firms",
      headline: "Give every people request a clear next step.",
      intro: "Hiring, employee changes and document requests create constant hand-offs between a business and its adviser. TaskDesk helps collect each request, assign it and keep the right people up to date.",
      primaryCta: "Try TaskDesk",
      reassurance: "A more organised workflow, alongside the payroll software you already use.",
      useCasesHeading: "Coordinate the people behind every process.",
      useCasesIntro: "From information to request from an employer to the update to send back, make ownership clear at every step.",
      useCases: [
        { title: "Starting a new hire", description: "Gather the details and documents requested from the employer, assign internal checks and flag what is still missing." },
        { title: "Employee changes and updates", description: "Track a personal or contract change, the people involved and the response sent to the business." },
        { title: "Ongoing employer questions", description: "Organise payslip, attendance or employee-document questions as owned requests with a useful history." },
      ],
      examplesHeading: "From missing information to a closed request.",
      examplesIntro: "Examples of administrative coordination; professional judgement and fulfilment remain with the firm and its tools.",
      examples: [
        { title: "Documents for a new hire", description: "A business sends initial details, the firm assigns checks and keeps outstanding documents visible.", tag: "Hiring" },
        { title: "Following up on an employee change", description: "A change request stays connected to its employer contact, assigned colleague and later communication.", tag: "Employee changes" },
        { title: "A question about attendance or a payslip", description: "An urgent question reaches the right team member without separating the reply from its context.", tag: "Employer requests" },
      ],
      messageHeading: "A steadier hand-off between firm, employer and team.",
      messageBody: "Every step has an owner and a history the team can revisit. Colleagues can tell what is waiting on the employer and what is already being handled, even in a busy period.",
      workflowHeading: "One request, three visible steps.",
      workflowSteps: ["The employer sends information, documents or a question.", "The firm assigns checks and tasks across the team.", "Status and communication stay connected through completion."],
      boundaryNote: "TaskDesk organises requests and coordination. It does not process payroll, provide employment advice or replace a firm’s professional software.",
      pricingHeading: "Choose the plan for your team.",
      pricingIntro: "TaskDesk’s shared plans support teams of different sizes. Try it with the requests your firm handles every day.",
      relatedHeading: "See TaskDesk for other professional firms",
      homeLink: "Visit the TaskDesk overview",
      finalHeading: "Make every firm-to-employer hand-off visible.",
      finalBody: "Start with one recurring request and give your team a shared place to pick it up.",
    },
  },
  "helpdesk-it": {
    it: {
      name: "Helpdesk IT",
      navLabel: "Helpdesk IT",
      eyebrow: "Per team di assistenza IT",
      headline: "Ogni richiesta tecnica, con un responsabile e un prossimo passo.",
      intro: "TaskDesk raccoglie richieste di supporto, assegnazioni e aggiornamenti in un flusso condiviso, così il team IT sa cosa è in coda e chi se ne occupa.",
      primaryCta: "Prova TaskDesk",
      reassurance: "Organizza il lavoro di supporto senza sostituire gli strumenti tecnici.",
      useCasesHeading: "Dal problema segnalato alla soluzione condivisa.",
      useCasesIntro: "Tieni insieme richieste, persone coinvolte e passaggi di assistenza.",
      useCases: [
        { title: "Richieste di assistenza", description: "Raccogli segnalazioni e informazioni utili in un ticket assegnabile e aggiornabile." },
        { title: "Interventi e attività interne", description: "Coordina verifiche, manutenzioni e passaggi tra colleghi con responsabili chiari." },
        { title: "Aggiornamenti agli utenti", description: "Mantieni la conversazione legata alla richiesta fino alla chiusura." },
      ],
      examplesHeading: "Un supporto più facile da seguire.",
      examplesIntro: "Esempi di coordinamento del lavoro IT con TaskDesk.",
      examples: [
        { title: "Accesso a un account", description: "La richiesta viene assegnata al referente corretto e resta collegata alle verifiche e alla risposta.", tag: "Account" },
        { title: "Problema con una postazione", description: "Il team registra sintomi, priorità e aggiornamenti senza disperdere informazioni tra chat.", tag: "Assistenza" },
        { title: "Manutenzione programmata", description: "Attività, responsabili e comunicazioni restano visibili fino al completamento.", tag: "Manutenzione" },
      ],
      messageHeading: "Meno richieste perse, più chiarezza sul carico del team.",
      messageBody: "Stato, assegnatario e cronologia aiutano il gruppo a capire cosa è in attesa, cosa è in lavorazione e chi deve aggiornare l’utente.",
      workflowHeading: "Tre passaggi per ogni richiesta.",
      workflowSteps: ["L’utente invia un problema o una richiesta.", "Il team IT assegna il lavoro e coordina le verifiche.", "La risposta e gli aggiornamenti restano nel ticket."],
      boundaryNote: "TaskDesk organizza richieste e comunicazioni. Non monitora infrastrutture, non esegue interventi tecnici e non sostituisce strumenti di helpdesk o monitoraggio.",
      pricingHeading: "Un piano adatto alla dimensione del team.",
      pricingIntro: "Scegli le postazioni per chi gestisce richieste e interventi. Prova il flusso con casi reali del tuo supporto IT.",
      relatedHeading: "Scopri TaskDesk anche per altri team",
      homeLink: "Vai alla pagina generale di TaskDesk",
      finalHeading: "Dai a ogni richiesta IT un prossimo passo chiaro.",
      finalBody: "Inizia da una segnalazione reale e coordina il lavoro in un unico spazio.",
    },
    en: {
      name: "IT Helpdesks",
      navLabel: "IT Helpdesk",
      eyebrow: "For IT support teams",
      headline: "Give every technical request an owner and a next step.",
      intro: "TaskDesk brings support requests, assignments and updates into one shared workflow, so the IT team can see what is waiting and who is handling it.",
      primaryCta: "Try TaskDesk",
      reassurance: "Organise support work alongside your technical tools.",
      useCasesHeading: "From reported issue to shared resolution.",
      useCasesIntro: "Keep requests, people involved and support hand-offs together.",
      useCases: [
        { title: "Support requests", description: "Turn a report and its useful details into an assignable, trackable ticket." },
        { title: "Internal tasks and interventions", description: "Coordinate checks, maintenance and hand-offs with clear ownership." },
        { title: "Updates for users", description: "Keep the conversation connected to the request through resolution." },
      ],
      examplesHeading: "Support work that is easier to follow.",
      examplesIntro: "Examples of IT work coordination with TaskDesk.",
      examples: [
        { title: "Account access request", description: "Assign the request to the right teammate and keep checks and replies connected.", tag: "Accounts" },
        { title: "Workstation issue", description: "Record symptoms, priority and progress without scattering details across chats.", tag: "Support" },
        { title: "Planned maintenance", description: "Keep tasks, owners and communication visible through completion.", tag: "Maintenance" },
      ],
      messageHeading: "Fewer lost requests, a clearer view of team workload.",
      messageBody: "Status, owner and history help the team see what is waiting, what is in progress and who needs to update the user.",
      workflowHeading: "Three clear steps for every request.",
      workflowSteps: ["A user sends an issue or request.", "The IT team assigns work and coordinates checks.", "Replies and updates stay with the ticket."],
      boundaryNote: "TaskDesk organises requests and communication. It does not monitor infrastructure, perform technical interventions or replace helpdesk and monitoring tools.",
      pricingHeading: "A plan that fits your team size.",
      pricingIntro: "Choose seats for the people handling requests and interventions. Try the workflow with real IT support cases.",
      relatedHeading: "See TaskDesk for other teams",
      homeLink: "Visit the TaskDesk overview",
      finalHeading: "Give every IT request a clear next step.",
      finalBody: "Start with a real report and coordinate the work in one place.",
    },
  },
  agenzie: {
    it: {
      name: "Agenzie",
      navLabel: "Agenzie",
      eyebrow: "Per agenzie che lavorano con i clienti",
      headline: "Richieste e consegne, sempre collegate al cliente.",
      intro: "TaskDesk aiuta le agenzie a raccogliere richieste, assegnare attività e seguire approvazioni e aggiornamenti senza perdere il contesto tra clienti e team.",
      primaryCta: "Prova TaskDesk",
      reassurance: "Coordina il lavoro con i clienti senza cambiare i tuoi strumenti creativi.",
      useCasesHeading: "Un flusso condiviso per ogni cliente.",
      useCasesIntro: "Dai brief alle revisioni, mantieni attività e conversazioni nello stesso posto.",
      useCases: [
        { title: "Nuove richieste e brief", description: "Raccogli obiettivi, materiali e informazioni iniziali in una richiesta assegnabile." },
        { title: "Revisioni e approvazioni", description: "Tieni traccia di feedback, responsabili e prossime modifiche." },
        { title: "Attività ricorrenti", description: "Coordina consegne e aggiornamenti periodici tra account e team operativo." },
      ],
      examplesHeading: "Il lavoro dell’agenzia, senza passaggi dispersi.",
      examplesIntro: "Esempi di coordinamento tra clienti, account e collaboratori.",
      examples: [
        { title: "Avvio di un nuovo progetto", description: "Brief, materiali richiesti e assegnazione interna restano collegati fin dal primo giorno.", tag: "Nuovo progetto" },
        { title: "Richiesta di modifica", description: "Il feedback del cliente diventa un’attività chiara con referente e aggiornamenti.", tag: "Revisione" },
        { title: "Consegna in attesa di approvazione", description: "Il team vede cosa deve essere approvato e chi deve ricontattare il cliente.", tag: "Approvazioni" },
      ],
      messageHeading: "Più continuità tra account e team di progetto.",
      messageBody: "Ogni richiesta conserva conversazione, responsabile e stato, così chi subentra può riprendere il lavoro senza ricostruire il contesto.",
      workflowHeading: "Dal brief alla consegna.",
      workflowSteps: ["Il cliente invia una richiesta o un brief.", "L’agenzia assegna attività e revisioni al team.", "Feedback, stato e consegna restano collegati."],
      boundaryNote: "TaskDesk organizza richieste e coordinamento. Non crea contenuti e non sostituisce gli strumenti di project management o produzione dell’agenzia.",
      pricingHeading: "Postazioni per il tuo team.",
      pricingIntro: "Scegli il piano in base alle persone che collaborano sulle richieste dei clienti. Prova TaskDesk con un progetto attivo.",
      relatedHeading: "Scopri TaskDesk anche per altri team",
      homeLink: "Vai alla pagina generale di TaskDesk",
      finalHeading: "Tieni ogni progetto cliente sul binario giusto.",
      finalBody: "Inizia da una richiesta reale e rendi visibili responsabili e prossime consegne.",
    },
    en: {
      name: "Agencies",
      navLabel: "Agencies",
      eyebrow: "For client-service agencies",
      headline: "Keep client requests and deliverables connected.",
      intro: "TaskDesk helps agencies collect requests, assign work and follow approvals and updates without losing context between clients and teams.",
      primaryCta: "Try TaskDesk",
      reassurance: "Coordinate client work alongside your creative tools.",
      useCasesHeading: "One shared workflow for every client.",
      useCasesIntro: "Keep tasks and conversations together from the brief through review.",
      useCases: [
        { title: "New requests and briefs", description: "Collect goals, materials and starting details in an assignable request." },
        { title: "Reviews and approvals", description: "Track feedback, owners and the next revision." },
        { title: "Recurring client work", description: "Coordinate regular deliverables across account and delivery teams." },
      ],
      examplesHeading: "Agency work without scattered hand-offs.",
      examplesIntro: "Examples of coordination between clients, account managers and delivery teams.",
      examples: [
        { title: "Starting a new project", description: "Keep the brief, requested materials and internal assignment connected from day one.", tag: "New project" },
        { title: "A requested revision", description: "Turn client feedback into a clear task with an owner and visible updates.", tag: "Revision" },
        { title: "A deliverable awaiting approval", description: "Show what needs approval and who should follow up with the client.", tag: "Approvals" },
      ],
      messageHeading: "A smoother hand-off between account and delivery teams.",
      messageBody: "Each request keeps its conversation, owner and status together, so anyone stepping in can continue without reconstructing the context.",
      workflowHeading: "From brief to delivery.",
      workflowSteps: ["A client sends a request or brief.", "The agency assigns tasks and reviews across the team.", "Feedback, status and delivery stay connected."],
      boundaryNote: "TaskDesk organises requests and coordination. It does not create content or replace agency project-management and production tools.",
      pricingHeading: "Seats for your team.",
      pricingIntro: "Choose a plan based on the people handling client requests. Try TaskDesk with a project already in progress.",
      relatedHeading: "See TaskDesk for other teams",
      homeLink: "Visit the TaskDesk overview",
      finalHeading: "Keep every client project moving.",
      finalBody: "Start with a real request and make owners and upcoming deliverables visible.",
    },
  },
};
