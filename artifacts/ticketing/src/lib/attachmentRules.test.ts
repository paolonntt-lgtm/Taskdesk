import { describe, expect, it } from "vitest";
import { getAttachmentValidationFailure, MAX_ATTACHMENT_SIZE_BYTES } from "./attachmentRules";

describe("attachment rules", () => {
  it("accepts supported MIME types and rejects unsupported active content", () => {
    expect(getAttachmentValidationFailure("application/pdf", 100)).toBeNull();
    expect(getAttachmentValidationFailure("text/plain; charset=utf-8", 100)).toBeNull();
    expect(getAttachmentValidationFailure("image/svg+xml", 100)).toBe("type");
    expect(getAttachmentValidationFailure("application/x-msdownload", 100)).toBe("type");
  });

  it("accepts files up to 20 MB and rejects larger files", () => {
    expect(getAttachmentValidationFailure("application/pdf", MAX_ATTACHMENT_SIZE_BYTES)).toBeNull();
    expect(getAttachmentValidationFailure("application/pdf", MAX_ATTACHMENT_SIZE_BYTES + 1)).toBe("size");
  });
});
