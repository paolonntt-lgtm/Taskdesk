import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first hop of the reverse proxy so that express-rate-limit and
// other IP-based middleware see the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);

// Force HTTPS in production: redirect external HTTP requests to HTTPS.
// We only redirect when the proxy explicitly tells us the original request
// was HTTP (X-Forwarded-Proto: http). The healthcheck path is always exempted
// because the Replit deployment proxy adds X-Forwarded-Proto: http even on
// internal startup probes, and a 301 response fails the health check.
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.path === "/api/healthz") {
      return next();
    }
    if (req.headers["x-forwarded-proto"] === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    // Tell browsers to only ever use HTTPS for this origin for the next year
    // and to include all subdomains, so no plaintext request can carry the
    // session cookie even if the user types the bare HTTP URL.
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
}

// Normalise URLs: strip any newline / carriage-return characters that some
// webhook senders (e.g. Cloudflare Workers) accidentally append to the path,
// causing Express to return 404 on an otherwise valid route.
app.use((req, _res, next) => {
  if (req.url) {
    const [path, qs] = req.url.split("?", 2);
    // Remove literal \n / \r and their URL-encoded equivalents %0A / %0D
    const cleanPath = path.replace(/\r?\n/g, "").replace(/%0[AD]/gi, "");
    req.url = qs !== undefined ? `${cleanPath}?${qs}` : cleanPath;
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Stripe webhook MUST be registered BEFORE express.json()
// The webhook needs the raw Buffer body, not parsed JSON
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Stripe webhook error');
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Explicit CORS origin allowlist — never reflect arbitrary origins with
// credentials enabled, as that allows any site to make credentialed requests
// on behalf of a logged-in user (cross-origin session hijacking / CSRF).
// Additional origins can be added via the ALLOWED_ORIGINS env var as a
// comma-separated list (e.g. for staging or preview environments).
const defaultAllowedOrigins = [
  "https://www.taskdesk.it",
  "https://taskdesk.it",
  "https://taskdesk.replit.app",
];
const extraOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...extraOrigins])];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g. same-origin, curl, mobile apps).
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    maxAge: 86400,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", router);

export default app;
