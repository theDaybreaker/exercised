/**
 * Share URL encode/decode round-trip tests (W6, D-16, D-17, D-18, T-02-01)
 *
 * Covers:
 * 1. Round-trip equality for the dumbbell-leg-day fixture
 * 2. Tampered-base64 decode throws "Invalid share link"
 * 3. schema_version: "999" decode throws "newer version of Exercised"
 * 4. JSON > 50,000 chars throws (DoS cap, T-02-01)
 * 5. SharePayloadSchema.parse with explicit stripped: []
 * 6. SharePayloadSchema.parse without stripped (defaults to [])
 * 7. Non-empty stripped array decodes correctly (W6 Plan 01-04 forward-compat)
 * 8. hypertrophy-12 strip round-trip: strippedOnEncode === strippedOnDecode (D-17)
 */
import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import { encodeShareUrl } from "@/lib/share/encode";
import { decodeShareUrl } from "@/lib/share/decode";
import { SharePayloadSchema } from "@/lib/schema/workout";

// Import the fixture — same shape mock.ts uses
import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";
import hypertrophy12 from "@/tests/fixtures/hypertrophy-12-exercises.json";
import { WorkoutSchema } from "@/lib/schema/workout";

const fixture = WorkoutSchema.parse(dumbbellLegDay);

describe("share URL round-trip (W6, D-16, D-18, T-02-01)", () => {
  it("1. encode → decode round-trip preserves decode equality (dumbbell fixture)", () => {
    // Note: dumbbell-leg-day fixture compresses to 2089 chars (> 2048 threshold),
    // so the strip chain removes sourceQuote to fit — stripped: ["sourceQuote"].
    // The decoded workout is equal to the encoded workout (with sourceQuote nulled).
    const { encoded, stripped } = encodeShareUrl(fixture);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    expect(encoded.length).toBeLessThanOrEqual(2048);

    const decoded = decodeShareUrl(encoded);
    expect(decoded.stripped).toEqual(stripped); // round-trip preserves strip info
    // The decoded workout should match the encoded candidate (stripped fields nulled)
    if (stripped.includes("sourceQuote")) {
      const expectedWorkout = {
        ...fixture,
        routine: fixture.routine.map((item) =>
          item.type === "standard_set"
            ? { ...item, sourceQuote: null }
            : { ...item, exercises: item.exercises.map((ex) => ({ ...ex, sourceQuote: null })) }
        ),
      };
      expect(decoded.workout).toEqual(expectedWorkout);
    } else {
      expect(decoded.workout).toEqual(fixture);
      expect(stripped).toEqual([]);
    }
  });

  it("2. decode rejects tampered-base64 with 'Invalid share link'", () => {
    expect(() => decodeShareUrl("tampered-base64-garbage!!!")).toThrow(
      "Invalid share link"
    );
  });

  it("3. decode of schema_version:'999' throws 'newer version of Exercised'", () => {
    const badPayload = {
      workout: { ...fixture, schema_version: "999" },
      stripped: [],
    };
    const encoded = LZString.compressToEncodedURIComponent(
      JSON.stringify(badPayload)
    );
    expect(() => decodeShareUrl(encoded)).toThrow(
      "newer version of Exercised"
    );
  });

  it("4. decode of json > 50,000 chars throws (DoS sanity cap, T-02-01)", () => {
    // Create a giant payload that decompresses to > 50,000 chars
    const giant = "x".repeat(55_000);
    const encoded = LZString.compressToEncodedURIComponent(giant);
    expect(() => decodeShareUrl(encoded)).toThrow();
  });

  it("5. SharePayloadSchema.parse succeeds with explicit stripped: []", () => {
    const result = SharePayloadSchema.parse({ workout: fixture, stripped: [] });
    expect(result.stripped).toEqual([]);
    expect(result.workout).toEqual(fixture);
  });

  it("6. SharePayloadSchema.parse succeeds without stripped (defaults to [])", () => {
    const result = SharePayloadSchema.parse({ workout: fixture });
    expect(result.stripped).toEqual([]);
    expect(result.workout).toEqual(fixture);
  });

  it("7. Non-empty stripped array decodes correctly (W6 — Plan 01-04 forward-compat)", () => {
    // Plan 01-04 will produce payloads with stripped: ["sourceQuote"]
    // Plan 01-02 decoder must handle this correctly
    const payload = { workout: fixture, stripped: ["sourceQuote"] };
    const encoded = LZString.compressToEncodedURIComponent(
      JSON.stringify(payload)
    );
    const decoded = decodeShareUrl(encoded);
    expect(decoded.stripped).toEqual(["sourceQuote"]);
    expect(decoded.workout).toEqual(fixture);
  });

  it("8. hypertrophy-12 strip round-trip: strippedOnEncode === strippedOnDecode (D-17)", () => {
    // Plan 01-04: verify the hypertrophy fixture's strip info survives the encode/decode round-trip
    const hypertrophyFixture = WorkoutSchema.parse(hypertrophy12);
    const { encoded, stripped: strippedOnEncode } = encodeShareUrl(hypertrophyFixture);
    expect(encoded.length).toBeLessThanOrEqual(2048);
    expect(strippedOnEncode.length).toBeGreaterThan(0); // at least sourceQuote stripped

    const { workout: decoded, stripped: strippedOnDecode } = decodeShareUrl(encoded);
    expect(strippedOnDecode).toEqual(strippedOnEncode);

    // Stripped exercises should have null sourceQuote if sourceQuote was stripped
    if (strippedOnEncode.includes("sourceQuote")) {
      for (const item of decoded.routine) {
        if (item.type === "standard_set") {
          expect(item.sourceQuote).toBeNull();
        } else {
          for (const ex of item.exercises) {
            expect(ex.sourceQuote).toBeNull();
          }
        }
      }
    }
  });

  it("9. video_url: null round-trips correctly (D-25e)", () => {
    // Fixture has video_url: null after Task 2 backfill
    const workoutWithNullUrl = WorkoutSchema.parse({ ...fixture, video_url: null });
    const { encoded } = encodeShareUrl(workoutWithNullUrl);
    const decoded = decodeShareUrl(encoded);
    expect(decoded.workout.video_url).toBeNull();
  });

  it("10. video_url: valid URL round-trips correctly (D-25e)", () => {
    const workoutWithUrl = WorkoutSchema.parse({
      ...fixture,
      video_url: "https://youtube.com/watch?v=test123",
    });
    const { encoded } = encodeShareUrl(workoutWithUrl);
    const decoded = decodeShareUrl(encoded);
    expect(decoded.workout.video_url).toBe("https://youtube.com/watch?v=test123");
  });
});
