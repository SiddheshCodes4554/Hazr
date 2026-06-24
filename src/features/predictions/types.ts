export interface WeatherMetrics {
  temperature: number; // Celsius
  relativeHumidity: number; // %
  precipitation24h: number; // mm
  rain: number; // mm
  windSpeed: number; // km/h
  weatherCode: number; // WMO Weather Code
}

export interface PredictionFactor {
  title: string;
  probability: number; // 0 to 100
  explanations: string[];
}

export interface PredictionEngineResult {
  weather: WeatherMetrics;
  floodRisk: PredictionFactor;
  roadDamageRisk: PredictionFactor;
  hazardGrowthRisk: PredictionFactor;
}
