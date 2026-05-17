import type { ExtractEvent } from "@/lib/schema/workout";

export interface ExtractionService {
  extract(url: string): AsyncIterable<ExtractEvent>;
}

/**
 * Factory that reads EXTRACT_MODE env var and returns the appropriate service.
 *
 * PIPE-06: Default to mock to ensure Phase 1 never accidentally hits real AI.
 * D-19: Refresh behavior is ephemeral — mock-default enforces this.
 *
 * Dynamic import keeps real-pipeline deps out of the mock build.
 * In Phase 1, the "real" branch throws (T-01-07 mitigation in real.ts).
 */
export async function getExtractionService(): Promise<ExtractionService> {
  const mode = process.env.EXTRACT_MODE ?? "mock";
  if (mode === "real") {
    const { RealExtractionService } = await import("./real");
    return RealExtractionService;
  }
  const { MockExtractionService } = await import("./mock");
  return MockExtractionService;
}
