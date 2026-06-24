import { useEffect, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useSyncStore } from "../../../store/syncStore";
import { supabase } from "../../../api/supabase";
import { queryClient } from "../../../api/queryClient";

/**
 * Custom hook to monitor connection status and automatically replay
 * queued offline mutations when the device reconnects to the internet.
 */
export const useSyncQueue = () => {
  const { queue, isSyncing, setSyncing, dequeueAction, incrementAttempts } = useSyncStore();

  /**
   * Sequentially process queued mutations.
   * Order is preserved (FIFO) to maintain state transition integrity.
   */
  const processQueue = useCallback(async () => {
    if (isSyncing || queue.length === 0) return;

    setSyncing(true);
    console.log(`[OfflineSync] Starting sync for ${queue.length} pending actions...`);

    for (const action of queue) {
      if (action.attempts >= 5) {
        console.warn(`[OfflineSync] Dropping action ${action.id} after 5 failed attempts.`);
        dequeueAction(action.id);
        continue;
      }

      incrementAttempts(action.id);
      let success = false;

      try {
        switch (action.type) {
          case "CREATE_HAZARD":
            // Insert report
            const { error: createErr } = await supabase
              .from("hazards")
              .insert([action.payload]);
            if (createErr) throw createErr;
            success = true;
            break;

          case "RESOLVE_HAZARD":
            // Update status to resolved
            const { error: resolveErr } = await supabase
              .from("hazards")
              .update({ status: "resolved", resolved_at: new Date().toISOString() })
              .eq("id", action.payload.id);
            if (resolveErr) throw resolveErr;
            success = true;
            break;

          case "UPDATE_PROFILE":
            // Update profile info
            const { error: profileErr } = await supabase
              .from("profiles")
              .update(action.payload)
              .eq("id", action.payload.id);
            if (profileErr) throw profileErr;
            success = true;
            break;

          default:
            console.warn(`[OfflineSync] Unrecognized action type: ${(action as any).type}`);
            success = true; // Remove unrecognized actions from queue
            break;
        }
      } catch (error: any) {
        console.error(`[OfflineSync] Error syncing action ${action.id}:`, error);

        const isNetworkErr = 
          error?.message?.includes("Network request failed") ||
          error?.message?.includes("Failed to fetch") ||
          error?.status === 0 ||
          error?.code === "TypeError"; // standard fetch failure code in RN

        if (isNetworkErr) {
          console.log("[OfflineSync] Sync halted due to persistent network failure. Retrying on next connection change.");
          break; // Stop sync loop immediately to preserve queue for when network is stable
        }
        
        // Non-network errors (e.g. database constraint) will retry up to 5 times and then be dropped.
      }

      if (success) {
        console.log(`[OfflineSync] Successfully synced action ${action.id}`);
        dequeueAction(action.id);
      }
    }

    setSyncing(false);

    // Invalidate React Query cache to fetch the latest state from backend
    queryClient.invalidateQueries();
  }, [queue, isSyncing, setSyncing, dequeueAction, incrementAttempts]);

  useEffect(() => {
    // Listen to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      if (isOnline && queue.length > 0 && !isSyncing) {
        processQueue();
      }
    });

    return () => unsubscribe();
  }, [queue.length, isSyncing, processQueue]);

  return {
    queueLength: queue.length,
    isSyncing,
    processQueue,
  };
};

export default useSyncQueue;
