/**
 * tests/mock-extraction.test.ts
 *
 * Vitest tests for MockExtractionService happy-path behaviors:
 * (a) same URL twice → same workout_title (deterministic)
 * (b) two different videoIds with different hash-mod-5 → different titles
 * (c) full generator emits exactly 5 events (4 stages + 1 result) in order
 * (d) FIXTURES array has exactly 5 entries
 *
 * Uses vi.useFakeTimers() to skip real sleep() delays.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { MockExtractionService } from "@/lib/extraction/mock";

afterEach(() => {
  vi.useRealTimers();
});

async function collectEventsWithFakeTimers(url: string) {
  vi.useFakeTimers();
  const events: Array<Record<string, unknown>> = [];

  const iterable = MockExtractionService.extract(url);
  const iterator = iterable[Symbol.asyncIterator]();

  let done = false;
  while (!done) {
    const resultPromise = iterator.next();
    await vi.runAllTimersAsync();
    const result = await resultPromise;
    if (result.done) {
      done = true;
    } else {
      events.push(result.value as Record<string, unknown>);
    }
  }

  vi.useRealTimers();
  return events;
}

describe("MockExtractionService — happy path", () => {
  it("same URL twice returns the same workout_title (deterministic)", async () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const events1 = await collectEventsWithFakeTimers(url);
    const events2 = await collectEventsWithFakeTimers(url);

    const result1 = events1.find((e) => e.type === "result");
    const result2 = events2.find((e) => e.type === "result");

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(
      (result1 as { workout?: { workout_title?: string } })?.workout?.workout_title
    ).toBe(
      (result2 as { workout?: { workout_title?: string } })?.workout?.workout_title
    );
  });

  it("two different videoIds with different hash-mod-5 → different workout titles", async () => {
    // Test a range of IDs to find ones that hash to different buckets
    const candidates = [
      "https://www.youtube.com/watch?v=aaaaaaaaaa0",
      "https://www.youtube.com/watch?v=bbbbbbbbbbb",
      "https://www.youtube.com/watch?v=ccccccccccc",
      "https://www.youtube.com/watch?v=ddddddddddd",
      "https://www.youtube.com/watch?v=eeeeeeeeeee",
      "https://www.youtube.com/watch?v=fffffffffff",
      "https://www.youtube.com/watch?v=ggggggggggg",
    ];

    const titles = new Set<string>();
    for (const url of candidates) {
      const events = await collectEventsWithFakeTimers(url);
      const resultEvent = events.find((e) => e.type === "result");
      if (resultEvent && typeof resultEvent === "object") {
        const workout = (resultEvent as { workout?: { workout_title?: string } }).workout;
        if (workout?.workout_title) {
          titles.add(workout.workout_title);
        }
      }
    }
    // With 7 candidates over 5 buckets, we must see at least 2 different titles
    expect(titles.size).toBeGreaterThanOrEqual(2);
  });

  it("full generator emits 5 events: 4 stage events then 1 result event", async () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const events = await collectEventsWithFakeTimers(url);

    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({ type: "stage", stage: "fetching" });
    expect(events[1]).toMatchObject({ type: "stage", stage: "transcribing" });
    expect(events[2]).toMatchObject({ type: "stage", stage: "analyzing" });
    expect(events[3]).toMatchObject({ type: "stage", stage: "generating" });
    expect(events[4].type).toBe("result");
  });

  it("FIXTURES array has exactly 5 entries (all 5 fixtures accessible via hash-mod)", async () => {
    // Test enough URLs to cover all 5 hash buckets
    // 25 IDs over 5 buckets → all 5 must be reachable
    const seenTitles = new Set<string>();
    const urls = Array.from({ length: 25 }, (_, i) =>
      `https://www.youtube.com/watch?v=testid${String(i).padStart(4, "0")}0`
    );
    for (const url of urls) {
      const events = await collectEventsWithFakeTimers(url);
      const resultEvent = events.find((e) => e.type === "result");
      if (resultEvent) {
        const workout = (resultEvent as { workout?: { workout_title?: string } }).workout;
        if (workout?.workout_title) {
          seenTitles.add(workout.workout_title);
        }
      }
    }
    expect(seenTitles.size).toBe(5);
  });
});
