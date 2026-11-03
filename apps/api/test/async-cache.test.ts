import assert from "node:assert/strict";
import { test } from "node:test";
import { createAsyncCache } from "../src/lib/async-cache.ts";

test("coalesces concurrent requests and reuses successful results until expiry", async (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  let calls = 0;
  const cache = createAsyncCache(async () => ++calls, 100);
  assert.deepEqual(await Promise.all([cache.get(), cache.get(), cache.get()]), [1, 1, 1]);
  now = 1099;
  assert.equal(await cache.get(), 1);
  now = 1100;
  assert.equal(await cache.get(), 2);
  assert.equal(calls, 2);
});

test("does not cache failures", async () => {
  let calls = 0;
  const cache = createAsyncCache(async () => {
    if (++calls === 1) throw new Error("temporarily unavailable");
    return "recovered";
  }, 1000);
  await assert.rejects(cache.get(), /temporarily unavailable/);
  assert.equal(await cache.get(), "recovered");
});

test("invalidation refreshes cached data", async () => {
  let calls = 0;
  const cache = createAsyncCache(async () => ++calls, 1000);
  assert.equal(await cache.get(), 1);
  cache.invalidate();
  assert.equal(await cache.get(), 2);
});

test("an old in-flight read cannot repopulate the cache after an update", async () => {
  let completeOld!: (value: string) => void;
  let calls = 0;
  const cache = createAsyncCache(() => {
    calls++;
    return calls === 1
      ? new Promise<string>((resolve) => {
          completeOld = resolve;
        })
      : Promise.resolve("updated");
  }, 1000);
  const old = cache.get();
  await Promise.resolve();
  cache.invalidate();
  assert.equal(await cache.get(), "updated");
  completeOld("outdated");
  assert.equal(await old, "outdated");
  assert.equal(await cache.get(), "updated");
  assert.equal(calls, 2);
});
