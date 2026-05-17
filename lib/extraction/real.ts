import type { ExtractionService } from "./service";

/**
 * RealExtractionService — Phase 2 stub.
 *
 * T-01-07 mitigation: throws a clear error if EXTRACT_MODE=real is
 * accidentally set in Phase 1, so the failure mode is visible in logs
 * and the demo returns a clear error: UNKNOWN event rather than a generic 500.
 *
 * Phase 2 replaces this throw with the real captions + GPT-4o pipeline.
 */
export const RealExtractionService: ExtractionService = {
  async *extract(_url: string) {
    throw new Error(
      "Real extraction not implemented in Phase 1 — set EXTRACT_MODE=mock or implement RealExtractionService in Phase 2"
    );
    // unreachable — TypeScript needs this for the generator return type
    yield* ([] as never[]);
  },
};
