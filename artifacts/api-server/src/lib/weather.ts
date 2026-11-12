export type WeatherLanguage = "it" | "en";

export interface CurrentWeather {
  temperatureC: number;
  feelsLikeC: number;
  conditionText: string;
  conditionCode: number;
  isDay: boolean;
  observedAt: string;
}

interface WeatherApiResponse {
  current?: {
    temp_c?: number;
    feelslike_c?: number;
    condition?: { text?: string; code?: number };
    is_day?: number;
    last_updated?: string;
  };
  error?: { message?: string };
}

interface CacheEntry {
  expiresAt: number;
  weather: CurrentWeather;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 256;
const weatherCache = new Map<string, CacheEntry>();

export class WeatherUnavailableError extends Error {
  constructor(message = "Weather service is unavailable") {
    super(message);
    this.name = "WeatherUnavailableError";
  }
}

export function roundWeatherCoordinate(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export async function getCurrentWeather(
  latitude: number,
  longitude: number,
  language: WeatherLanguage,
): Promise<CurrentWeather> {
  const roundedLatitude = roundWeatherCoordinate(latitude);
  const roundedLongitude = roundWeatherCoordinate(longitude);
  const cacheKey = `${roundedLatitude},${roundedLongitude}:${language}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.weather;
  if (cached) weatherCache.delete(cacheKey);

  const apiKey = process.env.WEATHERAPI_API_KEY?.trim();
  if (!apiKey) throw new WeatherUnavailableError("Weather service is not configured");

  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", `${roundedLatitude},${roundedLongitude}`);
  url.searchParams.set("aqi", "no");
  url.searchParams.set("lang", language);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new WeatherUnavailableError();
  }
  if (!response.ok) throw new WeatherUnavailableError();

  let payload: WeatherApiResponse;
  try {
    payload = await response.json() as WeatherApiResponse;
  } catch {
    throw new WeatherUnavailableError();
  }

  const current = payload.current;
  const conditionText = current?.condition?.text?.trim();
  const conditionCode = current?.condition?.code;
  if (
    !current ||
    !Number.isFinite(current.temp_c) ||
    !Number.isFinite(current.feelslike_c) ||
    !conditionText ||
    !Number.isInteger(conditionCode) ||
    (current.is_day !== 0 && current.is_day !== 1) ||
    !current.last_updated
  ) {
    throw new WeatherUnavailableError();
  }

  const weather: CurrentWeather = {
    temperatureC: Math.round(current.temp_c!),
    feelsLikeC: Math.round(current.feelslike_c!),
    conditionText: conditionText.slice(0, 80),
    conditionCode: conditionCode!,
    isDay: current.is_day === 1,
    observedAt: current.last_updated,
  };

  if (weatherCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = weatherCache.keys().next().value;
    if (oldestKey) weatherCache.delete(oldestKey);
  }
  weatherCache.set(cacheKey, { weather, expiresAt: Date.now() + CACHE_TTL_MS });
  return weather;
}
