// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminSettingsScreen from "../app/admin-settings";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  push: vi.fn(),
  setQueryData: vi.fn(),
  translations: {
    adminSettings: {
      title: "Impostazioni azienda",
      mobileIntro: "Organizza i dati aziendali, i ticket e le notifiche in sezioni separate.",
      organizationTab: "Azienda",
      ticketDataTab: "Ticket",
      notificationsTab: "Notifiche",
      ticketDataDescription: "Gestisci i valori disponibili quando si classificano i ticket.",
      notificationDescription: "Invia una notifica di prova per verificare che il dispositivo sia configurato correttamente.",
      unsavedChanges: "Modifiche non salvate",
      loadError: "Non è stato possibile caricare le impostazioni. Riprova tra poco.",
      retry: "Riprova",
      organization: "Organizzazione",
      organizationName: "Nome azienda",
      entitySingular: "Nome cliente",
      entityPlural: "Nome clienti",
      entitySingularPlaceholder: "es. Cliente",
      entityPluralPlaceholder: "es. Clienti",
      businessType: "Tipo di attività",
      businessIT: "IT",
      businessStudio: "Studio professionale",
      businessAgency: "Agenzia",
      businessOther: "Altro",
      clientsEnabled: "Gestione clienti",
      clientsEnabledHelp: "Mostra le schede clienti.",
      workedTimeEnabled: "Tempo lavorato",
      workedTimeEnabledHelp: "Registra il tempo sui ticket.",
      timeTrackingModuleEnabled: "Timer e rendiconto",
      timeTrackingModuleEnabledHelp: "Abilita timer per ticket.",
      saveOrganization: "Salva impostazioni",
      saving: "Salvataggio",
      saved: "Salvato",
      organizationSaved: "Impostazioni salvate.",
      organizationNameError: "Il nome è troppo corto.",
      groups: "Gruppi",
      locations: "Sedi",
      categories: "Categorie",
      add: "Aggiungi",
      addItem: "Nuovo elemento",
      rename: "Rinomina",
      save: "Salva",
      cancel: "Annulla",
      deleteTitle: "Elimina",
      deleteMsg: "Vuoi eliminare",
      deleteConfirm: "Elimina",
      cantDeleteLast: "Non puoi eliminare l'ultimo elemento.",
      error: "Errore",
      errorSave: "Impossibile salvare.",
      namePlaceholder: "Nome...",
      emptyName: "Il nome è obbligatorio.",
      itemsCount: "elementi",
      testPushBtn: "Test notifiche push",
      testPushSending: "Invio in corso",
      testPushSuccess: "Richiesta push accettata.",
      testPushNoToken: "Token non registrato.",
      testPushExpoGoAndroid: "Non disponibile in Expo Go.",
      testPushError: "Invio fallito.",
    },
  },
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const component = (tag: string) => (props: Record<string, any>) => {
    const {
      testID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      onPress,
      onChangeText,
      onValueChange,
      style,
      activeOpacity,
      placeholderTextColor,
      editable,
      trackColor,
      hitSlop,
      autoFocus,
      autoCorrect,
      returnKeyType,
      ...rest
    } = props;
    return ReactModule.createElement(tag, {
      ...rest,
      ...(testID ? { "data-testid": testID } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityState ? { "aria-selected": accessibilityState.selected } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(onChangeText ? { onChange: (event: Event) => onChangeText((event.target as HTMLInputElement).value) } : {}),
    }, props.children);
  };

  return {
    ActivityIndicator: component("div"),
    Alert: { alert: vi.fn() },
    KeyboardAvoidingView: component("div"),
    Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactModule.createElement("div", null, children) : null,
    Platform: { OS: "ios" },
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Switch: ({ value, testID }: { value: boolean; testID?: string }) =>
      ReactModule.createElement("input", { type: "checkbox", checked: value, readOnly: true, "data-testid": testID }),
    Text: component("span"),
    TextInput: component("input"),
    TouchableOpacity: component("button"),
    View: component("div"),
  };
});

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-haptics", () => ({
  default: {
    impactAsync: vi.fn(),
    notificationAsync: vi.fn(),
    ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
    NotificationFeedbackType: { Success: "success" },
  },
}));
vi.mock("expo-constants", () => ({ default: { appOwnership: "expo" } }));
vi.mock("expo-router", () => ({ router: { push: mocks.push } }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: mocks.setQueryData }),
}));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 5, role: "admin", organizationId: 7 } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ lang: "it", t: mocks.translations }),
}));
vi.mock("@/utils/api", () => ({ apiGet: mocks.apiGet, apiPut: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn() }));
vi.mock("@/utils/optionalTabs", () => ({ cacheMobileOrganizationSettings: vi.fn() }));

describe("mobile admin settings navigation", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    mocks.push.mockReset();
    mocks.setQueryData.mockReset();
    mocks.apiGet.mockImplementation(async (path: string) => {
      if (path === "/settings/groups") return { value: ["Support"] };
      if (path === "/settings/locations") return { value: ["Milan"] };
      if (path === "/settings/categories") return { value: ["Bug"] };
      if (path === "/settings/organization") {
        return {
          name: "TaskDesk",
          businessType: "it_support",
          clientsEnabled: true,
          workedTimeEnabled: true,
          timeTrackingModuleEnabled: false,
          entitySingular: "Cliente",
          entityPlural: "Clienti",
        };
      }
      throw new Error(`Unexpected settings request: ${path}`);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("separates company, ticket, and notification settings without losing unsaved edits", async () => {
    await act(async () => root.render(React.createElement(AdminSettingsScreen)));

    expect(host.querySelector('[data-testid="admin-settings-panel-organization"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="admin-settings-panel-tickets"]')).toBeNull();
    const companyName = host.querySelector<HTMLInputElement>('[data-testid="admin-settings-org-name"]');
    expect(companyName?.value).toBe("TaskDesk");

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(companyName, "TaskDesk Milano");
      companyName!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="admin-settings-unsaved"]')?.textContent)
      .toBe("Modifiche non salvate");
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="admin-settings-tab-tickets"]')?.click());

    expect(host.querySelector('[data-testid="admin-settings-panel-organization"]')).toBeNull();
    expect(host.querySelector('[data-testid="admin-settings-panel-tickets"]')?.textContent).toContain("Support");

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="admin-settings-tab-notifications"]')?.click());
    expect(host.querySelector('[data-testid="admin-settings-panel-notifications"]')?.textContent).toContain("Test notifiche push");

    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="admin-settings-tab-organization"]')?.click());
    expect(host.querySelector<HTMLInputElement>('[data-testid="admin-settings-org-name"]')?.value).toBe("TaskDesk Milano");
  });

  it("shows a retry state instead of empty settings when loading fails", async () => {
    mocks.apiGet.mockRejectedValueOnce(new Error("offline"));
    await act(async () => root.render(React.createElement(AdminSettingsScreen)));

    const retry = host.querySelector<HTMLButtonElement>('[data-testid="admin-settings-retry-load"]');
    expect(retry).not.toBeNull();
    expect(host.querySelector('[data-testid="admin-settings-panel-organization"]')).toBeNull();

    mocks.apiGet.mockImplementation(async (path: string) => {
      if (path === "/settings/groups") return { value: ["Support"] };
      if (path === "/settings/locations") return { value: ["Milan"] };
      if (path === "/settings/categories") return { value: ["Bug"] };
      if (path === "/settings/organization") {
        return {
          name: "TaskDesk",
          businessType: "it_support",
          clientsEnabled: true,
          workedTimeEnabled: true,
          timeTrackingModuleEnabled: false,
          entitySingular: "Cliente",
          entityPlural: "Clienti",
        };
      }
      throw new Error(`Unexpected settings request: ${path}`);
    });
    await act(async () => retry?.click());
    expect(host.querySelector('[data-testid="admin-settings-panel-organization"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="admin-settings-retry-load"]')).toBeNull();
  });
});
