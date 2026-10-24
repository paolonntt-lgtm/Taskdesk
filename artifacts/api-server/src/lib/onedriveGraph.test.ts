import { describe, expect, it } from "vitest";
import {
  canConnectMicrosoftTenant,
  CONSUMER_TENANT_ID,
  getOneDriveAttachmentCopyName,
  isExpectedOneDriveAttachmentCopy,
  isOneDriveCopyAccountMatch,
  isUploadedOneDriveCopyCurrent,
  shouldRevokeOneDrivePermission,
  validateOneDriveAttachmentMetadata,
} from "./onedriveGraph";
import { MAX_TICKET_ATTACHMENT_SIZE_BYTES } from "./allowedMimeTypes";

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
    expect(isUploadedOneDriveCopyCurrent({
      ...upload,
      currentItemId: "new-item",
      uploadedItemId: "new-item",
    })).toBe(true);
    expect(isUploadedOneDriveCopyCurrent({ ...upload, currentAssigneeId: 11 })).toBe(false);
    expect(isUploadedOneDriveCopyCurrent({
      ...upload,
      currentAccount: { microsoftEmail: "new@example.com", tenantId: "tenant-1" },
    })).toBe(false);
    expect(isUploadedOneDriveCopyCurrent({ ...upload, currentItemId: "another-item" })).toBe(false);
  });
});

describe("OneDrive ticket attachment validation", () => {
  it("accepts allowed types at the 20 MB limit and normalizes MIME parameters", () => {
    expect(validateOneDriveAttachmentMetadata("text/plain; charset=utf-8", MAX_TICKET_ATTACHMENT_SIZE_BYTES))
      .toBe("text/plain");
  });

  it("rejects unsupported types and files over 20 MB with actionable statuses", () => {
    expect(() => validateOneDriveAttachmentMetadata("image/svg+xml", 100))
      .toThrow(expect.objectContaining({ statusCode: 415 }));
    expect(() => validateOneDriveAttachmentMetadata("application/pdf", MAX_TICKET_ATTACHMENT_SIZE_BYTES + 1))
      .toThrow(expect.objectContaining({ statusCode: 413 }));
  });
});

describe("OneDrive collaborator permission revocation", () => {
  const targets = new Set(["former.collaborator@example.com"]);

  it("matches only direct read permissions for the departing collaborator", () => {
    expect(shouldRevokeOneDrivePermission({
      id: "permission-1",
      roles: ["read"],
      invitation: { email: "Former.Collaborator@example.com" },
    }, targets, "owner@example.com")).toBe(true);

    expect(shouldRevokeOneDrivePermission({
      id: "permission-2",
      roles: ["read"],
      grantedToV2: { user: { email: "former.collaborator@example.com" } },
    }, targets, "owner@example.com")).toBe(true);
  });

  it("preserves unrelated, owner, link, and write permissions", () => {
    expect(shouldRevokeOneDrivePermission({
      id: "permission-3",
      roles: ["read"],
      invitation: { email: "another@example.com" },
    }, targets, "owner@example.com")).toBe(false);
    expect(shouldRevokeOneDrivePermission({
      id: "permission-4",
      roles: ["read"],
      invitation: { email: "owner@example.com" },
    }, new Set(["owner@example.com"]), "owner@example.com")).toBe(false);
    expect(shouldRevokeOneDrivePermission({
      id: "permission-5",
      roles: ["read"],
      invitation: { email: "former.collaborator@example.com" },
      link: {},
    }, targets, "owner@example.com")).toBe(false);
    expect(shouldRevokeOneDrivePermission({
      id: "permission-6",
      roles: ["write"],
      invitation: { email: "former.collaborator@example.com" },
    }, targets, "owner@example.com")).toBe(false);
  });
});
