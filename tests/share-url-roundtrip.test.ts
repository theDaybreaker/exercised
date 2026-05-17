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
 */
import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import { encodeShareUrl } from "@/lib/share/encode";
import { decodeShareUrl } from "@/lib/share/decode";
import { SharePayloadSchema } from "@/lib/schema/workout";

// Import the fixture — same shape mock.ts uses
import dumbbellLegDay from "@/tests/fixtures/dumbbell-leg-day.json";
import { WorkoutSchema } from "@/lib/schema/workout";

const fixture = WorkoutSchema.parse(dumbbellLegDay);

describe("share URL round-trip (W6, D-16, D-18, T-02-01)", () => {
  it("1. encode → decode round-trip preserves all fields (dumbbell fixture)", () => {
    const { encoded, stripped } = encodeShareUrl(fixture);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    expect(stripped).toEqual([]);

    const decoded = decodeShareUrl(encoded);
    expect(decoded.workout).toEqual(fixture);
    expect(decoded.stripped).toEqual([]);
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
});
