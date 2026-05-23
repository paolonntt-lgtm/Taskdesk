/**
 * TaskDesk — Cloudflare Email Worker
 *
 * Required Worker secrets (Cloudflare dashboard → Worker → Settings → Variables):
 *   WEBHOOK_URL         — https://www.taskdesk.it/api/inbound-email
 *   INBOUND_EMAIL_TOKEN — valore di INBOUND_EMAIL_TOKEN dall'API server
 */
export default {
  async email(message, env, _ctx) {
    if (!env.WEBHOOK_URL || !env.INBOUND_EMAIL_TOKEN) {
      throw new Error(
        "Secrets WEBHOOK_URL e INBOUND_EMAIL_TOKEN non configurati nel Worker"
      );
    }

    // Legge il raw MIME completo — il server (extractPlainFromMime) estrae
    // autonomamente la parte text/plain, anche dalle email multipart.
    const raw = await new Response(message.raw).text();

    const payload = {
      from: message.from,
      to: [message.to],           // array, non stringa
      subject: message.headers.get("subject") ?? "",
      body: raw,                  // raw MIME → il server lo parsa
      messageId: message.headers.get("message-id") ?? "",
      inReplyTo: message.headers.get("in-reply-to") ?? "",
      references: message.headers.get("references") ?? "",
    };

    const url = `${env.WEBHOOK_URL}?token=${env.INBOUND_EMAIL_TOKEN}`;

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Errore di rete (DNS, timeout, connessione rifiutata)
      throw new Error(`Errore di rete verso il webhook: ${err.message}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      throw new Error(
        `Il webhook ha risposto ${response.status}: ${text}`
      );
    }
  },
};
