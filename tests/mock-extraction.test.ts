/**
 * tests/mock-extraction.test.ts
 *
 * Vitest tests for MockExtractionService happy-path behaviors:
 * (a) same URL twice → same workout_title (deterministic)
 * (b) two different videoIds with different hash-mod-5 → different titles
 * (c) full generator emits exactly 5 events (4 stages + 1 result) in order
 */
import { describe, it, expect } from "vitest";
import { MockExtractionService } from "@/lib/extraction/mock";

async function collectEvents(url: string) {
  const events = [];
  for await (const event of MockExtractionService.extract(url)) {
    events.push(event);
  }
  return events;
}

describe("MockExtractionService — happy path", () => {
  it("same URL twice returns the same workout_title (deterministic)", async () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const events1 = await collectEvents(url);
    const events2 = await collectEvents(url);

    const result1 = events1.find((e) => e.type === "result");
    const result2 = events2.find((e) => e.type === "result");

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1!.type).toBe("result");
    expect(result2!.type).toBe("result");
    if (result1!.type === "result" && result2!.type === "result") {
      expect(result1!.workout.workout_title).toBe(result2!.workout.workout_title);
    }
  }, 30000);

  it("two different videoIds with different hash-mod-5 → different workout titles", async () => {
    // We need to find two URLs where hashStringMod(videoId, 5) differs
    // dQw4w9WgXcQ and Ks-_Mh1QhMc are well-known IDs with different hashes
    // We test multiple candidates until we find two with different fixture titles
    const candidates = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=aaaaaaaaa01",
      "https://www.youtube.com/watch?v=bbbbbbbbb02",
      "https://www.youtube.com/watch?v=ccccccccc03",
      "https://www.youtube.com/watch?v=ddddddddd04",
    ];

    const titles = new Set<string>();
    for (const url of candidates) {
      const events = await collectEvents(url);
      const resultEvent = events.find((e) => e.type === "result");
      if (resultEvent?.type === "result") {
        titles.add(resultEvent.workout.workout_title);
      }
    }
    // With 5 candidates hashing over 5 fixtures, we should see at least 2 different titles
    // (by pigeonhole, 5 candidates over 5 buckets yields ≥1 distinct unless all hash to same)
    // The real test: hash is not constant for all IDs
    expect(titles.size).toBeGreaterThanOrEqual(2);
  }, 60000);

  it("full generator emits 5 events: 4 stage events then 1 result event", async () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const events = await collectEvents(url);

    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({ type: "stage", stage: "fetching" });
    expect(events[1]).toMatchObject({ type: "stage", stage: "transcribing" });
    expect(events[2]).toMatchObject({ type: "stage", stage: "analyzing" });
    expect(events[3]).toMatchObject({ type: "stage", stage: "generating" });
    expect(events[4].type).toBe("result");
  }, 30000);

  it("FIXTURES array has exactly 5 entries (all 5 fixtures loaded)", async () => {
    // Collect titles from a large sample of URLs to verify all 5 fixtures are accessible
    // With 25 URLs over 5 buckets, probability of hitting all 5 is very high
    const seenTitles = new Set<string>();
    const urls = Array.from({ length: 25 }, (_, i) =>
      `https://www.youtube.com/watch?v=testid${String(i).padStart(4, "0")}0`
    );
    for (const url of urls) {
      const events = await collectEvents(url);
      const resultEvent = events.find((e) => e.type === "result");
      if (resultEvent?.type === "result") {
        seenTitles.add(resultEvent.workout.workout_title);
      }
    }
    expect(seenTitles.size).toBe(5);
  }, 300000);
});
