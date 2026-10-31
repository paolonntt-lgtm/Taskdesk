// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "../i18n/translations";
import ClientEmailAssociationDialog from "./ClientEmailAssociationDialog";

describe("ClientEmailAssociationDialog", () => {
  let host: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn>;
  let onLinkOnly: ReturnType<typeof vi.fn>;
  let onAddAndLink: ReturnType<typeof vi.fn>;

  const renderDialog = async (lang: "it" | "en", error: string | null = null) => {
    const t = translations[lang].ticketDetail;
    await act(async () => {
      root.render(
        React.createElement(ClientEmailAssociationDialog, {
          open: true,
          busy: false,
          title: t.clientEmailAssociationPromptTitle,
          prompt: t.clientEmailAssociationPromptBody,
          addressNotice: t.clientEmailAssociationAddressNotice("mittente@example.test", "Cliente"),
          cancelLabel: t.clientEmailAssociationCancel,
          linkOnlyLabel: t.clientEmailAssociationLinkOnly,
          addAndLinkLabel: t.clientEmailAssociationAddAndLink,
          error,
          onClose,
          onLinkOnly,
          onAddAndLink,
        }),
      );
    });
  };

  const clickButton = async (label: string) => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((candidate) => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Missing dialog button: ${label}`);
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    onClose = vi.fn();
    onLinkOnly = vi.fn();
    onAddAndLink = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it.each([
    ["it", "Aggiungere il mittente alla scheda cliente?", "Confermi di aggiungere l’indirizzo alla scheda cliente e collegare il ticket?", "Indirizzo che verrà aggiunto alla scheda di Cliente: mittente@example.test", "Annulla", "Collega senza aggiungere", "Aggiungi e collega", "Questo indirizzo è già associato a un altro cliente e non è stato aggiunto."],
    ["en", "Add sender to the client profile?", "Confirm adding the address to the client profile and assigning this ticket?", "Address that will be added to Cliente's profile: mittente@example.test", "Cancel", "Assign without adding", "Add and assign", "This address is already assigned to another client and was not added."],
  ] as const)("shows localized dialog copy and all choices in %s", async (lang, title, prompt, notice, cancel, linkOnly, addAndLink, conflictMessage) => {
    await renderDialog(lang);
    expect(document.body.textContent).toContain(title);
    expect(document.body.textContent).toContain(prompt);
    expect(document.body.textContent).toContain(notice);
    for (const label of [cancel, linkOnly, addAndLink]) {
      expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.trim() === label)).toBe(true);
    }
    await renderDialog(lang, conflictMessage);
    expect(document.body.textContent).toContain(conflictMessage);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it.each([
    ["Annulla", "cancel"],
    ["Collega senza aggiungere", "link-only"],
    ["Aggiungi e collega", "add-and-link"],
  ] as const)("runs only the %s choice", async (label, choice) => {
    await renderDialog("it");
    await clickButton(label);

    expect(onClose).toHaveBeenCalledTimes(choice === "cancel" ? 1 : 0);
    expect(onLinkOnly).toHaveBeenCalledTimes(choice === "link-only" ? 1 : 0);
    expect(onAddAndLink).toHaveBeenCalledTimes(choice === "add-and-link" ? 1 : 0);
  });
});
