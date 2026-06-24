import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../api/supabase";
import { useSyncStore } from "../../../store/syncStore";
import NetInfo from "@react-native-community/netinfo";
import { HazardCategory, HazardSeverity, Hazard } from "../types";

interface CreateHazardInput {
  title: string;
  description: string;
  category: HazardCategory;
  severity: HazardSeverity;
  location_lat: number;
  location_lng: number;
  photo_url?: string;
}

/**
 * Mutation hook to create a new hazard.
 * Checks network status on trigger:
 * - If Online: Injects immediately into Supabase.
 * - If Offline: Enqueues into Zustand Offline Sync Queue for background sync on reconnect.
 */
export const useCreateHazard = () => {
  const queryClient = useQueryClient();
  const enqueueAction = useSyncStore((state) => state.enqueueAction);

  return useMutation({
    mutationFn: async (newHazard: CreateHazardInput) => {
      const netState = await NetInfo.fetch();
      const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

      // Get authenticated reporter
      const { data: userData } = await supabase.auth.getUser();
      const reportedBy = userData.user?.email || "anonymous-user";

      const hazardData: Hazard = {
        ...newHazard,
        id: `hzd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        reported_by: reportedBy,
        created_at: new Date().toISOString(),
        status: "active",
      };

      if (!isOnline) {
        console.log("[CreateHazard] Device is offline. Enqueuing mutation locally.");
        enqueueAction("CREATE_HAZARD", hazardData);
        // Return simulated result with queued metadata
        return { ...hazardData, _queued: true } as Hazard & { _queued: boolean };
      }

      try {
        const { data, error } = await supabase
          .from("hazards")
          .insert([hazardData])
          .select()
          .single();

        if (error) throw error;
        return data as Hazard;
      } catch (err: any) {
        // Fall back to queueing if request fails due to network issues
        const isNetworkErr =
          err?.message?.includes("Network request failed") ||
          err?.message?.includes("Failed to fetch") ||
          err?.status === 0;

        if (isNetworkErr) {
          console.warn("[CreateHazard] Server network failed. Enqueuing locally as fallback.");
          enqueueAction("CREATE_HAZARD", hazardData);
          return { ...hazardData, _queued: true } as Hazard & { _queued: boolean };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      // Optimistically append the newly reported hazard to the top of the feed list
      queryClient.setQueryData<Hazard[]>(["hazards"], (oldHazards) => {
        if (!oldHazards) return [data];
        return [data, ...oldHazards];
      });

      // Trigger cache invalidation to sync with the server database
      queryClient.invalidateQueries({ queryKey: ["hazards"] });
    },
  });
};

export default useCreateHazard;
