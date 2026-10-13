import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import {
  processPendingTicketAttachments,
  type PendingTicketAttachment,
  type RegisteredTicketAttachment,
} from "./pendingTicketAttachments";

const attachment = (name: string): PendingTicketAttachment => ({
  name,
  uri: `file:///${name}`,
  size: 100,
  mimeType: "application/pdf",
});

const registered = (item: PendingTicketAttachment): RegisteredTicketAttachment => ({
  fileName: item.name,
  fileSize: item.size ?? 0,
});

describe("processPendingTicketAttachments", () => {
  let persisted: PendingTicketAttachment[];

  beforeEach(() => {
    persisted = [];
  });

  it("keeps only unfinished files queued and completes a later retry on the same ticket", async () => {
    const files = [attachment("first.pdf"), attachment("second.pdf"), attachment("third.pdf")];
    persisted = [...files];
    const serverAttachments: RegisteredTicketAttachment[] = [];
    const uploadCounts = new Map<string, number>();
    let failSecondUpload = true;
    const createTicket = vi.fn(async () => ({ id: 42 }));
    const ticket = await createTicket();
    const uploadedTicketIds: number[] = [];
    const saveProgress = async (remaining: PendingTicketAttachment[]) => {
      persisted = [...remaining];
    };
    const upload = async (file: PendingTicketAttachment) => {
      uploadedTicketIds.push(ticket.id);
      uploadCounts.set(file.name, (uploadCounts.get(file.name) ?? 0) + 1);
      if (file.name === "second.pdf" && failSecondUpload) {
        failSecondUpload = false;
        throw new Error("Upload interrupted");
      }
      serverAttachments.push(registered(file));
    };

    await expect(processPendingTicketAttachments({
      attachments: files,
      registeredAttachments: [],
      upload,
      persistRemaining: saveProgress,
    })).rejects.toThrow("Upload interrupted");

    expect(persisted.map((file) => file.name)).toEqual(["second.pdf", "third.pdf"]);
    expect(serverAttachments.map((file) => file.fileName)).toEqual(["first.pdf"]);

    // Retrying attachments only must not invoke ticket creation again.
    await processPendingTicketAttachments({
      attachments: persisted,
      registeredAttachments: serverAttachments,
      upload,
      persistRemaining: saveProgress,
    });

    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(uploadedTicketIds.every((ticketId) => ticketId === ticket.id)).toBe(true);
    expect(uploadCounts).toEqual(new Map([
      ["first.pdf", 1],
      ["second.pdf", 2],
      ["third.pdf", 1],
    ]));
    expect(persisted).toEqual([]);
  });

  it("recognizes a server save when the response was lost and does not upload it again", async () => {
    const files = [attachment("saved-before-timeout.pdf"), attachment("remaining.pdf")];
    persisted = [...files];
    const serverAttachments: RegisteredTicketAttachment[] = [];
    let simulatedLostResponse = true;
    const upload = async (file: PendingTicketAttachment) => {
      serverAttachments.push(registered(file));
      if (file.name === files[0].name && simulatedLostResponse) {
        simulatedLostResponse = false;
        throw new Error("Response lost after server save");
      }
    };
    const saveProgress = async (remaining: PendingTicketAttachment[]) => {
      persisted = [...remaining];
    };

    await expect(processPendingTicketAttachments({
      attachments: files,
      registeredAttachments: [],
      upload,
      persistRemaining: saveProgress,
    })).rejects.toThrow("Response lost after server save");

    expect(persisted.map((file) => file.name)).toEqual([
      "saved-before-timeout.pdf",
      "remaining.pdf",
    ]);

    const retryUpload = vi.fn(upload);
    await processPendingTicketAttachments({
      attachments: persisted,
      registeredAttachments: serverAttachments,
      upload: retryUpload,
      persistRemaining: saveProgress,
    });

    expect(retryUpload).toHaveBeenCalledTimes(1);
    expect(retryUpload).toHaveBeenCalledWith(files[1]);
    expect(persisted).toEqual([]);
  });

  it("matches duplicate filenames one at a time", async () => {
    const duplicateFiles = [attachment("same-name.pdf"), attachment("same-name.pdf")];
    const upload = vi.fn(async () => {});

    await processPendingTicketAttachments({
      attachments: duplicateFiles,
      registeredAttachments: [registered(duplicateFiles[0])],
      upload,
      persistRemaining: async (remaining) => {
        persisted = [...remaining];
      },
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(duplicateFiles[1]);
    expect(persisted).toEqual([]);
  });
});
