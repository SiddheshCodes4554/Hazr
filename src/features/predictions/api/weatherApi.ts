import { WeatherMetrics } from "../types";

/**
 * Service to fetch weather metrics from the free key-less Open-Meteo API.
 */
export const fetchWeatherForLocation = async (
  latitude: number,
  longitude: number
): Promise<WeatherMetrics> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&hourly=precipitation&forecast_days=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API returned status: ${response.status}`);
  }

  const data = await response.json();

  // Sum next 24 hours of hourly precipitation to get accumulated forecast volume
  let precipitation24h = 0;
  if (data.hourly && Array.isArray(data.hourly.precipitation)) {
    precipitation24h = data.hourly.precipitation
      .slice(0, 24)
      .reduce((sum: number, val: number) => sum + (val || 0), 0);
  }

  return {
    temperature: data.current?.temperature_2m ?? 17.5,
    relativeHumidity: data.current?.relative_humidity_2m ?? 60,
    precipitation24h: Math.round(precipitation24h * 10) / 10,
    rain: data.current?.rain ?? 0,
    windSpeed: data.current?.wind_speed_10m ?? 12,
    weatherCode: data.current?.weather_code ?? 0,
  };
};
