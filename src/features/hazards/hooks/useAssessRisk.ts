import { useQuery } from "@tanstack/react-query";
import { env } from "../../../utils/env";
import { RiskAssessment } from "../types";

interface AssessRiskInput {
  hazardType: string;
  confidenceScore: number;
  weather: string;
  location: { lat: number; lng: number };
  historicalReportsCount: number;
}

/**
 * React Query hook to run AI-based risk evaluations on a hazard.
 * Connects directly to the Groq Cloud completions API (llama3-8b-8192 model).
 * Uses structured JSON mode to guarantee responses align with the RiskAssessment schema.
 * Automatically falls back to local rule-based evaluations if Groq keys are missing or offline.
 */
export const useAssessRisk = (input: AssessRiskInput, enabled = true) => {
  return useQuery<RiskAssessment>({
    queryKey: [
      "assess-risk",
      input.hazardType,
      input.weather,
      input.historicalReportsCount,
      input.confidenceScore,
    ],
    queryFn: async () => {
      const apiKey = env.GROQ_API_KEY;
      const isPlaceholderKey =
        !apiKey ||
        apiKey === "" ||
        apiKey === "your_groq_api_key_here" ||
        apiKey === "gsk_your_groq_api_key_here";

      if (isPlaceholderKey) {
        console.warn(
          "[AI Risk Engine] Groq API key is unconfigured. Running local heuristic evaluator."
        );
        return runLocalHeuristicAssessment(input);
      }

      try {
        const prompt = `You are the AI Risk Assessment Engine for Hazr, a situational awareness app.
Analyze the following parameters to assess safety risks and municipal response urgency:
- Hazard Type: ${input.hazardType}
- Confidence Score: ${(input.confidenceScore * 100).toFixed(0)}%
- Active Weather Context: ${input.weather}
- Geographic Coordinates: Lat ${input.location.lat}, Lng ${input.location.lng}
- Historical Nearby Incidents (30 days): ${input.historicalReportsCount}

Perform a risk assessment and return a JSON object with the following fields:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "urgency_score": <number between 1 and 100>,
  "explanation": "<short explanation of the risk factors>",
  "citizen_recommendation": "<safety advice for citizens in the area>",
  "municipality_recommendation": "<dispatch and mitigation instructions for city workers>"
}
Ensure the response is strictly valid JSON. Do not include any other markdown formatting or dialogue outside the JSON.`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.15,
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          throw new Error(`Groq API returned status code ${response.status}`);
        }

        const data = await response.json();
        const jsonContent = JSON.parse(data.choices[0].message.content);

        return {
          risk_level: jsonContent.risk_level || "medium",
          urgency_score: Number(jsonContent.urgency_score) || 50,
          explanation: jsonContent.explanation || "Analyzed via Groq AI engine.",
          citizen_recommendation: jsonContent.citizen_recommendation || "Proceed with caution.",
          municipality_recommendation:
            jsonContent.municipality_recommendation || "Assess and monitor situation.",
        };
      } catch (err: any) {
        console.warn(
          "[AI Risk Engine] Groq API call failed. Reverting to local heuristic assessments:",
          err?.message || err
        );
        return runLocalHeuristicAssessment(input);
      }
    },
    enabled: enabled && !!input.hazardType,
  });
};

/**
 * Local rule-based fallback assessment engine.
 * Emulates the risk analysis using categories, weather hazards, and localized frequencies.
 */
const runLocalHeuristicAssessment = (input: AssessRiskInput): RiskAssessment => {
  let risk_level: RiskAssessment["risk_level"] = "medium";
  let urgency_score = 40;
  let explanation = "";
  let citizen_recommendation = "Proceed with caution.";
  let municipality_recommendation = "Monitor regional reports.";

  const isSevereWeather = /rain|storm|snow|lightning|wind|fog/i.test(input.weather);
  const type = input.hazardType.toLowerCase();

  // 1. Base Hazard Evaluation
  if (type.includes("flood") || type.includes("fire")) {
    risk_level = "high";
    urgency_score = 80;
    explanation = `The presence of ${type} poses an immediate threat to local accessibility and public safety.`;
    citizen_recommendation = "Evacuate or avoid the immediate area. Seek higher ground if flooding is observed.";
    municipality_recommendation = "Dispatch emergency responder crews immediately to place safety barriers and clear drains.";
  } else if (type.includes("tree") || type.includes("construction")) {
    risk_level = "medium";
    urgency_score = 60;
    explanation = `A ${type} blocking lanes creates traffic delays and hazard collisions.`;
    citizen_recommendation = "Reduce driving speeds. Watch out for detour signs and road workers.";
    municipality_recommendation = "Schedule road maintenance crews to remove debris and establish temporary lane bypasses.";
  } else if (type.includes("pothole") || type.includes("manhole")) {
    risk_level = "medium";
    urgency_score = 45;
    explanation = "Open manholes or deep potholes can cause severe vehicle axle damage and pedestrian injury.";
    citizen_recommendation = "Avoid the specific lane. Pedestrians should watch their footing.";
    municipality_recommendation = "Add warning cones around the hazard. Schedule asphalt repaving in the weekly maintenance queue.";
  } else {
    risk_level = "low";
    urgency_score = 25;
    explanation = `Reported safety hazard (${type}) currently under initial assessment.`;
    citizen_recommendation = "No immediate action required, remain alert.";
    municipality_recommendation = "Log report in the urban maintenance system.";
  }

  // 2. Weather Escalations
  if (isSevereWeather) {
    urgency_score += 15;
    explanation += " Active severe weather conditions exacerbate the hazard risk.";
    if (risk_level === "medium") risk_level = "high";
    else if (risk_level === "high") risk_level = "critical";
  }

  // 3. Frequency Escalations
  if (input.historicalReportsCount > 3) {
    urgency_score += 10;
    explanation += ` Recurrent hazard zone: ${input.historicalReportsCount} incidents logged recently nearby.`;
    if (risk_level === "low") risk_level = "medium";
  }

  // Cap urgency score at 100
  urgency_score = Math.min(urgency_score, 100);

  return {
    risk_level,
    urgency_score,
    explanation,
    citizen_recommendation,
    municipality_recommendation,
  };
};

export default useAssessRisk;
