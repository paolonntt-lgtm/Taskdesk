// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const browseState = vi.hoisted(() => ({
  items: [] as Array<{
    id: string;
    name: string;
    kind: "file";
    mimeType: string;
    size: number;
  }>,
  list: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  listSharedOneDriveFolderItems: browseState.list,
}));

import { MAX_ATTACHMENT_SIZE_BYTES } from "../lib/attachmentRules";
import { RichCommentEditor } from "./RichCommentEditor";

describe("OneDrive attachment picker to comment editor", () => {
  let host: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let onAttachmentsChange: ReturnType<typeof vi.fn>;

  const file = (id: string, name: string, mimeType: string, size: number) => ({
    id,
    name,
    kind: "file" as const,
    mimeType,
    size,
  });

  const renderEditor = async () => {
    await act(async () => {
      root.render(
        React.createElement(RichCommentEditor, {
          value: "",
          onChange: vi.fn(),
          ticketId: 42,
          onAttachmentsChange,
          enableOneDrivePicker: true,
        }),
      );
    });
  };

  const click = async (element: Element | null) => {
    if (!element) throw new Error("Expected OneDrive picker control was not found.");
    const reactPropsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
    const reactProps = reactPropsKey ? (element as any)[reactPropsKey] : undefined;
    const handler = reactProps?.onClick ?? reactProps?.children?.props?.onClick;
    await act(async () => {
      if (handler) {
        handler({ stopPropagation: vi.fn(), preventDefault: vi.fn() });
      } else {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
  };

  const rowFor = (name: string): HTMLElement | null =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((element) => element.textContent?.includes(name)) ?? null;

  const openPicker = async () => {
    const pickerButton = host.querySelector('[aria-label="Allega da OneDrive"]') as HTMLElement | null;
    await click(pickerButton);
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Scegli file da OneDrive");
    });
  };

  const chooseAndImportValidFile = async () => {
    await click(rowFor("valid.pdf"));
    await click(Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Aggiungi 1 file"),
    ) ?? null);
    await vi.waitFor(() => {
      expect(host.textContent).toContain("valid.pdf");
    });
  };

  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    onAttachmentsChange = vi.fn();
    browseState.list.mockReset().mockImplementation(async () => ({ items: browseState.items }));

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/users" || url === "/api/settings/groups") {
        return { ok: true, json: async () => [] };
      }
      if (url === "/api/onedrive/connection") {
        return { ok: true, json: async () => ({ connected: true }) };
      }
      if (url === "/api/onedrive/organization-shares") {
        return { ok: true, json: async () => [{ ownerUserId: 7, canUpload: true }] };
      }
      if (url.includes("/api/onedrive/folders/7/items/") && url.endsWith("/content")) {
        return new Response(new Blob(["valid pdf"], { type: "application/pdf" }), {
          status: 200,
          headers: { "X-File-Content-Type": "application/pdf" },
        });
      }
      if (url === "/api/storage/uploads/request-url") {
        return {
          ok: true,
          json: async () => ({ uploadURL: "/signed-upload", objectPath: "uploads/valid.pdf" }),
        };
      }
      if (url === "/signed-upload" && init?.method === "PUT") {
        return { ok: true };
      }
      return { ok: false, status: 404, json: async () => ({ error: "Unexpected request" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderEditor();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    host.remove();
  });

  it("keeps an unsupported OneDrive file out of pending attachments and still imports a valid file", async () => {
    browseState.items = [
      file("unsupported", "unsupported.svg", "image/svg+xml", 128),
      file("valid", "valid.pdf", "application/pdf", 9),
    ];

    await openPicker();
    await click(rowFor("unsupported.svg"));

    expect(document.body.textContent).toContain("unsupported.svg:");
    expect(document.body.textContent).toContain("tipo file non supportato");
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("unsupported.svg (");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/content"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/storage/uploads/request-url")).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/tickets/42/attachments")).toBe(false);

    await chooseAndImportValidFile();

    expect(onAttachmentsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        objectPath: "uploads/valid.pdf",
        fileName: "valid.pdf",
        mimeType: "application/pdf",
      }),
    ]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/content"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/storage/uploads/request-url")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/signed-upload")).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/tickets/42/attachments")).toBe(false);
  });

  it("keeps an oversized OneDrive file out of pending attachments and still imports a valid file", async () => {
    browseState.items = [
      file("oversized", "oversized.pdf", "application/pdf", MAX_ATTACHMENT_SIZE_BYTES + 1),
      file("valid", "valid.pdf", "application/pdf", 9),
    ];

    await openPicker();
    await click(rowFor("oversized.pdf"));

    expect(document.body.textContent).toContain("oversized.pdf:");
    expect(document.body.textContent).toContain("20 MB");
    expect(onAttachmentsChange).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("oversized.pdf (");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/content"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/storage/uploads/request-url")).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/tickets/42/attachments")).toBe(false);

    await chooseAndImportValidFile();

    expect(onAttachmentsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        objectPath: "uploads/valid.pdf",
        fileName: "valid.pdf",
        mimeType: "application/pdf",
      }),
    ]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/content"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/storage/uploads/request-url")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/signed-upload")).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/tickets/42/attachments")).toBe(false);
  });
});
