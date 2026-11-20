import { describe, expect, it, vi } from "vitest";
import { validateSmtpHost } from "./smtpHostValidator";

describe("validateSmtpHost", () => {
  it.each(["2130706433", "0x7f000001", "0177.0.0.1", "127.1"])(
    "blocks non-canonical loopback address %s",
    async (host) => {
      const result = await validateSmtpHost(host);
      expect(result.ok).toBe(false);
    },
  );

  it.each(["127.0.0.1", "[::1]", "::ffff:127.0.0.1"])(
    "blocks canonical loopback address %s",
    async (host) => {
      const result = await validateSmtpHost(host);
      expect(result.ok).toBe(false);
    },
  );

  it("rejects a hostname if any resolved address is restricted", async () => {
    const result = await validateSmtpHost("smtp.example.test", async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.12", family: 4 },
    ]);

    expect(result.ok).toBe(false);
  });

  it("fails closed when DNS resolution fails", async () => {
    const result = await validateSmtpHost("smtp.example.test", async () => {
      throw new Error("NXDOMAIN");
    });

    expect(result.ok).toBe(false);
  });

  it("pins the connection IP and preserves the TLS hostname", async () => {
    const resolve = vi.fn().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const result = await validateSmtpHost("smtp.example.test", resolve);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // A later lookup would have returned loopback, but Nodemailer receives the
    // already-validated numeric address and never resolves the hostname again.
    resolve.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(result.host).toBe("8.8.8.8");
    expect(result.servername).toBe("smtp.example.test");
  });
});
