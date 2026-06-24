import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../api/supabase";
import { Hazard } from "../types";
import NetInfo from "@react-native-community/netinfo";

/**
 * High-fidelity mock hazards to display out-of-the-box in development
 * or as a graceful fallback when database tables are not yet set up.
 */
const MOCK_HAZARDS: Hazard[] = [
  {
    id: "mock-1",
    title: "Severe Flooding on Main Street",
    description: "Road is completely impassable. Water depth is approx 2 feet. Local authorities are redirecting traffic.",
    category: "flood",
    severity: "high",
    location_lat: 37.7749,
    location_lng: -122.4194,
    reported_by: "system-demo",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45m ago
    status: "active",
    upvotes_count: 14,
    downvotes_count: 0,
    verifications_count: 6,
    fixed_votes_count: 0,
    trust_score: 100,
  },
  {
    id: "mock-2",
    title: "Multi-Vehicle Collision",
    description: "3 cars involved in intersection blocking left and center lanes. Emergency services are on scene.",
    category: "accident",
    severity: "critical",
    location_lat: 37.7833,
    location_lng: -122.4167,
    reported_by: "system-demo",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2h ago
    status: "active",
    upvotes_count: 22,
    downvotes_count: 1,
    verifications_count: 9,
    fixed_votes_count: 0,
    trust_score: 96,
  },
  {
    id: "mock-3",
    title: "Fallen Tree Blocking Road",
    description: "Large oak tree blocking both lanes. Road crew notified but estimated arrival is 1 hour.",
    category: "roadblock",
    severity: "medium",
    location_lat: 37.7699,
    location_lng: -122.4468,
    reported_by: "system-demo",
    created_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(), // 5h ago
    status: "active",
    upvotes_count: 2,
    downvotes_count: 3,
    verifications_count: 1,
    fixed_votes_count: 0,
    trust_score: 30,
  },
  {
    id: "mock-4",
    title: "Extreme Lightning & Wind Warning",
    description: "Severe weather warning. Sudden wind gusts causing minor damage to power lines.",
    category: "weather",
    severity: "low",
    location_lat: 37.7599,
    location_lng: -122.4368,
    reported_by: "system-demo",
    created_at: new Date(Date.now() - 1000 * 60 * 600).toISOString(), // 10h ago
    status: "active",
    upvotes_count: 3,
    downvotes_count: 0,
    verifications_count: 1,
    fixed_votes_count: 0,
    trust_score: 80,
  },
];

/**
 * React Query hook to fetch hazards.
 * Gracefully switches between online query execution and local cached queries.
 * Returns MOCK_HAZARDS if database returns empty or connections fail.
 */
export const useHazards = () => {
  return useQuery<Hazard[]>({
    queryKey: ["hazards"],
    queryFn: async () => {
      // Determine device network availability
      const netState = await NetInfo.fetch();
      const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

      if (!isOnline) {
        // React Query's persist client automatically feeds from cache first.
        // We throw an offline warning if cache is missing.
        throw new Error("Offline. Failed to fetch latest, no cache found.");
      }

      try {
        const { data, error } = await supabase
          .from("hazards")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // If the table exists but is empty, provide demo data for premium aesthetics
        if (!data || data.length === 0) {
          return MOCK_HAZARDS;
        }

        return data as Hazard[];
      } catch (err: any) {
        console.warn(
          "Supabase hazards table fetch failed, using offline fallback mock data:",
          err?.message || err
        );
        return MOCK_HAZARDS;
      }
    },
  });
};

export default useHazards;
