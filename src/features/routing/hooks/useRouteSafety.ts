import { useMemo } from "react";
import { useHazards } from "../../hazards/hooks/useHazards";
import { RoutePath, RouteAlternative } from "../types";
import { analyzeRouteSafety, generateDetourRoute } from "../utils/routeSafety";

interface UseRouteSafetyInput {
  routePath: RoutePath;
}

export const useRouteSafety = ({ routePath }: UseRouteSafetyInput) => {
  const { data: hazards, isLoading, refetch } = useHazards();

  const safetyAnalysis = useMemo(() => {
    if (!hazards || hazards.length === 0) {
      // Neutral default results when data is empty
      const emptyAnalysis = {
        safetyScore: 100,
        riskScore: 0,
        proximityThreats: [],
        explanations: ["No hazards detected along this route."],
      };

      return {
        defaultRoute: {
          id: "default",
          name: "Direct Route",
          coordinates: routePath,
          analysis: emptyAnalysis,
          explanation: "Perfect safety profile.",
        } as RouteAlternative,
        saferRoute: null,
        hasRiskyRoute: false,
      };
    }

    // 1. Analyze direct path
    const defaultAnalysis = analyzeRouteSafety(routePath, hazards);

    // 2. Generate shifted detour path
    const detourPath = generateDetourRoute(routePath, hazards);
    const detourAnalysis = analyzeRouteSafety(detourPath, hazards);

    const defaultAlternative: RouteAlternative = {
      id: "default",
      name: "Direct Route",
      coordinates: routePath,
      analysis: defaultAnalysis,
      explanation:
        defaultAnalysis.safetyScore >= 90
          ? "This route is safe to travel."
          : `Risky route. Passes near ${defaultAnalysis.proximityThreats.length} community hazards.`,
    };

    // Only suggest an alternative if the default route has a safety score below 90
    // and if the detour actually yields a strictly safer score.
    const hasRiskyRoute = defaultAnalysis.safetyScore < 90;
    const isDetourSafer = detourAnalysis.safetyScore > defaultAnalysis.safetyScore;

    const saferAlternative: RouteAlternative | null =
      hasRiskyRoute && isDetourSafer
        ? {
            id: "detour",
            name: "Safety Detour",
            coordinates: detourPath,
            analysis: detourAnalysis,
            explanation: `Detours around risk zones, raising safety score by +${
              detourAnalysis.safetyScore - defaultAnalysis.safetyScore
            } points.`,
          }
        : null;

    return {
      defaultRoute: defaultAlternative,
      saferRoute: saferAlternative,
      hasRiskyRoute,
    };
  }, [routePath, hazards]);

  return {
    ...safetyAnalysis,
    isLoading,
    refetch,
  };
};

export default useRouteSafety;
