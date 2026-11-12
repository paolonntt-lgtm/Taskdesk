import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getCurrentWeather, WeatherUnavailableError } from "../lib/weather";

const router: IRouter = Router();

router.get("/weather/current", requireAuth, async (req, res): Promise<void> => {
  const latitudeText = typeof req.query.lat === "string" ? req.query.lat : "";
  const longitudeText = typeof req.query.lon === "string" ? req.query.lon : "";
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  const language = req.query.lang === "en" ? "en" : req.query.lang === "it" ? "it" : null;

  if (
    !latitudeText ||
    !longitudeText ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !language
  ) {
    res.status(400).json({ error: "Valid coordinates and language are required" });
    return;
  }

  try {
    const weather = await getCurrentWeather(latitude, longitude, language);
    res.setHeader("Cache-Control", "private, max-age=600");
    res.json(weather);
  } catch (error) {
    if (error instanceof WeatherUnavailableError) {
      res.status(503).json({ error: "Weather is temporarily unavailable" });
      return;
    }
    res.status(500).json({ error: "Weather is temporarily unavailable" });
  }
});

export default router;
