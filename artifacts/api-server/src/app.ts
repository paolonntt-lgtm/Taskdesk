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
// was HTTP (X-Forwarded-Proto: http). This safely skips internal health-check
// probes from Cloud Run, which arrive without that header and must get 200.
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
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

app.use(cors({ origin: true, credentials: true, maxAge: 86400 }));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", router);

export default app;
