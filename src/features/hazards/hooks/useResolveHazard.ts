import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../api/supabase";
import { useSyncStore } from "../../../store/syncStore";
import NetInfo from "@react-native-community/netinfo";
import { Hazard } from "../types";

/**
 * Mutation hook to mark a hazard as resolved.
 * Checks network connectivity:
 * - If Online: Updates Supabase record status to 'resolved'.
 * - If Offline: Enqueues a RESOLVE_HAZARD event into the sync queue.
 */
export const useResolveHazard = () => {
  const queryClient = useQueryClient();
  const enqueueAction = useSyncStore((state) => state.enqueueAction);

  return useMutation({
    mutationFn: async (hazardId: string) => {
      const netState = await NetInfo.fetch();
      const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

      const payload = { id: hazardId };

      if (!isOnline) {
        console.log("[ResolveHazard] Device offline. Enqueuing resolution locally.");
        enqueueAction("RESOLVE_HAZARD", payload);
        return { id: hazardId, status: "resolved", _queued: true } as any;
      }

      try {
        const { data, error } = await supabase
          .from("hazards")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("id", hazardId)
          .select()
          .single();

        if (error) throw error;
        return data as Hazard;
      } catch (err: any) {
        const isNetworkErr =
          err?.message?.includes("Network request failed") ||
          err?.message?.includes("Failed to fetch") ||
          err?.status === 0;

        if (isNetworkErr) {
          console.warn("[ResolveHazard] Server network failed. Enqueuing locally as fallback.");
          enqueueAction("RESOLVE_HAZARD", payload);
          return { id: hazardId, status: "resolved", _queued: true } as any;
        }
        throw err;
      }
    },
    onSuccess: (data: any) => {
      // Optimistically update incident status in the cache
      queryClient.setQueryData<Hazard[]>(["hazards"], (oldHazards) => {
        if (!oldHazards) return [];
        return oldHazards.map((h) =>
          h.id === data.id
            ? { ...h, status: "resolved", resolved_at: new Date().toISOString() }
            : h
        );
      });

      // Refetch from backend database
      queryClient.invalidateQueries({ queryKey: ["hazards"] });
    },
  });
};

export default useResolveHazard;
