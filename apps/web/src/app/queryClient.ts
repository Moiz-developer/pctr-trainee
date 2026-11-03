import { QueryClient } from "@tanstack/react-query";

/** Keep recently visited pages warm. Mutations still invalidate their queries.
 * Per-query settings (identity, signed URLs, playback) take precedence.
 * AuthProvider clears this in-memory cache when the signed-in account changes.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
