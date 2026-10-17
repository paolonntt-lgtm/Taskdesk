import { retryPendingReferralAttributions } from "../referralService";
import { logger } from "./logger";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function startReferralAttributionRetryJob(): void {
  const run = async () => {
    try {
      const processed = await retryPendingReferralAttributions();
      if (processed > 0) logger.info({ processed }, "Referral attribution retries processed");
    } catch (err) {
      logger.warn({ err }, "Referral attribution retry job failed");
    }
  };

  void run();
  const interval = setInterval(() => void run(), CHECK_INTERVAL_MS);
  interval.unref();
}
