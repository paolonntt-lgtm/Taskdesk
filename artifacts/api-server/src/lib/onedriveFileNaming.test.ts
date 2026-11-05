import { describe, expect, it } from "vitest";
import { contentBasedFileName, getOneDriveAttachmentCopyName } from "./onedriveGraph";

describe("OneDrive content-based attachment names", () => {
  it("keeps the original extension and strips unsafe filename characters", () => {
    expect(contentBasedFileName("original report.PDF", ' "Fattura: marzo/2026" ')).toBe("Fattura marzo 2026.PDF");
  });

  it("falls back to the original name for an empty suggestion", () => {
    expect(contentBasedFileName("scansione.png", "///")).toBe("scansione.png");
  });

  it("keeps attachment IDs in generated OneDrive copy names", () => {
    expect(getOneDriveAttachmentCopyName(71, 9, "Documento.pdf"))
      .toBe("ticket-71-attachment-9-Documento.pdf");
  });
});
