// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "expo-router";
import ClientsScreen from "../app/clients";
import ClientDetailScreen from "../app/clients/[id]";

const mocks = vi.hoisted(() => ({
  settings: { clientsEnabled: false, profession: null as string | null },
  settingsError: false,
  settingsRefetchError: false,
  clientsError: false,
  language: "it" as "it" | "en",
  fontScale: 1,
  clients: [] as Array<{ id: number; name: string; alias?: string | null; email?: string | null; phone?: string | null; address?: string | null }>,
  client: { id: 1, name: "Studio Alfa", email: "info@studioalfa.it", notes: undefined as string | undefined },
  clientNotes: [] as Array<Record<string, unknown>>,
  clientNoteDeclaratives: [] as Array<{ id: string; name: string; alias: string }>,
  routeParams: { id: "1" },
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  alert: vi.fn(),
  useQuery: vi.fn(),
  refetchSettings: vi.fn(),
  createClientNote: vi.fn(),
  updateClientNote: vi.fn(),
  deleteClientNote: vi.fn(),
  invalidateQueries: vi.fn(),
  listClients: vi.fn(),
  useInfiniteQuery: vi.fn(),
  hasNextPage: false,
  fetchNextPage: vi.fn(),
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const element = ReactModule.createElement;
  const component = (tag: string, scalesText = false) =>
    (props: Record<string, any>) => {
      const {
        testID,
        accessibilityRole,
        onPress,
        onChangeText,
        style,
        numberOfLines,
        allowFontScaling,
        ...rest
      } = props;
      const normalizedStyle = Array.isArray(style)
        ? Object.assign({}, ...style.flat(Infinity).filter(Boolean))
        : style;
      const scale = scalesText && allowFontScaling !== false ? mocks.fontScale : 1;
      const scaledStyle = scalesText && normalizedStyle && scale !== 1
        ? {
            ...normalizedStyle,
            ...(typeof normalizedStyle.fontSize === "number" ? { fontSize: normalizedStyle.fontSize * scale } : {}),
            ...(typeof normalizedStyle.lineHeight === "number" ? { lineHeight: normalizedStyle.lineHeight * scale } : {}),
          }
        : normalizedStyle;
      return element(tag, {
        ...rest,
        ...(testID ? { "data-testid": testID } : {}),
        ...(accessibilityRole ? { role: accessibilityRole } : {}),
        ...(normalizedStyle ? { "data-rn-style": JSON.stringify(normalizedStyle) } : {}),
        ...(numberOfLines ? { "data-number-of-lines": numberOfLines } : {}),
        ...(scalesText ? { "data-font-scale": scale, style: scaledStyle } : normalizedStyle ? { style: normalizedStyle } : {}),
        ...(onPress ? { onClick: onPress } : {}),
        ...(onChangeText
          ? { onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value) }
          : {}),
      }, props.children);
    };
  return {
    ActivityIndicator: () => null,
    Alert: { alert: mocks.alert },
    FlatList: (props: {
      data: Array<{ id: number }>;
      renderItem: (info: { item: { id: number }; index: number }) => React.ReactNode;
      initialNumToRender?: number;
      maxToRenderPerBatch?: number;
      windowSize?: number;
      ListHeaderComponent?: React.ReactNode;
      ListFooterComponent?: React.ReactNode;
      ListEmptyComponent?: React.ReactNode;
      testID?: string;
        onEndReached?: () => void;
      onRefresh?: () => void;
    }) => element(
      "div",
      {
        "data-testid": props.testID ?? "mobile-clients-flat-list",
        "data-initial-num-to-render": props.initialNumToRender,
        "data-max-to-render-per-batch": props.maxToRenderPerBatch,
        "data-window-size": props.windowSize,
        "data-item-count": props.data.length,
      },
      props.ListHeaderComponent,
      ...props.data.slice(0, props.initialNumToRender ?? 10)
        .map((item, index) => props.renderItem({ item, index })),
      props.onEndReached
        ? element("button", { "data-testid": "clients-load-more", onClick: props.onEndReached }, "Load more")
        : null,
      props.ListFooterComponent,
      props.data.length === 0 ? props.ListEmptyComponent : null,
    ),
    Modal: component("div"),
    Platform: { OS: "ios" },
    Pressable: component("button"),
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: component("span", true),
    TextInput: component("input"),
    View: component("div"),
  };
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options?: { title?: string } }) => options?.title
      ? React.createElement("div", { "data-testid": "screen-title" }, options.title)
      : null,
  },
  router: { push: vi.fn(), replace: vi.fn() },
  useLocalSearchParams: () => mocks.routeParams,
}));
vi.mock("@workspace/api-client-react", () => ({
  getListClientNotesQueryKey: (id: number) => ["client-notes", id],
  useListClientNotes: () => ({
    data: mocks.clientNotes,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateClientNote: () => ({ mutateAsync: mocks.createClientNote, isPending: false }),
  useUpdateClientNote: () => ({ mutateAsync: mocks.updateClientNote, isPending: false }),
  useDeleteClientNote: () => ({ mutateAsync: mocks.deleteClientNote, isPending: false }),
  listClients: mocks.listClients,
}));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", organizationId: 7 } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: mocks.language,
    t: {
      tabs: { clients: mocks.language === "it" ? "Clienti" : "Clients" },
      clientList: {
        title: mocks.language === "it" ? "Clienti" : "Clients",
        addClient: mocks.language === "it" ? "Aggiungi cliente" : "Add client",
        search: mocks.language === "it" ? "Cerca cliente" : "Search clients",
        editClient: mocks.language === "it" ? "Modifica" : "Edit",
        openDetails: mocks.language === "it" ? "Apri dettagli" : "Open details",
      },
    },
  }),
}));
vi.mock("@/utils/api", () => ({
  apiGet: mocks.apiGet,
  apiDelete: vi.fn(),
  apiPatch: mocks.apiPatch,
  apiPost: mocks.apiPost,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
  useInfiniteQuery: mocks.useInfiniteQuery,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

describe("mobile clients screen", () => {
  let host: HTMLDivElement;
  let root: Root;

  const renderScreen = async () => {
    await act(async () => root.render(React.createElement(ClientsScreen)));
  };

  const renderDetailScreen = async () => {
    await act(async () => root.render(React.createElement(ClientDetailScreen)));
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.settings = { clientsEnabled: false, profession: null };
    mocks.settings.profession = null;
    mocks.settingsError = false;
    mocks.settingsRefetchError = false;
    mocks.clientsError = false;
    mocks.language = "it";
    mocks.fontScale = 1;
    mocks.refetchSettings.mockReset();
    mocks.clients = [{ id: 1, name: "Studio Alfa", email: "info@studioalfa.it" }];
    mocks.client = { id: 1, name: "Studio Alfa", email: "info@studioalfa.it", notes: undefined };
    mocks.clientNotes = [];
    mocks.clientNoteDeclaratives = [];
    mocks.routeParams = { id: "1" };
    mocks.apiGet.mockReset().mockResolvedValue([]);
    mocks.apiPatch.mockReset().mockResolvedValue({});
    mocks.apiPost.mockReset().mockResolvedValue({});
    mocks.alert.mockReset();
    mocks.createClientNote.mockReset().mockResolvedValue({});
    mocks.updateClientNote.mockReset().mockResolvedValue({});
    mocks.deleteClientNote.mockReset().mockResolvedValue(undefined);
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
    mocks.listClients.mockReset().mockImplementation(async ({ limit = 100, offset = 0, search }: {
      limit?: number;
      offset?: number;
      search?: string;
    }) => {
      const matching = mocks.clients.filter((client) =>
        `${client.name} ${client.alias ?? ""} ${client.email ?? ""}`.toLowerCase().includes(search?.toLowerCase() ?? ""),
      );
      return matching.slice(offset, offset + limit);
    });
    mocks.hasNextPage = false;
    mocks.fetchNextPage.mockReset();
    mocks.useQuery.mockReset().mockImplementation((options: {
      queryKey: unknown[];
      queryFn: () => Promise<unknown>;
      enabled?: boolean;
    }) => {
      if (options.enabled) void options.queryFn();
      const key = options.queryKey[0];
      return {
        data: key === "mobile-organization-settings"
          ? mocks.settings
          : key === "mobile-client-note-declaratives"
            ? { declaratives: mocks.clientNoteDeclaratives }
          : key === "mobile-client"
            ? mocks.client
            : mocks.clients,
        isSuccess: key === "mobile-organization-settings" && !mocks.settingsError,
        isError: key === "mobile-organization-settings" && mocks.settingsError,
        isRefetchError: key === "mobile-organization-settings" && mocks.settingsRefetchError,
        isLoading: false,
        error: key === "mobile-clients" && mocks.clientsError ? new Error("load failed") : null,
        refetch: key === "mobile-organization-settings" ? mocks.refetchSettings : vi.fn(),
      };
    });
    mocks.useInfiniteQuery.mockReset().mockImplementation((options: {
      queryKey: unknown[];
      queryFn: (params: { pageParam: number }) => Promise<unknown>;
      enabled?: boolean;
    }) => {
      const search = String(options.queryKey[2] ?? "");
      const matching = mocks.clients.filter((client) =>
        `${client.name} ${client.alias ?? ""} ${client.email ?? ""}`.toLowerCase().includes(search.toLowerCase()),
      );
      if (options.enabled) void options.queryFn({ pageParam: 0 });
      return {
        data: { pages: [matching.slice(0, 100)] },
        isLoading: false,
        isRefetching: false,
        isFetchingNextPage: false,
        hasNextPage: mocks.hasNextPage || matching.length > 100,
        fetchNextPage: mocks.fetchNextPage,
        refetch: vi.fn(),
        error: mocks.clientsError ? new Error("load failed") : null,
      };
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("shows the inactive-module message without requesting clients", async () => {
    await renderScreen();

    expect(host.textContent).toContain("La gestione clienti non è attiva");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);

    const clientsQuery = mocks.useInfiniteQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-clients");
    expect(clientsQuery?.enabled).toBe(false);
  });

  it("shows a distinct settings error and retry without requesting clients", async () => {
    mocks.settingsError = true;

    await renderScreen();

    expect(host.textContent).toContain("Impossibile verificare se la gestione clienti è attiva.");
    expect(host.textContent).toContain("Riprova");
    expect(host.textContent).not.toContain("La gestione clienti non è attiva");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);

    const clientsQuery = mocks.useInfiniteQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-clients");
    expect(clientsQuery?.enabled).toBe(false);

    const retryButton = Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Riprova"));
    expect(retryButton).toBeDefined();
    await act(async () => retryButton?.click());
    expect(mocks.refetchSettings).toHaveBeenCalledTimes(1);
  });

  it("does not expose cached clients after the settings refresh fails", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.settingsRefetchError = true;

    await renderScreen();

    expect(host.textContent).toContain("Impossibile verificare se la gestione clienti è attiva.");
    expect(host.textContent).not.toContain("Studio Alfa");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);
    const clientsQuery = mocks.useInfiniteQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-clients");
    expect(clientsQuery?.enabled).toBe(false);
  });

  it("loads and displays clients when the module is enabled", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };

    await renderScreen();

    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);
    expect(mocks.listClients.mock.calls[0]?.[0]).toEqual({ limit: 100, offset: 0 });
    expect(host.textContent).toContain("Studio Alfa");
    expect(host.textContent).not.toContain("La gestione clienti non è attiva");
  });

  it("shows clear empty and load-error states", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clients = [];

    await renderScreen();
    expect(host.textContent).toContain("Nessun cliente trovato.");

    mocks.clientsError = true;
    await renderScreen();
    expect(host.textContent).toContain("Impossibile caricare i clienti.");
    expect(host.textContent).not.toContain("Nessun cliente trovato.");
  });

  it("uses English labels for the client list actions and search", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.language = "en";

    await renderScreen();

    expect(host.textContent).toContain("Clients");
    expect(host.querySelector<HTMLInputElement>('[data-testid="clients-search"]')?.placeholder).toBe("Search clients");
    expect(host.querySelector('[data-testid="clients-add"]')?.getAttribute("accessibilitylabel")).toBe("Add client");
  });

  it("shows one useful secondary field and supports long names", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clients = [
      { id: 1, name: "Studio Alfa", alias: "Amministrazione", email: "info@studioalfa.it", phone: "0123456789" },
      { id: 2, name: "Studio con una denominazione professionale molto lunga senza alias", alias: null, email: null, phone: null, address: null },
      { id: 3, name: "Studio Beta", alias: null, email: null, phone: "0123456789", address: "Via Roma 1" },
    ];

    await renderScreen();

    expect(host.querySelector('[data-testid="client-secondary-1"]')?.textContent).toBe("Amministrazione");
    expect(host.querySelector('[data-testid="client-secondary-1"]')?.textContent).not.toContain("info@studioalfa.it");
    expect(host.querySelector('[data-testid="client-secondary-2"]')).toBeNull();
    expect(host.querySelector('[data-testid="client-secondary-3"]')?.textContent).toBe("0123456789");
    expect(host.querySelector('[data-testid="client-row-2"]')?.textContent).toContain(
      "Studio con una denominazione professionale molto lunga senza alias",
    );
  });

  it("keeps client labels and the edit action readable at large text size on a narrow screen", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.fontScale = 2;
    mocks.clients = [{
      id: 1,
      name: "Studio con una denominazione professionale molto lunga senza alias",
      email: "amministrazione.clienti@example.com",
    }];
    host.style.width = "320px";

    await renderScreen();

    const row = host.querySelector<HTMLElement>('[data-testid="client-row-1"]');
    const name = row?.querySelector<HTMLElement>("span");
    const secondary = host.querySelector<HTMLElement>('[data-testid="client-secondary-1"]');
    const edit = host.querySelector<HTMLElement>('[data-testid="client-edit-1"]');
    const rowStyle = JSON.parse(row?.getAttribute("data-rn-style") ?? "{}");
    const editStyle = JSON.parse(edit?.getAttribute("data-rn-style") ?? "{}");

    expect(host.style.width).toBe("320px");
    expect(name?.textContent).toBe("Studio con una denominazione professionale molto lunga senza alias");
    expect(name?.dataset.fontScale).toBe("2");
    expect(name?.style.fontSize).toBe("30px");
    expect(name?.hasAttribute("data-number-of-lines")).toBe(false);
    expect(secondary?.textContent).toBe("amministrazione.clienti@example.com");
    expect(secondary?.dataset.fontScale).toBe("2");
    expect(secondary?.style.fontSize).toBe("24px");
    expect(secondary?.hasAttribute("data-number-of-lines")).toBe(false);
    expect(rowStyle.height).toBeUndefined();
    expect(rowStyle.minHeight).toBe(64);
    expect(editStyle.width).toBe(44);
    expect(editStyle.height).toBe(44);
    expect(edit?.getAttribute("accessibilitylabel")).toBe(
      "Modifica Studio con una denominazione professionale molto lunga senza alias",
    );
  });

  it("filters clients and opens the selected detail", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clients = [
      { id: 1, name: "Studio Alfa", email: "info@studioalfa.it" },
      { id: 2, name: "Studio Beta", email: "info@studiobeta.it" },
    ];
    vi.mocked(router.push).mockClear();

    await renderScreen();
    const search = host.querySelector<HTMLInputElement>('[data-testid="clients-search"]');
    expect(search).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(search, "beta");
      search!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));

    expect(host.textContent).toContain("Studio Beta");
    expect(host.textContent).not.toContain("Studio Alfa");

    const row = host.querySelector<HTMLButtonElement>('[data-testid="client-row-2"]');
    await act(async () => row?.click());
    expect(router.push).toHaveBeenCalledWith("/clients/2");
  });

  it("searches server-side across 1,000 clients while keeping the mobile list virtualized", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clients = Array.from({ length: 1_000 }, (_, index) => ({
      id: index + 1,
      name: index === 987 ? "Cliente ricerca speciale" : `Cliente ${String(index + 1).padStart(4, "0")}`,
      alias: index === 987 ? "needle-cliente" : null,
      email: `cliente-${index + 1}@example.test`,
    }));
    host.style.width = "360px";

    const loadStartedAt = performance.now();
    await renderScreen();
    const loadMs = performance.now() - loadStartedAt;

    const list = host.querySelector<HTMLElement>('[data-testid="clients-list"]');
    expect(list?.getAttribute("data-item-count")).toBe("100");
    expect(host.querySelectorAll('[data-testid^="client-row-"]')).toHaveLength(10);
    expect(mocks.listClients.mock.calls[0]?.[0]).toEqual({ limit: 100, offset: 0 });
    expect(list?.getAttribute("data-max-to-render-per-batch")).toBe("8");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="clients-load-more"]')?.click());
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);

    const search = host.querySelector<HTMLInputElement>('[data-testid="clients-search"]');
    const searchStartedAt = performance.now();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(search, "needle-cliente");
      search!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
    const searchMs = performance.now() - searchStartedAt;

    expect(host.querySelector('[data-testid="clients-list"]')?.getAttribute("data-item-count")).toBe("1");
    expect(host.querySelector('[data-testid="client-row-988"]')?.textContent).toContain("Cliente ricerca speciale");
    expect(mocks.listClients.mock.calls.at(-1)?.[0]).toEqual({
      limit: 100,
      offset: 0,
      search: "needle-cliente",
    });
    expect(host.style.width).toBe("360px");
    console.info(`[mobile clients benchmark] firstPage=100 of 1000 loadAndRender=${loadMs.toFixed(1)}ms searchAndRender=${searchMs.toFixed(1)}ms`);
  });

  it("opens the admin edit form with current values and saves changes", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clients = [{ id: 1, name: "Studio Alfa", email: "info@studioalfa.it", phone: "0123456789" }];

    await renderScreen();
    const edit = host.querySelector<HTMLButtonElement>('[data-testid="client-edit-1"]');
    expect(edit?.getAttribute("accessibilitylabel")).toBe("Modifica Studio Alfa");
    await act(async () => edit?.click());

    const name = host.querySelector<HTMLInputElement>('input[placeholder="Nome cliente *"]');
    const email = host.querySelector<HTMLInputElement>('input[placeholder="Email"]');
    expect(name?.value).toBe("Studio Alfa");
    expect(email?.value).toBe("info@studioalfa.it");

    const save = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.includes("Salva"));
    await act(async () => save?.click());
    expect(mocks.apiPatch).toHaveBeenCalledWith("/clients/1", {
      name: "Studio Alfa",
      email: "info@studioalfa.it",
      phone: "0123456789",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mobile-clients", 7] });
  });

  it.each([
    {
      language: "it" as const,
      title: "Errore",
      message: "Impossibile salvare il cliente.",
      namePlaceholder: "Nome cliente *",
      phonePlaceholder: "Telefono",
      saveLabel: "Salva",
    },
    {
      language: "en" as const,
      title: "Error",
      message: "Could not save client.",
      namePlaceholder: "Client name *",
      phonePlaceholder: "Phone",
      saveLabel: "Save",
    },
  ])("keeps edited client values and allows retry after a failed save ($language)", async ({
    language,
    title,
    message,
    namePlaceholder,
    phonePlaceholder,
    saveLabel,
  }) => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.language = language;
    mocks.clients = [{ id: 1, name: "Studio Alfa", email: "info@studioalfa.it", phone: "0123456789" }];
    mocks.apiPatch.mockRejectedValueOnce(new Error("save failed"));

    await renderScreen();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="client-edit-1"]')?.click());

    const name = host.querySelector<HTMLInputElement>(`input[placeholder="${namePlaceholder}"]`)!;
    const email = host.querySelector<HTMLInputElement>('input[placeholder="Email"]')!;
    const phone = host.querySelector<HTMLInputElement>(`input[placeholder="${phonePlaceholder}"]`)!;
    const setInputValue = (input: HTMLInputElement, value: string) => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => {
      setInputValue(name, "Studio Alfa aggiornato");
      setInputValue(email, "nuovo@example.com");
      setInputValue(phone, "0987654321");
    });

    const findSaveButton = () => Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes(saveLabel));
    await act(async () => findSaveButton()?.click());

    expect(mocks.alert).toHaveBeenCalledWith(title, message);
    expect(name.value).toBe("Studio Alfa aggiornato");
    expect(email.value).toBe("nuovo@example.com");
    expect(phone.value).toBe("0987654321");

    await act(async () => findSaveButton()?.click());
    expect(mocks.apiPatch).toHaveBeenCalledTimes(2);
    expect(mocks.apiPatch).toHaveBeenLastCalledWith("/clients/1", {
      name: "Studio Alfa aggiornato",
      email: "nuovo@example.com",
      phone: "0987654321",
    });
    expect(mocks.alert).toHaveBeenCalledTimes(1);
  });

  it("shows the inactive-module message without requesting client details", async () => {
    await renderDetailScreen();

    expect(host.textContent).toContain("La gestione clienti non è attiva per questa organizzazione.");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);

    const clientQuery = mocks.useQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-client");
    expect(clientQuery?.enabled).toBe(false);
  });

  it("does not expose a cached client detail after the settings refresh fails", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.settingsRefetchError = true;

    await renderDetailScreen();

    expect(host.textContent).toContain("Impossibile verificare se la gestione clienti è attiva.");
    expect(host.textContent).not.toContain("Studio Alfa");
    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual(["/settings/organization"]);
    const clientQuery = mocks.useQuery.mock.calls
      .map(([options]) => options)
      .find(({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-client");
    expect(clientQuery?.enabled).toBe(false);
  });

  it("loads and displays client details when the module is enabled", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.client = {
      id: 1,
      name: "Studio Alfa",
      email: "info@studioalfa.it",
      notes: "<p>Ogni mese fare conteggi</p>",
    };

    await renderDetailScreen();

    expect(mocks.apiGet.mock.calls.map(([path]) => path)).toEqual([
      "/settings/organization",
      "/clients/1",
      "/client-note-declaratives",
    ]);
    expect(host.textContent).toContain("Studio Alfa");
    expect(host.textContent).toContain("Ogni mese fare conteggi");
    expect(host.textContent).not.toContain("<p>");
    expect(host.textContent?.match(/Studio Alfa/g)).toHaveLength(1);
    expect(host.textContent).toContain("Dati cliente");
  });

  it("shows the client note history and creates a note", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clientNotes = [{
      id: 12,
      clientId: 1,
      organizationId: 7,
      authorId: 5,
      authorName: "Ada Lovelace",
      body: "Ricontattare la prossima settimana",
      checklist: null,
      monthOverride: "2026-12",
      createdAt: "2026-10-24T10:30:00.000Z",
      updatedAt: "2026-10-24T10:30:00.000Z",
    }];

    await renderDetailScreen();

    expect(host.textContent).toContain("Storico note");
    expect(host.textContent).toContain("Ricontattare la prossima settimana");
    expect(host.textContent).toContain("Ada Lovelace");
    expect(host.textContent).toContain("dicembre 2026");

    const input = host.querySelector<HTMLInputElement>('input[placeholder="Scrivi una nota sul cliente…"]');
    expect(input).not.toBeNull();
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "Inviare il preventivo");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const addButton = Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Aggiungi"));
    expect(addButton).toBeDefined();
    await act(async () => addButton?.click());

    expect(mocks.createClientNote).toHaveBeenCalledWith({
      id: 1,
      data: { body: "Inviare il preventivo", checklist: null },
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["client-notes", 1] });
  });

  it("parses a month hashtag into the client note month override", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    await renderDetailScreen();

    const input = host.querySelector<HTMLInputElement>('input[placeholder="Scrivi una nota sul cliente…"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "Inviare il riepilogo #dicembre26");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const addButton = Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Aggiungi"));
    await act(async () => addButton?.click());

    expect(mocks.createClientNote).toHaveBeenCalledWith({
      id: 1,
      data: {
        body: "Inviare il riepilogo",
        checklist: null,
        monthOverride: "2026-12",
        monthOverrides: ["2026-12"],
      },
    });
  });

  it("groups notes with the same month into one month card", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clientNotes = [
      {
        id: 21,
        clientId: 1,
        organizationId: 7,
        authorId: 5,
        authorName: "Ada Lovelace",
        body: "Nota assegnata a dicembre",
        checklist: null,
        monthOverride: "2026-12",
        createdAt: "2026-10-24T10:30:00.000Z",
        updatedAt: "2026-10-24T10:30:00.000Z",
      },
      {
        id: 22,
        clientId: 1,
        organizationId: 7,
        authorId: 5,
        authorName: "Ada Lovelace",
        body: "Nota creata a dicembre",
        checklist: null,
        createdAt: "2026-12-15T10:30:00.000Z",
        updatedAt: "2026-12-15T10:30:00.000Z",
      },
      {
        id: 23,
        clientId: 1,
        organizationId: 7,
        authorId: 5,
        authorName: "Ada Lovelace",
        body: "Nota di novembre",
        checklist: null,
        monthOverride: "2026-11",
        createdAt: "2026-12-20T10:30:00.000Z",
        updatedAt: "2026-12-20T10:30:00.000Z",
      },
    ];

    await renderDetailScreen();

    const decemberGroup = host.querySelector('[data-testid="client-note-month-2026-12"]');
    expect(decemberGroup?.textContent).toContain("dicembre 2026");
    expect(decemberGroup?.textContent).toContain("Nota assegnata a dicembre");
    expect(decemberGroup?.textContent).toContain("Nota creata a dicembre");
    expect(decemberGroup?.textContent).not.toContain("Nota di novembre");
    expect(host.querySelectorAll('[data-testid^="client-note-month-"]')).toHaveLength(2);
  });

  it("creates a category note with the labor-consultant built-in tag", async () => {
    mocks.settings = { clientsEnabled: true, profession: "consulenti-del-lavoro" };
    await renderDetailScreen();

    const input = host.querySelector<HTMLInputElement>('input[placeholder="Scrivi una nota sul cliente…"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "Preparare la CU #CU26");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const addButton = Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Aggiungi"));
    await act(async () => addButton?.click());

    expect(mocks.createClientNote).toHaveBeenCalledWith({
      id: 1,
      data: {
        body: "Preparare la CU",
        checklist: null,
        categories: ["CU26"],
      },
    });
  });

  it("creates a note with an organization-configured declarative tag", async () => {
    mocks.settings = { clientsEnabled: true, profession: "commercialisti" };
    const declarativeId = "5edbd586-6809-4e26-bbd4-448a4bdd671c";
    mocks.clientNoteDeclaratives = [{
      id: declarativeId,
      name: "Dichiarazione dei Redditi",
      alias: "#REDDITI",
    }];
    await renderDetailScreen();

    const input = host.querySelector<HTMLInputElement>('input[placeholder="Scrivi una nota sul cliente…"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "Preparare documenti #REDDITI26");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const addButton = Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Aggiungi"));
    await act(async () => addButton?.click());

    expect(mocks.createClientNote).toHaveBeenCalledWith({
      id: 1,
      data: {
        body: "Preparare documenti",
        checklist: null,
        categories: [`declarative:${declarativeId}:26`],
      },
    });
  });

  it("shows categorized notes in a category card", async () => {
    mocks.settings = { clientsEnabled: true, profession: "consulenti-del-lavoro" };
    mocks.clientNotes = [{
      id: 31,
      clientId: 1,
      organizationId: 7,
      authorId: 5,
      authorName: "Ada Lovelace",
      body: "Documenti CU",
      checklist: null,
      categories: ["CU26"],
      createdAt: "2026-12-15T10:30:00.000Z",
      updatedAt: "2026-12-15T10:30:00.000Z",
    }];
    await renderDetailScreen();

    const categoryCard = host.querySelector('[data-testid="client-note-category-CU26"]');
    expect(categoryCard?.textContent).toContain("CU 2026");
    expect(categoryCard?.textContent).toContain("Documenti CU");
    expect(host.querySelector('[data-testid="client-note-month-2026-12"]')).toBeNull();
  });

  it("shows the configured name for legacy declarative categories without a year", async () => {
    mocks.settings = { clientsEnabled: true, profession: "commercialisti" };
    const declarativeId = "85f12b88-0460-4933-a4d1-94c3a40290d6";
    mocks.clientNoteDeclaratives = [{
      id: declarativeId,
      name: "Dichiarazione dei Redditi",
      alias: "#REDDITI",
    }];
    mocks.clientNotes = [{
      id: 32,
      clientId: 1,
      organizationId: 7,
      authorId: 5,
      authorName: "Ada Lovelace",
      body: "Documenti fiscali",
      checklist: null,
      categories: [`Declarative:${declarativeId.toUpperCase()}`],
      createdAt: "2026-11-04T13:35:00.000Z",
      updatedAt: "2026-11-04T13:35:00.000Z",
    }];
    await renderDetailScreen();

    const categoryCard = host.querySelector(
      `[data-testid="client-note-category-declarative:${declarativeId}:26"]`,
    );
    expect(categoryCard?.textContent).toContain("Dichiarazione dei Redditi 2026");
    expect(categoryCard?.textContent).toContain("Documenti fiscali");
    expect(categoryCard?.textContent).not.toContain(declarativeId);
  });

  it("does not save built-in category tags for other professions", async () => {
    mocks.settings = { clientsEnabled: true, profession: "commercialisti" };
    await renderDetailScreen();

    const input = host.querySelector<HTMLInputElement>('input[placeholder="Scrivi una nota sul cliente…"]');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "Nota #CU26");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const addButton = Array.from(host.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Aggiungi"));
    await act(async () => addButton?.click());

    expect(mocks.createClientNote).not.toHaveBeenCalled();
    expect(host.textContent).toContain("è disponibile solo per i consulenti del lavoro.");
  });

  it("renders a virtualized first page from a large client directory", async () => {
    mocks.settings = { clientsEnabled: true, profession: null };
    mocks.clients = Array.from({ length: 1000 }, (_, index) => ({
      id: index + 1,
      name: `Client ${index + 1}`,
      email: `client${index + 1}@example.com`,
    }));
    await renderScreen();

    const list = host.querySelector('[data-testid="clients-list"]');
    expect(list?.getAttribute("data-item-count")).toBe("100");
    expect(list?.getAttribute("data-initial-num-to-render")).toBe("10");
    expect(list?.getAttribute("data-max-to-render-per-batch")).toBe("8");
    expect(list?.getAttribute("data-window-size")).toBe("7");
    expect(host.querySelectorAll('[data-testid^="client-row-"]')).toHaveLength(10);
  });
});
