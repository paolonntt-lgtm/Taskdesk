# Studio Paolo — Video social 01/03

## Director's treatment
- **Promise:** Un ticket di assistenza diventa una conversazione chiara, con una persona che segue il problema fino alla soluzione.
- **Identity:** Product Explainer: slate profondo `#0B1220`, griglia d'ingegneria e bagliore blu `#3B82F6`, testo avorio freddo; Space Grotesk per display e DM Sans per interfaccia.
- **Hero:** Una scheda ticket realistica, con profili fotografici di Giulia e Marco e messaggi in italiano.
- **Motion:** Ritagli macro del ticket, split che mette in relazione problema e risposta, pannello UI con annotazioni che tracciano il flusso.
- **Arc:** Un hook grafico apre il problema concreto; la conversazione prende forma in campi diversi; il ticket si risolve e ricompone in un lockup editoriale.
- **Payoff:** La scheda si chiude e il segno blu del ticket diventa la sottolineatura della firma Studio Paolo.
- **Formato:** 16:9, video social orizzontale.
- **Durata:** 21 secondi, cinque scene.

## Timeline

| # | Tempo | Fuoco | Azione dominante | Composizione / handoff |
|---|---:|---|---|---|
| 1 | 0.000–3.250 | Il problema: accesso bloccato | Tre scatti tipografici e card-ticket che si apre | Macro sbilanciata a sinistra; il campo blu del ticket cresce nel pannello successivo |
| 2 | 3.250–7.500 | La richiesta di Giulia | Ritratto e testo del ticket si rivelano con maschere opposte | Scheda larga e bassa; il badge “APERTA” si ingrandisce nel match cut |
| 3 | 7.500–12.550 | La conversazione | I messaggi di Giulia e Marco compaiono come una coppia di scambi | Due colonne sfalsate; la regola blu diventa il cursore d'annotazione |
| 4 | 12.550–17.450 | La soluzione | Il badge passa ad “RISOLTA”; una linea collega diagnosi e risultato | Primo piano centrale sulla scheda; il cerchio dello stato si espande in campo pieno |
| 5 | 17.450–21.818 | Chiusura | Le schede collassano in una firma Studio Paolo | Campo avorio/slate, scala tipografica radicalmente diversa; underline blu prepara il ritorno all'hook |

## Script completo

### Shot 01 / 0.000–3.250s / 3.250s — “NON SI APRE.”
**Scopo:** Dare un problema concreto e riconoscibile in meno di un secondo.
**Composizione e idea:** Fondo Product Explainer slate, griglia sottile e luce blu contenuta. Macro tipografica asimmetrica: la parola «NON» occupa la sinistra; a destra, una scheda ticket angolata di pochi gradi mostra un loader staticamente disegnato che si ferma e diventa un punto di errore. La finestra del browser è una forma d'interfaccia, non una schermata promozionale.
**Testo esatto:** a 0.08s tag «STUDIO PAOLO / SUPPORTO»; a 0.12s «NON» (3.1vmin? no: hero 31vmin) scatta in scala; a 0.53s «SI APRE.» sostituisce la parola secondaria con una maschera verticale; a 1.30s compare «Un accesso bloccato. Una persona che risponde.» in 3.2vmin; nella card compare «Portale clienti» e «La pagina resta in caricamento».
**Coreografia:** 0.00–0.25s la griglia e il tratto blu si accendono; 0.12–0.35s “NON” fa un pop rigido; 0.55s “SI APRE.” batte a destra; 1.15–2.00s la card si dispiega in prospettiva e il loader interrompe la rotazione; 2.00–2.65s appare il sottotitolo; 2.80–3.50s la card fa push verso la camera e la barra blu corre verso destra, senza lasciare un frame vuoto.
**Handoff:** La barra blu termina esattamente sul bordo superiore della card larga del ticket nello Shot 02; push-through breve e taglio interno sullo stesso angolo.
**Asset e tecnica:** CSS per griglia e UI, clip-path, letter spacing condensata, easing snap/circOut. Nessun nuovo asset.
**Audio:** Musica strumentale; colpo iniziale e accento previsto a 3.5s, da verificare dopo la generazione.

### Shot 02 / 3.250–7.500s / 4.250s — “LA RICHIESTA.”
**Scopo:** Rendere il ticket specifico e umano, non una schermata finta generica.
**Composizione e idea:** Taglio sul ticket che occupa il 64% dell'altezza breve: header in alto e ritratto di Giulia sulla destra; la frase del problema si scompone in righe a sinistra come se un'attività venisse organizzata, non digitata. Badge stato “APERTA” all'estremo alto.
**Testo esatto:** 3.41s «TICKET #SP-1842»; 3.66s «ACCESSO AL PORTALE CLIENTI»; 4.21s «Giulia Rossi» / «Cliente · oggi, 09:14»; 4.66s «Da stamattina non riesco ad accedere al portale clienti. Dopo la password la pagina resta in caricamento. Ho una fattura da scaricare entro oggi.»; 5.91s badge «APERTA»; 6.46s etichetta «Assegnato a Marco Bianchi».
**Coreografia:** 0.00–0.35s il badge “APERTA” si assesta dal push precedente; 0.25–0.75s l'header si disegna a scatti; 0.45–1.15s il ritratto di Giulia emerge dalla maschera circolare, con una sottile linea che traccia verso il nome; 1.1–1.85s le righe della richiesta si aprono in tre gruppi; 2.25s numero ticket gira in una piccola rotazione 3D; 2.7–3.4s la riga assegnatario attraversa il pannello; negli ultimi 0.6s il badge “APERTA” scala fino a diventare l'inizio del taglio successivo.
**Handoff:** Il badge blu mantiene posizione e dimensione relativa, si divide orizzontalmente in due metà e lascia emergere due bolle-messaggio.
**Asset e tecnica:** Foto profilo già fornite: `public/images/studio-paolo-giulia.png`; foto come ritratto reale ritagliato in cerchio dentro il mock UI; maschere e linee SVG.
**Audio:** Musica continua; accento beat al passaggio badge / messaggi pianificato, beat alignment da verificare.

### Shot 03 / 7.500–12.550s / 5.050s — “UNA RISPOSTA, POI UN’ALTRA.”
**Scopo:** Mostrare un supporto con scambio credibile, non una risposta miracolosa.
**Composizione e idea:** Cambio di medium e struttura: due grandi colonne di messaggi, dialogo sfalsato su slate, con le foto profilo che agiscono da ancore. La risposta di Marco è blu elettrico smorzato, quella di Giulia una superficie più chiara. I messaggi non si accatastano: ciascun turno occupa il centro in sequenza, come schede che si ribaltano sul proprio asse.
**Testo esatto:** 7.70s «Marco · Supporto»; 8.00s «Ciao Giulia, verifico subito. Intanto puoi provare una finestra in incognito?»; 9.65s «Giulia · Cliente»; 9.90s «In incognito funziona. Dal browser normale invece resta bloccato.»; 11.10s «Il dettaglio giusto cambia tutto.»
**Coreografia:** 0.00–0.30s il badge diviso si apre in due card allineate; 0.35–1.0s card Marco ruota sul bordo, foto e testo si separano di pochi pixel in profondità; 1.3s sottolineatura blu corre sotto «incognito»; 1.65–2.25s il messaggio di Giulia prende il centro e si espande; 2.5–3.05s il secondo messaggio si piega e resta in scala minore; a 3.2s una traccia collega «incognito» al messaggio successivo; 3.65s frase finale appare in una colonna verticale; 4.2–5.0s entrambe le card contraggono in una sola barra che entra nella scheda soluzione.
**Handoff:** La linea di collegamento è il carrier: resta in scena, si raddrizza, e diventa il bordo superiore del pannello risoluzione. La card di Giulia si richiude in uno stato.
**Asset e tecnica:** Ritratti forniti `public/images/studio-paolo-marco.png` e `public/images/studio-paolo-giulia.png`, UI costruita in CSS, ritaglio mascherato, split/flip controllato, stroke SVG.
**Audio:** Musica strumentale; accento per l'ultima linea previsto vicino a 12.5s, da verificare.

### Shot 04 / 12.550–17.450s / 4.900s — “RISOLTA.”
**Scopo:** Far vedere la chiusura del ticket e la spiegazione concreta.
**Composizione e idea:** Inversione verso una tavola larga e quasi centrata: card ticket compatta al centro, un grande “RISOLTA” dietro la scheda in outline, un piccolo schema browser-cache in primo piano. Il cerchio dello stato diventa un timbro grafico, non un pulsante.
**Testo esatto:** 12.60s badge «RISOLTA»; 13.05s «Era la cache del browser.»; 13.85s «Svuotata. Accesso ripristinato.»; 15.15s «Giulia · Perfetto, ora entra. Grazie!»; 16.20s «Il problema seguito fino alla fine.»
**Coreografia:** 0.00–0.30s il carrier-line raddrizzato accende il bordo; 0.20–0.75s il timbro “RISOLTA” si compone con split verticale e ring che si chiude; 0.85s il diagramma cache si frammenta in tre tasselli e si ricompone; 1.15–1.7s le due righe di soluzione arrivano sequenzialmente; 2.0s la conferma Giulia scatta da un cerchio di foto; 2.7s la card si chiude in posizione centrale con luce blu breve; 3.25s la frase di takeaway si unmaschera; ultimi 0.8s il cerchio del timbro scala fino a coprire il campo e trascina la card con sé.
**Handoff:** Il cerchio è carrier esplicito: parte dal badge, scala oltre il frame e si risolve come campo scuro uniforme nello Shot 05, con la card che attraversa il centro.
**Asset e tecnica:** Ritratti locali; elementi vettoriali CSS per la cache e il timbro, text outline con custom property, cerchio-iris.
**Audio:** Musica con accento di stato previsto a 17.0s; nessun VO/SFX richiesto.

### Shot 05 / 17.450–21.818s / 4.368s — “STUDIO PAOLO.”
**Scopo:** Chiudere come un breve video di brand/social, non aggiungere una nuova feature.
**Composizione e idea:** Il cerchio scuro diventa un campo quasi nero; il ticket, ora visto dall'alto, si ripiega in quattro segmenti che diventano la griglia tipografica. Il nome appare grande e asciutto sul lato destro, le ultime due facce utente diventano puntini-foto nella firma, non una griglia di avatar.
**Testo esatto:** 17.70s «STUDIO PAOLO»; 18.30s «Le richieste non restano in sospeso.»; 19.10s etichetta «SUPPORTO · OGNI PASSAGGIO, IN CHIARO»; 19.50s «Dalla richiesta alla soluzione.»; testo tenuto leggibile fino all'inizio della transizione in loop.
**Coreografia:** 0.0–0.35s l'iris si apre verso il campo chiaro; 0.20–0.85s quattro segmenti del ticket si richiudono in un segno quadrato che diventa il punto della firma; 0.60–1.15s il nome entra con due maschere opposte; 1.35s la frase principale si allinea sotto il nome; 2.0s il segno quadrato compie un piccolo scatto e la linea blu si posa sotto il marchio; 2.5s l'etichetta finale risolve; 3.2–4.0s la linea blu corre fuori dal bordo, il lockup si comprime nello stesso “NON” iniziale e il cerchio ritorna al punto di partenza per loop senza frame morto.
**Handoff:** L'underlining blu si verticalizza e torna al piccolo cursore lineare dell'apertura; il punto quadrato diventa il punto di caricamento del browser nel primo shot.
**Asset e tecnica:** Tipografia Space Grotesk / DM Sans, righe, card e maschere. “Studio Paolo” è testo semplice, non un logo inventato.
**Audio:** La musica risolve in chiusura e si riallaccia al beat iniziale; il loop visivo e audio segue il playback del player.

## Varietà e continuità
Le cinque inquadrature alternano macro tipografica, scheda larga fotografica, dialogo a due colonne, timbro centrale e lockup tipografico. Ogni cambio porta un carrier fisico (barra, badge, linea, cerchio, sottolineatura) e combina almeno due meccaniche; nessuna texture di fondo guida più di due scene. L'ultimo 15–20% di ogni shot è movimento di handoff. Gli accenti citati sopra sono provvisori fino all'ascolto/misura del bed.

## Audio spec
- Runtime: 21.818 s (totale SCENE_DURATIONS).
- Music: bed strumentale funk / nu-disco sintetizzato localmente in fallback, 110 BPM, basso caldo e percussione asciutta, sicuro ma umano; tagli sugli attacchi RMS misurati a 3.25, 7.50, 12.55 e 17.45s, con chiusura sul beat 40 (21.818s); senza voce.
- Voiceover: non richiesto.
- SFX: non richiesti.
- Playback file: `public/audio/bg_music.mp3`. La generazione audio via callback è stata bloccata dalla richiesta di attivare una modalità a pagamento senza conferma; è stato prodotto un bed strumentale locale in fallback.
