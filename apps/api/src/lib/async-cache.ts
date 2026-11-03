/** Single-entry process cache for public data. Never use for request identities. */
export function createAsyncCache<T>(load: () => Promise<T>, ttlMs: number) {
  let cached: { value: T; expiresAt: number } | undefined;
  let pending: Promise<T> | undefined;
  let generation = 0;

  return {
    get(): Promise<T> {
      if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
      if (pending) return pending;
      const currentGeneration = generation;
      const request = Promise.resolve().then(load);
      pending = request;
      void request.then(
        (value) => {
          if (generation === currentGeneration) {
            cached = { value, expiresAt: Date.now() + ttlMs };
          }
          if (pending === request) pending = undefined;
        },
        () => {
          if (pending === request) pending = undefined;
        },
      );
      return request;
    },
    invalidate(): void {
      generation++;
      cached = undefined;
      pending = undefined;
    },
  };
}
