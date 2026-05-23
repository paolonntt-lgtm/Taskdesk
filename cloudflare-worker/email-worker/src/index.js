/**
 * TaskDesk — Cloudflare Email Worker
 *
 * Receives inbound emails via Cloudflare Email Routing and forwards them
 * to the TaskDesk webhook endpoint as structured JSON.
 *
 * Required Worker secrets (set via Cloudflare dashboard or wrangler secret):
 *   WEBHOOK_URL   — e.g. https://www.taskdesk.it/api/inbound-email
 *   WEBHOOK_TOKEN — value of INBOUND_EMAIL_TOKEN on the API server
 */
export default {
  async email(message, env, _ctx) {
    if (!env.WEBHOOK_URL || !env.WEBHOOK_TOKEN) {
      throw new Error("WEBHOOK_URL and WEBHOOK_TOKEN must be set as Worker secrets");
    }

    // Read the full raw MIME email body.
    // The API server's extractPlainFromMime() will extract the text/plain part.
    const rawBody = await new Response(message.raw).text();

    // Collect all email headers into a plain object for threading support
    // (Message-ID, In-Reply-To, References).
    const headers = {};
    for (const [key, value] of message.headers.entries()) {
      headers[key.toLowerCase()] = value;
    }

    const payload = {
      from: message.from,
      to: [message.to],
      subject: message.headers.get("Subject") || "",
      body: rawBody,
      messageId: message.headers.get("Message-ID") || "",
      inReplyTo: message.headers.get("In-Reply-To") || "",
      references: message.headers.get("References") || "",
      headers,
    };

    const webhookUrl = new URL(env.WEBHOOK_URL);
    webhookUrl.searchParams.set("token", env.WEBHOOK_TOKEN);

    const response = await fetch(webhookUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "(no body)");
      throw new Error(`Webhook responded ${response.status}: ${text}`);
    }
  },
};
