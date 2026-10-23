import { describe, expect, it } from "vitest";
import {
  canConnectMicrosoftTenant,
  CONSUMER_TENANT_ID,
  getOneDriveAttachmentCopyName,
  isExpectedOneDriveAttachmentCopy,
  isOneDriveCopyAccountMatch,
  isUploadedOneDriveCopyCurrent,
} from "./onedriveGraph";

describe("OneDrive account tenant compatibility", () => {
  it("allows organizational accounts from one tenant and personal accounts alongside them", () => {
    expect(canConnectMicrosoftTenant(null, "org-1")).toBe(true);
    expect(canConnectMicrosoftTenant("org-1", "org-1")).toBe(true);
    expect(canConnectMicrosoftTenant("org-1", CONSUMER_TENANT_ID)).toBe(true);
    expect(canConnectMicrosoftTenant(CONSUMER_TENANT_ID, "org-1")).toBe(true);
    expect(canConnectMicrosoftTenant("org-1", "org-2")).toBe(false);
  });
});

describe("OneDrive attachment copy safeguards", () => {
  it("uses the same sanitized, attachment-specific name used during upload", () => {
    expect(getOneDriveAttachmentCopyName(42, 7, "report: final.pdf"))
      .toBe("ticket-42-attachment-7-report_ final.pdf");
  });

  it("accepts only the recorded OneDrive item with the expected TaskDesk filename and file metadata", () => {
    const expectedName = getOneDriveAttachmentCopyName(42, 7, "report.pdf");
    expect(isExpectedOneDriveAttachmentCopy(
      { id: "graph-item-1", name: expectedName, file: {} },
      "graph-item-1",
      42,
      7,
      "report.pdf",
    )).toBe(true);

    expect(isExpectedOneDriveAttachmentCopy(
      { id: "another-item", name: expectedName, file: {} },
      "graph-item-1",
      42,
      7,
      "report.pdf",
    )).toBe(false);
    expect(isExpectedOneDriveAttachmentCopy(
      { id: "graph-item-1", name: "unrelated.docx", file: {} },
      "graph-item-1",
      42,
      7,
      "report.pdf",
    )).toBe(false);
    expect(isExpectedOneDriveAttachmentCopy(
      { id: "graph-item-1", name: expectedName },
      "graph-item-1",
      42,
      7,
      "report.pdf",
    )).toBe(false);
  });

  it("requires the recorded Microsoft account and tenant, allowing email case differences only", () => {
    const copy = { ownerEmail: "Former.Owner@example.com", ownerTenantId: "tenant-1" };
    expect(isOneDriveCopyAccountMatch(copy, {
      microsoftEmail: "former.owner@example.com",
      tenantId: "tenant-1",
    })).toBe(true);
    expect(isOneDriveCopyAccountMatch(copy, {
      microsoftEmail: "former.owner@example.com",
      tenantId: "different-tenant",
    })).toBe(false);
    expect(isOneDriveCopyAccountMatch(copy, {
      microsoftEmail: "new.account@example.com",
      tenantId: "tenant-1",
    })).toBe(false);
  });

  it("keeps an in-flight upload stale after reassignment, account change, or a different current item", () => {
    const upload = {
      currentAssigneeId: 10,
      uploaderId: 10,
      currentAccount: { microsoftEmail: "owner@example.com", tenantId: "tenant-1" },
      uploadAccount: { microsoftEmail: "owner@example.com", tenantId: "tenant-1" },
      currentItemId: null,
      uploadedItemId: "new-item",
    };
    expect(isUploadedOneDriveCopyCurrent(upload)).toBe(true);
    expect(isUploadedOneDriveCopyCurrent({ ...upload, currentAssigneeId: 11 })).toBe(false);
    expect(isUploadedOneDriveCopyCurrent({
      ...upload,
      currentAccount: { microsoftEmail: "new@example.com", tenantId: "tenant-1" },
    })).toBe(false);
    expect(isUploadedOneDriveCopyCurrent({ ...upload, currentItemId: "another-item" })).toBe(false);
  });
});
