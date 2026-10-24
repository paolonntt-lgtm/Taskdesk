// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarItem } from "./calendar";
import CalendarScreen from "../app/(tabs)/calendar";

const mocks = vi.hoisted(() => ({
  calendarData: [] as CalendarItem[],
  nextPickerDate: new Date(2026, 6, 14, 12),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("react-native", async () => {
  const ReactModule = await import("react");
  const element = ReactModule.createElement;
  const nativeElement = (
    tag: string,
    props: Record<string, any>,
    children: React.ReactNode,
  ) => {
    const {
      testID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      onPress,
      onChangeText,
      style,
      ...rest
    } = props;
    const nativeProps: Record<string, any> = {
      ...rest,
      ...(testID ? { "data-testid": testID } : {}),
      ...(accessibilityLabel ? { "aria-label": accessibilityLabel } : {}),
      ...(accessibilityRole === "checkbox"
        ? { role: "checkbox", "aria-checked": accessibilityState?.checked }
        : accessibilityRole === "button"
          ? { "aria-label": accessibilityLabel }
          : {}),
    };
    if (onPress) nativeProps.onClick = onPress;
    if (onChangeText) {
      nativeProps.onChange = (event: React.ChangeEvent<HTMLInputElement>) =>
        onChangeText(event.target.value);
    }
    return element(tag, nativeProps, children);
  };
  const component = (tag: string) =>
    (props: Record<string, any>) => nativeElement(tag, props, props.children);
  return {
    ActivityIndicator: () => null,
    Alert: { alert: vi.fn() },
    Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? element("div", { "data-testid": "calendar-modal" }, children) : null,
    Platform: { OS: "ios" },
    Pressable: component("button"),
    ScrollView: component("div"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: component("span"),
    TextInput: ({ multiline, ...props }: Record<string, any>) =>
      nativeElement(multiline ? "textarea" : "input", props, null),
    View: component("div"),
  };
});

vi.mock("@react-native-community/datetimepicker", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: Date;
    onChange: (event: { type: string }, date?: Date) => void;
  }) => React.createElement("button", {
    type: "button",
    "data-testid": "mock-date-picker",
    "data-current-date": localDateKey(value),
    onClick: () => onChange({ type: "set" }, mocks.nextPickerDate),
  }, localDateKey(value)),
}));

vi.mock("@expo/vector-icons", () => ({ Feather: () => null }));
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }));
vi.mock("@/hooks/useColors", () => ({
  useColors: () => new Proxy({}, { get: () => "#222222" }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    lang: "en",
    t: {
      calendar: {
        weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        title: "Calendar",
        addAppointment: "Add appointment",
        ticketsLegend: "Tickets",
        appointmentsLegend: "Appointments",
        today: "Today",
        loading: "Loading",
        loadError: "Load error",
        retry: "Retry",
        selectedDay: "Selected day",
        noTickets: "No tickets",
        noAppointments: "No appointments",
        editAppointment: "Edit appointment",
        newAppointment: "New appointment",
        titlePlaceholder: "Title",
        descriptionField: "Description",
        allDayAppointment: "All-day appointment",
        startDateField: "Start date",
        endDateField: "End date",
        done: "Done",
        dateTimePlaceholder: "Date and time",
        cancel: "Cancel",
        save: "Save",
        saving: "Saving",
        deleteAppointment: "Delete appointment",
        error: "Error",
        errorSave: "Save error",
        deleteConfirmTitle: "Delete appointment?",
        delete: "Delete",
        errorDelete: "Delete error",
        ticket: "Ticket",
        appointment: "Appointment",
        allDay: "All day",
      },
    },
  }),
}));
vi.mock("@/utils/api", () => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
  apiPost: mocks.apiPost,
  apiPut: mocks.apiPut,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.calendarData, isLoading: false, error: null, refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  return localDateKey(new Date(year, month - 1, day + days, 12));
}

function utcStart(key: string) {
  return `${key}T00:00:00.000Z`;
}

function dateLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString("en-US", { dateStyle: "medium" });
}

describe("mobile calendar all-day appointment form", () => {
  let host: HTMLDivElement;
  let root: Root;
  let today: string;

  const renderScreen = async () => {
    await act(async () => root.render(React.createElement(CalendarScreen)));
  };

  const press = async (selector: string) => {
    const button = host.querySelector<HTMLButtonElement>(selector);
    expect(button, `Expected button ${selector}`).not.toBeNull();
    await act(async () => button!.click());
  };

  const enterTitle = async (value: string) => {
    const input = host.querySelector<HTMLInputElement>('input[placeholder="Title"]');
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, value);
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  const chooseDate = async (field: "start" | "end", key: string) => {
    mocks.nextPickerDate = new Date(`${key}T12:00:00`);
    await press(`[data-testid="calendar-all-day-${field}-date"]`);
    await press('[data-testid="mock-date-picker"]');
  };

  const save = async () => {
    const button = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((candidate) => candidate.textContent?.trim() === "Save");
    expect(button).not.toBeNull();
    await act(async () => button!.click());
  };

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    today = localDateKey(new Date());
    mocks.calendarData = [];
    mocks.nextPickerDate = new Date(2026, 6, 14, 12);
    mocks.apiPost.mockReset().mockResolvedValue({});
    mocks.apiPut.mockReset().mockResolvedValue({});
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("opens an existing all-day appointment with its original date boundaries", async () => {
    const end = addDays(today, 2);
    mocks.calendarData = [{
      type: "appointment",
      id: 41,
      title: "Planning",
      date: today,
      startsAt: utcStart(today),
      endsAt: utcStart(end),
      isAllDay: true,
    }];
    await renderScreen();

    await press('[data-testid="calendar-item-appointment-41"]');
    expect(host.querySelector('[data-testid="calendar-all-day-toggle"]')?.getAttribute("aria-checked"))
      .toBe("true");
    expect(host.querySelector('[aria-label="Start date: ' + dateLabel(today) + '"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="End date: ' + dateLabel(end) + '"]')).not.toBeNull();

    await save();
    expect(mocks.apiPut).toHaveBeenCalledWith("/appointments/41", {
      title: "Planning",
      description: null,
      startsAt: utcStart(today),
      endsAt: utcStart(end),
      isAllDay: true,
      assignedTo: null,
    });
  });

  it("retains the all-day date after switching to timed and back", async () => {
    const end = addDays(today, 1);
    mocks.calendarData = [{
      type: "appointment",
      id: 42,
      title: "Review",
      date: today,
      startsAt: utcStart(today),
      endsAt: utcStart(end),
      isAllDay: true,
    }];
    await renderScreen();
    await press('[data-testid="calendar-item-appointment-42"]');
    await press('[data-testid="calendar-all-day-toggle"]');

    expect(host.querySelector<HTMLInputElement>('input[placeholder="Date and time"]')?.value)
      .toBe(`${today}T09:00`);

    await press('[data-testid="calendar-all-day-toggle"]');
    expect(host.querySelector('[aria-label="Start date: ' + dateLabel(today) + '"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="End date: ' + dateLabel(today) + '"]')).not.toBeNull();
    await save();

    expect(mocks.apiPut).toHaveBeenCalledWith("/appointments/42", {
      title: "Review",
      description: null,
      startsAt: utcStart(today),
      endsAt: utcStart(today),
      isAllDay: true,
      assignedTo: null,
    });
  });

  it("creates a one-day all-day appointment using the selected calendar date", async () => {
    const selected = addDays(today, 3);
    await renderScreen();
    await press('[data-testid="calendar-add-appointment"]');
    await enterTitle("One day");
    await press('[data-testid="calendar-all-day-toggle"]');
    await chooseDate("start", selected);

    expect(host.querySelector('[aria-label="Start date: ' + dateLabel(selected) + '"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="End date: ' + dateLabel(selected) + '"]')).not.toBeNull();
    await save();

    expect(mocks.apiPost).toHaveBeenCalledWith("/appointments", {
      title: "One day",
      description: null,
      startsAt: utcStart(selected),
      endsAt: utcStart(selected),
      isAllDay: true,
      assignedTo: null,
    });
  });

  it("creates a multi-day all-day appointment with the chosen start and end dates", async () => {
    const start = addDays(today, 4);
    const end = addDays(start, 3);
    await renderScreen();
    await press('[data-testid="calendar-add-appointment"]');
    await enterTitle("Workshop");
    await press('[data-testid="calendar-all-day-toggle"]');
    await chooseDate("start", start);
    await chooseDate("end", end);
    await save();

    expect(mocks.apiPost).toHaveBeenCalledWith("/appointments", {
      title: "Workshop",
      description: null,
      startsAt: utcStart(start),
      endsAt: utcStart(end),
      isAllDay: true,
      assignedTo: null,
    });
  });
});
