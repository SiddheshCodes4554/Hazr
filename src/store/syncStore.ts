import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SyncAction {
  id: string;
  type: "CREATE_HAZARD" | "RESOLVE_HAZARD" | "UPDATE_PROFILE";
  payload: any;
  createdAt: number;
  attempts: number;
}

interface SyncState {
  queue: SyncAction[];
  isSyncing: boolean;
  enqueueAction: (type: SyncAction["type"], payload: any) => void;
  dequeueAction: (id: string) => void;
  incrementAttempts: (id: string) => void;
  setSyncing: (isSyncing: boolean) => void;
  clearQueue: () => void;
}

/**
 * Zustand store to manage and persist offline mutation requests.
 * Stored in AsyncStorage so that queued actions survive app restarts.
 */
export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      queue: [],
      isSyncing: false,
      enqueueAction: (type, payload) =>
        set((state) => ({
          queue: [
            ...state.queue,
            {
              id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              type,
              payload,
              createdAt: Date.now(),
              attempts: 0,
            },
          ],
        })),
      dequeueAction: (id) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        })),
      incrementAttempts: (id) =>
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, attempts: item.attempts + 1 } : item
          ),
        })),
      setSyncing: (isSyncing) => set({ isSyncing }),
      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: "hazr-sync-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useSyncStore;
