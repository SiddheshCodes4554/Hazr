import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHazards } from "../../hazards/hooks/useHazards";
import { fetchWeatherForLocation } from "../api/weatherApi";
import { calculateHazardPredictions } from "../utils/predictionEngine";

/**
 * Hook to retrieve predictions for a target coordinate sector.
 */
export const usePredictions = (latitude: number, longitude: number) => {
  const { data: hazards, isLoading: isHazardsLoading, refetch: refetchHazards } = useHazards();

  // Load weather forecasts via React Query (caching results for 15 minutes)
  const weatherQuery = useQuery({
    queryKey: ["weather", latitude, longitude],
    queryFn: () => fetchWeatherForLocation(latitude, longitude),
    staleTime: 1000 * 60 * 15, // 15 mins cache
  });

  const prediction = useMemo(() => {
    if (!weatherQuery.data || !hazards) return null;
    return calculateHazardPredictions(latitude, longitude, weatherQuery.data, hazards);
  }, [latitude, longitude, weatherQuery.data, hazards]);

  return {
    prediction,
    isLoading: weatherQuery.isLoading || isHazardsLoading,
    isRefetching: weatherQuery.isRefetching,
    error: weatherQuery.error,
    refetch: () => {
      weatherQuery.refetch();
      refetchHazards();
    },
  };
};

export default usePredictions;
