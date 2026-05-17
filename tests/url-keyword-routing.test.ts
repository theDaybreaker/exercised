/**
 * tests/url-keyword-routing.test.ts
 *
 * Vitest tests for the URL-keyword error branches in MockExtractionService (D-13).
 *
 * Uses vi.useFakeTimers() to skip real setTimeout delays.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { MockExtractionService } from "@/lib/extraction/mock";

afterEach(() => {
  vi.useRealTimers();
});

async function collectEventsWithFakeTimers(url: string) {
  vi.useFakeTimers();
  const events: Array<{
    type: string;
    stage?: string;
    code?: string;
    message?: string;
  }> = [];

  const iterable = MockExtractionService.extract(url);
  const iterator = iterable[Symbol.asyncIterator]();

  // Advance through the generator, ticking timers on each step
  let done = false;
  while (!done) {
    const resultPromise = iterator.next();
    // Advance all fake timers to let any pending sleeps resolve
    await vi.runAllTimersAsync();
    const result = await resultPromise;
    if (result.done) {
      done = true;
    } else {
      events.push(result.value as typeof events[0]);
    }
  }

  vi.useRealTimers();
  return events;
}

describe("MockExtractionService — URL-keyword error routing (D-13)", () => {
  it(
    "'fail' URL yields: fetching stage → NETWORK error",
    async () => {
      const url = "https://youtube.com/watch?v=fail-demo-1";
      const events = await collectEventsWithFakeTimers(url);

      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({ type: "stage", stage: "fetching" });
      expect(events[1]).toMatchObject({
        type: "error",
        code: "NETWORK",
        message: "We couldn't reach the extraction service.",
      });
    },
    10000
  );

  it(
    "'empty' URL yields: fetching → transcribing → NO_WORKOUT error",
    async () => {
      const url = "https://youtube.com/watch?v=empty-demo-1";
      const events = await collectEventsWithFakeTimers(url);

      expect(events).toHaveLength(3);
      expect(events[0]).toMatchObject({ type: "stage", stage: "fetching" });
      expect(events[1]).toMatchObject({ type: "stage", stage: "transcribing" });
      expect(events[2]).toMatchObject({
        type: "error",
        code: "NO_WORKOUT",
        message: "We couldn't find an exercise routine in this video.",
      });
    },
    10000
  );

  it(
    "'rate-limit' URL yields: exactly one RATE_LIMITED error event",
    async () => {
      const url = "https://youtube.com/watch?v=rate-limit-demo-1";
      const events = await collectEventsWithFakeTimers(url);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "error",
        code: "RATE_LIMITED",
        message: "You've extracted a lot of workouts recently.",
      });
    },
    10000
  );

  it(
    "keyword check runs BEFORE videoId hashing — 'fail' in URL always errors even with valid videoId",
    async () => {
      // A URL that has a valid-ish video ID format but also contains 'fail'
      const url = "https://youtube.com/watch?v=aBcDefghfail";
      const events = await collectEventsWithFakeTimers(url);

      // Should be NETWORK error (fail matched before hash-mod selector)
      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.code).toBe("NETWORK");
    },
    10000
  );
});
