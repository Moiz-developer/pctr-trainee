import { QueryClient } from "@tanstack/react-query";

/**
 * Global defaults (Performance audit fix): this used to be `new QueryClient()` with zero
 * configuration, so every query fell back to TanStack Query's own defaults — `staleTime: 0` and
 * `refetchOnWindowFocus: true` — meaning EVERY active query (the dashboard, course lists,
 * assessment detail, etc.) refetched on every single window/tab focus, no matter how recently it
 * had already loaded. For an internal training portal, nothing here needs second-by-second
 * freshness: a modest 30s `staleTime` is enough to stop that refetch storm on ordinary
 * tab-switching while still keeping data reasonably current, and `refetchOnWindowFocus: false`
 * removes the focus trigger specifically (the behavior this fix targets) — not "never refetch";
 * an explicit `refetch()`, a mutation's `invalidateQueries`, or simply revisiting a query after
 * this staleTime has elapsed still fetches fresh data as before. Queries that already set their
 * own `staleTime`/`refetchOnWindowFocus` (e.g. services/api/media.ts's
 * `MEDIA_ACCESS_URL_STALE_MS`, VideoLessonPlayer.tsx's `Infinity`) are unaffected — a per-query
 * option always takes precedence over these defaults.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
