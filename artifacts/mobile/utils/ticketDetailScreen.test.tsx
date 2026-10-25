// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TicketDetailScreen from "../app/ticket/[id]";
import { translations } from "../i18n/translations";

const mocks = vi.hoisted(() => ({
  responses: {} as Record<string, unknown>,
  apiGet: vi.fn(),
  user: {
    id: 1,
    role: "admin",
    organizationId: 5,
    groupPermissions: [],
    clientsEnabled: true,
  },
}));

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
  useLanguage: () => ({ lang: "it", t: translations.it }),
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
    mocks.apiGet.mockReset().mockImplementation(async (path: string) => mocks.responses[path]);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  });

  it("shows the client and individual assignee from a freshly loaded ticket response", async () => {
    await renderScreen();

    expect(mocks.apiGet).toHaveBeenCalledWith("/tickets/9");
    expect(host.textContent).toContain("Studio Paolo");
    expect(host.textContent).toContain("Mario Rossi");
  });

  it("shows the saved group assignment from the ticket response", async () => {
    mocks.responses["/tickets/9"] = {
      ...ticketResponse(),
      assignedTo: null,
      assignee: null,
      assignedToGroup: "Support",
    };
    await renderScreen();

    expect(host.textContent).toContain("Gruppo: Support");
    expect(host.textContent).not.toContain("Mario Rossi");
  });

  it("removes the client after the fresh ticket response clears it", async () => {
    await renderScreen();
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
