// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TicketEditModal, type EditableTicket } from "../components/TicketEditModal";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  invalidateQueries: vi.fn(),
  authUser: { role: "admin", clientsEnabled: true },
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const element = ReactModule.createElement;
  const component = (tag: string) =>
    (props: Record<string, any>) => {
      const {
        testID,
        accessibilityRole,
        onPress,
        onChangeText,
        style: _style,
        ...rest
      } = props;
      return element(tag, {
        ...rest,
        ...(testID ? { "data-testid": testID } : {}),
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(onPress ? { onClick: onPress } : {}),
        ...(onChangeText
          ? { onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value) }
          : {}),
      }, props.children);
    };
  return {
    ActivityIndicator: () => null,
    Alert: { alert: vi.fn() },
    KeyboardAvoidingView: component("div"),
    Modal: component("div"),
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Switch: (props: Record<string, any>) => element("button", {
      type: "button",
      "data-testid": props.testID,
      role: "switch",
      "aria-checked": props.value,
      disabled: props.disabled,
      onClick: () => props.onValueChange(!props.value),
    }),
    Text: component("span"),
    TextInput: component("input"),
    TouchableOpacity: component("button"),
    View: component("div"),
    Platform: { OS: "web" },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown[] }) => ({
    data: options.queryKey[0] === "clients"
      ? [{ id: 41, name: "Studio Paolo" }]
      : options.queryKey[0] === "users"
        ? [{ id: 72, name: "Mario Rossi", isActive: true }]
        : { value: ["Support", "Operations"] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock("@/utils/api", () => ({ apiGet: mocks.apiGet, apiPatch: mocks.apiPatch }));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: "it",
    t: {
      newTicket: {
        noClient: "Nessun cliente",
        unassigned: "Non assegnato",
        client: "Cliente",
        assignUser: "Collaboratore",
        assignGroup: "Gruppo",
        assignment: "Assegnazione",
        searchClient: "Cerca cliente...",
        noClientFound: "Nessun cliente trovato.",
        loadOptionsError: "Impossibile caricare le opzioni.",
        noGroup: "Nessun gruppo",
      },
      ticketDetail: {
        cancel: "Annulla",
        editTicket: "Modifica ticket",
        save: "Salva",
        description: "Descrizione",
        category: "Categoria",
        location: "Sede",
        resource: "Risorsa",
        priority: "Priorità",
        trackedTimeTitle: "Tracciamento ore",
        trackingClassificationHint: "Classificazione del timer",
        trackedTimeBillable: "Fatturabile al cliente",
        trackedTimeRecognizable: "Riconoscibile",
        clientRequiredForBillableTime: "Seleziona un cliente per rendere fatturabili le ore.",
        trackedTimeAssigneeRequired: "Assegna il ticket a un operatore.",
      },
      priority: { low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente" },
    },
  }),
}));

describe("mobile ticket edit modal", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderModal = async (
    ticketOverrides: Partial<EditableTicket> = {},
    options: { role?: string; trackingModuleEnabled?: boolean } = {},
  ) => {
    mocks.authUser.role = options.role ?? "admin";
    await act(async () => root.render(React.createElement(TicketEditModal, {
      visible: true,
      trackingModuleEnabled: options.trackingModuleEnabled ?? true,
      ticket: {
        id: 9,
        title: "Title",
        description: "Description",
        category: "Support",
        location: "",
        priority: "medium",
        clientId: null,
        assignedTo: null,
        timeTrackingEnabled: true,
        timeTrackingBillable: false,
        timeTrackingCompensationOverride: false,
        ...ticketOverrides,
      },
      onClose: vi.fn(),
    })));
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.apiGet.mockReset();
    mocks.apiPatch.mockReset().mockResolvedValue({});
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("saves the selected client and collaborator with both eligible time classifications", async () => {
    await renderModal();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-client-picker"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-client-option-41"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-collaborator-picker"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-collaborator-option-72"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-billable-switch"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-recognizable-switch"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-save"]')?.click());

    expect(mocks.apiPatch).toHaveBeenCalledWith("/tickets/9", expect.objectContaining({
      clientId: 41,
      assignedTo: 72,
      assignedToGroup: null,
      timeTrackingBillable: true,
      timeTrackingCompensationOverride: true,
    }));
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["ticket", "9"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["tickets"] });
  });

  it("hides timer classifications from non-admins and omits them from updates", async () => {
    await renderModal({}, { role: "collaborator" });

    expect(host.querySelector('[data-testid="edit-ticket-billable-switch"]')).toBeNull();
    expect(host.querySelector('[data-testid="edit-ticket-recognizable-switch"]')).toBeNull();

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-save"]')?.click());

    const payload = mocks.apiPatch.mock.calls[0][1];
    expect(payload).not.toHaveProperty("timeTrackingBillable");
    expect(payload).not.toHaveProperty("timeTrackingCompensationOverride");
  });

  it("hides timer classifications when TaskTrack is disabled, including for admins", async () => {
    await renderModal({}, { trackingModuleEnabled: false });

    expect(host.querySelector('[data-testid="edit-ticket-billable-switch"]')).toBeNull();
    expect(host.querySelector('[data-testid="edit-ticket-recognizable-switch"]')).toBeNull();
  });

  it("turns off classifications when removing their required client or assignee", async () => {
    await renderModal({
      clientId: 41,
      client: { id: 41, name: "Studio Paolo" },
      assignedTo: 72,
      assignee: { name: "Mario Rossi" },
      timeTrackingBillable: true,
      timeTrackingCompensationOverride: true,
    });

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-client-picker"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-client-option-none"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-collaborator-picker"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-collaborator-option-none"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-save"]')?.click());

    expect(mocks.apiPatch).toHaveBeenCalledWith("/tickets/9", expect.objectContaining({
      clientId: null,
      assignedTo: null,
      assignedToGroup: null,
      timeTrackingBillable: false,
      timeTrackingCompensationOverride: false,
    }));
  });

  it("assigns a team and clears the individual assignee", async () => {
    await renderModal({
      assignedTo: 72,
      assignee: { name: "Mario Rossi" },
    });

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-assignment-mode-group"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-group-picker"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-group-option-Support"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-save"]')?.click());

    expect(mocks.apiPatch).toHaveBeenCalledWith("/tickets/9", expect.objectContaining({
      assignedTo: null,
      assignedToGroup: "Support",
    }));
  });

  it("assigns an individual collaborator and clears the team", async () => {
    await renderModal({
      assignedTo: null,
      assignedToGroup: "Support",
    });

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-assignment-mode-user"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-collaborator-picker"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-collaborator-option-72"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="edit-ticket-save"]')?.click());

    expect(mocks.apiPatch).toHaveBeenCalledWith("/tickets/9", expect.objectContaining({
      assignedTo: 72,
      assignedToGroup: null,
    }));
  });
});
