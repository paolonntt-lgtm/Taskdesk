# TaskDesk — Cloudflare Email Worker

Questo Worker riceve le email in arrivo tramite **Cloudflare Email Routing** e le
inoltra al webhook del server TaskDesk, che le converte in ticket.

## Prerequisiti

- Account Cloudflare con Email Routing attivo sul dominio `taskdesk.uk`
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installato
- Accesso al pannello Cloudflare

---

## Deploy passo per passo

### 1. Installa le dipendenze

```bash
npm install -g wrangler
wrangler login
```

### 2. Entra nella cartella del Worker

```bash
cd cloudflare-worker/email-worker
```

### 3. Configura i segreti

```bash
wrangler secret put WEBHOOK_URL
# → inserisci: https://www.taskdesk.it/api/inbound-email

wrangler secret put WEBHOOK_TOKEN
# → inserisci il valore di INBOUND_EMAIL_TOKEN dall'ambiente del server
```

Il valore di `INBOUND_EMAIL_TOKEN` è già configurato nell'API server.
Puoi leggerlo dalla pagina "Secrets" di Replit.

### 4. Deploy del Worker

```bash
wrangler deploy
```

### 5. Configura Email Routing su Cloudflare

1. Vai su **Cloudflare Dashboard → taskdesk.uk → Email → Email Routing**
2. Assicurati che Email Routing sia **abilitato** (record MX automatici)
3. Vai su **Routes** e aggiungi una regola:
   - **Expression**: `*@taskdesk.uk` (cattura tutti gli indirizzi)
   - **Action**: Send to Worker → `taskdesk-email-inbound`

---

## Come funziona

```
Email inviata a tickets-abc123@taskdesk.uk
        ↓
Cloudflare Email Routing (MX records su taskdesk.uk)
        ↓
Questo Worker (taskdesk-email-inbound)
        ↓
POST https://www.taskdesk.it/api/inbound-email?token=<TOKEN>
        ↓
Il server crea/aggiorna il ticket
```

## Debug

I log del Worker sono visibili su:
**Cloudflare Dashboard → Workers & Pages → taskdesk-email-inbound → Logs**

Se il webhook risponde con errore, il Worker rilanciò l'eccezione e Cloudflare
logga il dettaglio.
