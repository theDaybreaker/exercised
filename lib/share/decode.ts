/**
 * decodeShareUrl — lz-string + SharePayloadSchema deserialization.
 *
 * T-02-01 threat mitigations:
 * - lz-string decompression (null → throw "Invalid share link")
 * - 50,000-char cap before JSON.parse (DoS sanity cap)
 * - SharePayloadSchema.safeParse validation — only schema-valid output escapes
 * - D-18 schema-version mismatch → friendly user-facing error
 * - D-16 share-link hydration → dispatches hydrate action in ExtractFlow
 */

import LZString from "lz-string";
import {
  SharePayloadSchema,
  type StripField,
  type Workout,
} from "@/lib/schema/workout";

export function decodeShareUrl(
  encoded: string
): { workout: Workout; stripped: StripField[] } {
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) throw new Error("Invalid share link");
  if (json.length > 50_000) throw new Error("Share link payload too large");

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid share link payload");
  }

  const result = SharePayloadSchema.safeParse(parsed);
  if (result.success) {
    return { workout: result.data.workout, stripped: result.data.stripped };
  }

  // D-18 schema-version mismatch — look for any issue whose path mentions schema_version
  const versionIssue = result.error.issues.find(
    (i) =>
      i.path.join(".") === "workout.schema_version" ||
      i.path[0] === "schema_version"
  );
  if (versionIssue) {
    throw new Error(
      "This share link was created with a newer version of Exercised — try pasting the original YouTube URL instead."
    );
  }
  throw new Error("Share link payload failed validation");
}
