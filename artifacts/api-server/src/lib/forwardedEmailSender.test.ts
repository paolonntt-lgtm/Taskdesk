import { describe, expect, it } from "vitest";
import {
  extractForwardedSender,
  extractSenderFromEmbeddedEmail,
  extractSenderFromProviderAttachments,
} from "./forwardedEmailSender";

describe("forwarded email sender extraction", () => {
  it("extracts a unique sender from an English forwarded-message block", () => {
    expect(extractForwardedSender(
      "FYI\n\n---------- Forwarded message ---------\nFrom: Client <client@example.it>\nSubject: Invoice",
    )).toBe("client@example.it");
  });

  it("extracts a sender from an Italian forwarded-message block", () => {
    expect(extractForwardedSender(
      "Ti inoltro la richiesta.\n\n---------- Messaggio inoltrato ---------\nDa: cliente@example.it\nOggetto: Supporto",
    )).toBe("cliente@example.it");
  });

  it("does not treat an arbitrary From line as an original sender", () => {
    expect(extractForwardedSender("From: client@example.it\nThis is just body text.")).toBeNull();
  });

  it("extracts the From header from an embedded RFC 822 attachment", () => {
    const raw = [
      "Content-Type: multipart/mixed; boundary=mailpart",
      "",
      "--mailpart",
      "Content-Type: message/rfc822",
      "Content-Disposition: attachment; filename=original.eml",
      "",
      "From: Client <client@example.it>",
      "Subject: Hello",
      "",
      "Message body",
      "--mailpart--",
    ].join("\r\n");
    expect(extractSenderFromEmbeddedEmail(raw)).toBe("client@example.it");
  });

  it("extracts an attached EML from a provider attachment payload", () => {
    const content = Buffer.from("From: client@example.it\r\nSubject: Hello\r\n\r\nBody").toString("base64");
    expect(extractSenderFromProviderAttachments([{
      filename: "forwarded.eml",
      content_type: "application/octet-stream",
      content,
    }])).toBe("client@example.it");
  });
});
