import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentWeather, WeatherUnavailableError } from "./weather";

describe("getCurrentWeather", () => {
  beforeEach(() => {
    vi.stubEnv("WEATHERAPI_API_KEY", "test-weather-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rounds coordinates, localizes the request, and caches briefly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      location: { name: "Milano", country: "Italia" },
      current: {
        temp_c: 18.6,
        feelslike_c: 17.8,
        condition: { text: "Parzialmente nuvoloso", code: 1003 },
        is_day: 1,
        last_updated: "2026-11-12 10:00",
      },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getCurrentWeather(12.341, 34.561, "it");
    const second = await getCurrentWeather(12.344, 34.564, "it");

    expect(first).toEqual({
      temperatureC: 19,
      feelsLikeC: 18,
      conditionText: "Parzialmente nuvoloso",
      conditionCode: 1003,
      isDay: true,
      observedAt: "2026-11-12 10:00",
      locationName: "Milano, Italia",
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("q")).toBe("12.34,34.56");
    expect(requestedUrl.searchParams.get("lang")).toBe("it");
    expect(requestedUrl.searchParams.get("key")).toBe("test-weather-key");
  });

  it("fails clearly when the server key is missing", async () => {
    vi.stubEnv("WEATHERAPI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentWeather(45.46, 9.19, "it")).rejects.toBeInstanceOf(WeatherUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
