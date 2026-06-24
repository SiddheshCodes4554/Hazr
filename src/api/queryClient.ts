import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

/**
 * Configure the React Query Client.
 * networkMode is set to 'offlineFirst' so that queries run and read from cache
 * even when there is no internet connection.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // Keep cache for 7 days (garbage collection time)
      staleTime: 1000 * 60 * 10,       // Data is considered fresh for 10 minutes
      networkMode: "offlineFirst",     // Execute queries immediately, serving cached data if offline
      refetchOnWindowFocus: false,     // Disable window refocus refetching on mobile
      retry: (failureCount, error: any) => {
        // Do not retry on 4xx authorization/client errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      networkMode: "offlineFirst",     // Allow mutations to fire and fail/retry gracefully offline
    },
  },
});

/**
 * AsyncStorage persister to save the cache state.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "HAZR_QUERY_CACHE",
  throttleTime: 1000,                  // Throttle writes to storage (1s)
});
