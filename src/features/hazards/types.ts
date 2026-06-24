export type HazardCategory =
  | "fire"
  | "flood"
  | "accident"
  | "roadblock"
  | "weather"
  | "other";

export type HazardSeverity = "low" | "medium" | "high" | "critical";

export interface Hazard {
  id: string;
  title: string;
  description: string;
  category: HazardCategory;
  severity: HazardSeverity;
  location_lat: number;
  location_lng: number;
  reported_by: string;
  created_at: string;
  status: "active" | "resolved";
  resolved_at?: string;
  photo_url?: string; // Optional field for uploaded hazard photo
}

export interface BoundingBox {
  x: number;      // % from left (0 to 100)
  y: number;      // % from top (0 to 100)
  width: number;  // % width (0 to 100)
  height: number; // % height (0 to 100)
}

export type HazardClass =
  | "pothole"
  | "manhole"
  | "garbage"
  | "flood"
  | "fallen tree"
  | "construction hazard";

export interface DetectionResult {
  id: string;
  class: HazardClass;
  confidence: number;
  bbox: BoundingBox;
}

export interface RiskAssessment {
  risk_level: "low" | "medium" | "high" | "critical";
  urgency_score: number;
  explanation: string;
  citizen_recommendation: string;
  municipality_recommendation: string;
}
