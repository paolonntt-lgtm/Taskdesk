// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketDetailScreen from "../app/ticket/[id]";
import { translations } from "../i18n/translations";

const mocks = vi.hoisted(() => ({
  responses: {} as Record<string, unknown>,
  activity: [] as Array<Record<string, any>>,
  lang: "it" as "it" | "en",
  apiGet: vi.fn(),
  user: {
    id: 1,
    role: "admin",
    organizationId: 5,
    groupPermissions: [],
    clientsEnabled: true,
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const element = ReactModule.createElement;
  const component = (tag: string, hideWhenInvisible = false) =>
    (props: Record<string, any>) => {
      if (hideWhenInvisible && !props.visible) return null;
      const {
        accessibilityLabel,
        accessibilityRole,
        accessibilityState,
        onPress,
        onChangeText,
        style: _style,
        contentContainerStyle: _contentContainerStyle,
        testID,
        ...rest
      } = props;
      return element(tag, {
        ...rest,
        ...(testID ? { "data-testid": testID } : {}),
        ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(accessibilityState?.selected != null ? { "aria-selected": accessibilityState.selected } : {}),
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
    Modal: component("div", true),
    Platform: { OS: "web" },
    Pressable: component("button"),
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: component("span"),
    TextInput: component("input"),
    TouchableOpacity: component("button"),
    View: component("div"),
  };
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: vi.fn() }));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { back: vi.fn(), replace: vi.fn() },
  useLocalSearchParams: () => ({ id: "9" }),
}));
vi.mock("react-native-keyboard-controller", () => ({
  KeyboardAwareScrollView: ({ children, ...props }: Record<string, any>) =>
    React.createElement("div", props, children),
}));
vi.mock("@/components/TicketEditModal", () => ({ TicketEditModal: () => null }));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ lang: mocks.lang, t: translations[mocks.lang] }),
}));
vi.mock("@workspace/api-client-react", () => ({
  getListTicketActivityQueryKey: (id: number) => [`/api/tickets/${id}/activity`],
  useListTicketActivity: () => ({
    data: mocks.activity,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/utils/api", () => ({
  apiGet: mocks.apiGet,
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  PRIORITY_COLORS: {},
}));
vi.mock("@/utils/pendingTicketAttachments", () => ({
  getPendingTicketAttachments: vi.fn().mockResolvedValue([]),
  getTicketAttachmentMimeType: vi.fn(),
  isAllowedTicketAttachmentMimeType: vi.fn(),
  MAX_TICKET_ATTACHMENT_SIZE: 20 * 1024 * 1024,
  processPendingTicketAttachments: vi.fn(),
  replacePendingTicketAttachment: vi.fn(),
  savePendingTicketAttachments: vi.fn(),
}));

describe("mobile ticket detail client and assignee", () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const ticketResponse = () => ({
    id: 9,
    title: "Review the service contract",
    description: "Review the latest service contract.",
    category: "Support",
    location: "",
    priority: "medium",
    status: "open",
    assignedTo: 72,
    createdBy: 1,
    clientId: 41,
    createdAt: "2026-10-24T10:00:00.000Z",
    creator: { name: "Admin User" },
    assignee: { name: "Mario Rossi" },
    client: { id: 41, name: "Studio Paolo" },
    assignedToGroup: null,
    commentCount: 0,
    timeTrackingEnabled: false,
  });

  const renderScreen = async () => {
    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(TicketDetailScreen),
        ),
      );
    });
  };

  const expandAdditionalDetails = async () => {
    const toggle = host.querySelector<HTMLButtonElement>(
      '[data-testid="ticket-additional-details-toggle"]',
    );
    await act(async () => toggle?.click());
  };

  const refetchTicketDetail = async () => {
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["ticket", "9"] });
    });
    await renderScreen();
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    mocks.user = {
      id: 1,
      role: "admin",
      organizationId: 5,
      groupPermissions: [],
      clientsEnabled: true,
    };
    mocks.responses = {
      "/tickets/9": ticketResponse(),
      "/tickets/9/comments": [],
      "/tickets/9/checklists": [],
      "/settings/organization": { workedTimeEnabled: false, timeTrackingModuleEnabled: false },
      "/settings/ticket-statuses": [],
    };
    mocks.activity = [];
    mocks.lang = "it";
    mocks.apiGet.mockReset().mockImplementation(async (path: string) => mocks.responses[path]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  });

  it("shows the client and individual assignee from a freshly loaded ticket response", async () => {
    await renderScreen();
    await expandAdditionalDetails();

    expect(mocks.apiGet).toHaveBeenCalledWith("/tickets/9");
    expect(host.textContent).toContain("Studio Paolo");
    expect(host.textContent).toContain("Mario Rossi");
  });

  it("renders useful ticket details before secondary requests finish without clients", async () => {
    mocks.user.clientsEnabled = false;
    const ticketRequest = deferred<any>();
    const commentsRequest = deferred<unknown[]>();
    const checklistsRequest = deferred<unknown[]>();
    const settingsRequest = deferred<{ workedTimeEnabled: boolean; timeTrackingModuleEnabled: boolean }>();
    const statusesRequest = deferred<unknown[]>();
    let ticketRequestStartedAt = 0;
    mocks.apiGet.mockImplementation((path: string) => {
      if (path === "/tickets/9") {
        ticketRequestStartedAt = performance.now();
        return ticketRequest.promise;
      }
      if (path === "/tickets/9/comments") return commentsRequest.promise;
      if (path === "/tickets/9/checklists") return checklistsRequest.promise;
      if (path === "/settings/organization") return settingsRequest.promise;
      if (path === "/settings/ticket-statuses") return statusesRequest.promise;
      return Promise.resolve([]);
    });

    const mountedAt = performance.now();
    await renderScreen();
    expect(host.textContent).not.toContain("Review the service contract");
    expect(ticketRequestStartedAt).toBeGreaterThanOrEqual(mountedAt);

    const ticketWithoutClient = {
      ...ticketResponse(),
      clientId: null,
      client: null,
    };
    const ticketResolvedAt = performance.now();
    await act(async () => {
      ticketRequest.resolve(ticketWithoutClient);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await renderScreen();
    const firstUsefulRenderAt = performance.now();

    expect(host.textContent).toContain("Review the service contract");
    expect(host.textContent).toContain("Review the latest service contract.");
    expect(mocks.apiGet).toHaveBeenCalledWith("/tickets/9/comments");
    expect(mocks.apiGet).toHaveBeenCalledWith("/tickets/9/checklists");
    expect(mocks.apiGet).toHaveBeenCalledWith("/settings/organization");
    expect(mocks.apiGet).toHaveBeenCalledWith("/settings/ticket-statuses");
    console.info(
      `[ticket detail render] clients=off mount-to-ticket-request=${(ticketRequestStartedAt - mountedAt).toFixed(1)}ms ` +
      `ticket-response-to-useful-render=${(firstUsefulRenderAt - ticketResolvedAt).toFixed(1)}ms`,
    );

    await act(async () => {
      commentsRequest.resolve([]);
      checklistsRequest.resolve([]);
      settingsRequest.resolve({ workedTimeEnabled: false, timeTrackingModuleEnabled: false });
      statusesRequest.resolve([]);
    });
  });

  it("keeps key metadata near the title and comments beside the description", async () => {
    await renderScreen();

    const description = host.querySelector('[data-testid="ticket-description-section"]');
    const primaryDetails = host.querySelector('[data-testid="ticket-primary-details"]');
    const comments = host.querySelector('[data-testid="ticket-comments-section"]');
    const moreDetailsButton = host.querySelector<HTMLButtonElement>(
      '[data-testid="ticket-additional-details-toggle"]',
    );
    expect(description).not.toBeNull();
    expect(primaryDetails).not.toBeNull();
    expect(comments).not.toBeNull();
    expect(description?.textContent).toContain("Review the latest service contract.");
    expect(
      primaryDetails!.compareDocumentPosition(description!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(description!.nextElementSibling).toBe(comments);
    expect(primaryDetails?.textContent).toContain(translations.it.ticketDetail.status);
    expect(primaryDetails?.textContent).toContain(translations.it.ticketDetail.priority);
    expect(host.querySelector('[data-testid="ticket-additional-details"]')).toBeNull();
    expect(host.textContent).not.toContain("Admin User");

    await act(async () => moreDetailsButton?.click());
    const additionalDetails = host.querySelector('[data-testid="ticket-additional-details"]');
    expect(additionalDetails?.textContent).toContain("Admin User");
    expect(additionalDetails?.textContent).toContain("Mario Rossi");
    expect(additionalDetails?.textContent).toContain("Studio Paolo");

    await act(async () => moreDetailsButton?.click());
    expect(host.querySelector('[data-testid="ticket-additional-details"]')).toBeNull();
  });

  it("shows the ticket creation date and time before expanding additional details", async () => {
    await renderScreen();

    const openedAt = host.querySelector('[data-testid="ticket-opened-at"]');
    const formattedCreationTime = new Date(ticketResponse().createdAt).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(openedAt?.textContent).toContain(translations.it.ticketDetail.openedAt);
    expect(openedAt?.textContent).toContain(formattedCreationTime);
    expect(host.querySelector('[data-testid="ticket-additional-details"]')).toBeNull();

    await expandAdditionalDetails();
    const additionalDetails = host.querySelector('[data-testid="ticket-additional-details"]');
    expect(additionalDetails?.textContent).not.toContain(translations.it.ticketDetail.date);
    expect(additionalDetails?.textContent).not.toContain(formattedCreationTime);
  });

  it("shows a future deadline in the primary summary without opening more details", async () => {
    const dueAt = "2099-11-15T15:26:00.000Z";
    mocks.responses["/tickets/9"] = { ...ticketResponse(), dueAt };
    await renderScreen();

    const primaryDetails = host.querySelector('[data-testid="ticket-primary-details"]');
    expect(primaryDetails?.textContent).toContain(translations.it.ticketDetail.dueAtLabel);
    expect(primaryDetails?.textContent).toContain("In scadenza il");
    expect(host.querySelector('[data-testid="ticket-additional-details"]')).toBeNull();
  });

  it("shows an expired deadline in English when English is selected", async () => {
    mocks.lang = "en";
    mocks.responses["/tickets/9"] = {
      ...ticketResponse(),
      dueAt: "2020-11-13T15:26:00.000Z",
    };
    await renderScreen();

    const primaryDetails = host.querySelector('[data-testid="ticket-primary-details"]');
    expect(primaryDetails?.textContent).toContain("Expired on November 13 at");
  });

  it("does not add a deadline row when no deadline is set", async () => {
    await renderScreen();
    const primaryDetails = host.querySelector('[data-testid="ticket-primary-details"]');
    expect(primaryDetails?.textContent).not.toContain(translations.it.ticketDetail.dueAtLabel);
  });

  it("shows main-field changes with their author and excludes unrelated activity", async () => {
    mocks.activity = [
      {
        id: 101,
        ticketId: 9,
        userId: 1,
        actionType: "ticket_field_title_changed",
        actionDescription: 'Titolo modificato da "Old title" a "New title"',
        createdAt: "2026-10-24T11:30:00.000Z",
        user: { id: 1, name: "Admin User" },
      },
      {
        id: 102,
        ticketId: 9,
        userId: 1,
        actionType: "priority_changed",
        actionDescription: 'Priorita cambiata da "Media" a "Urgente"',
        createdAt: "2026-10-24T11:35:00.000Z",
        user: { id: 1, name: "Admin User" },
      },
      {
        id: 103,
        ticketId: 9,
        userId: 1,
        actionType: "comment_added",
        actionDescription: "Should stay out of field history",
        createdAt: "2026-10-24T11:40:00.000Z",
        user: { id: 1, name: "Admin User" },
      },
    ];
    await renderScreen();

    const history = host.querySelector('[data-testid="ticket-field-change-history"]');
    expect(history?.textContent).toContain(translations.it.ticketDetail.fieldChangeHistory);
    expect(history?.textContent).toContain('Titolo modificato da "Old title" a "New title"');
    expect(history?.textContent).toContain('Priorita cambiata da "Media" a "Urgente"');
    expect(history?.textContent).toContain("Admin User");
    expect(history?.textContent).not.toContain("Should stay out of field history");
  });

  it("shows the saved group assignment from the ticket response", async () => {
    mocks.responses["/tickets/9"] = {
      ...ticketResponse(),
      assignedTo: null,
      assignee: null,
      assignedToGroup: "Support",
    };
    await renderScreen();
    await expandAdditionalDetails();

    expect(host.textContent).toContain("Gruppo: Support");
    expect(host.textContent).not.toContain("Mario Rossi");
  });

  it("removes the client after the fresh ticket response clears it", async () => {
    await renderScreen();
    await expandAdditionalDetails();
    expect(host.textContent).toContain("Studio Paolo");
    expect(host.textContent).toContain("Mario Rossi");

    mocks.responses["/tickets/9"] = {
      ...ticketResponse(),
      clientId: null,
      client: null,
    };
    await refetchTicketDetail();

    expect(mocks.apiGet.mock.calls.filter(([path]) => path === "/tickets/9")).toHaveLength(2);
    expect(host.textContent).not.toContain("Studio Paolo");
    expect(host.textContent).toContain("Mario Rossi");
  });

  it("removes the assignee after the fresh ticket response clears it", async () => {
    await renderScreen();
    await expandAdditionalDetails();
    expect(host.textContent).toContain("Studio Paolo");
    expect(host.textContent).toContain("Mario Rossi");

    mocks.responses["/tickets/9"] = {
      ...ticketResponse(),
      assignedTo: null,
      assignee: null,
    };
    await refetchTicketDetail();

    expect(mocks.apiGet.mock.calls.filter(([path]) => path === "/tickets/9")).toHaveLength(2);
    expect(host.textContent).toContain("Studio Paolo");
    expect(host.textContent).not.toContain("Mario Rossi");
    expect(host.textContent).toContain(translations.it.ticketDetail.unassigned);
  });
});
