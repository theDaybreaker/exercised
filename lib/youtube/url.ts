// Source: synthesized from INPT-02 + INPT-03 + CONTEXT.md D-13 + RESEARCH Pattern 2
const YT_PATTERN =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

const TRACKING_PARAMS = [
  "si",
  "feature",
  "t",
  "list",
  "index",
  "pp",
  "utm_source",
  "utm_medium",
];

export function parseYouTubeUrl(input: string): {
  videoId: string | null;
  isValid: boolean;
  cleaned: string;
} {
  const trimmed = input.trim();

  // INPT-03: auto-trim tracking params
  let cleaned = trimmed;
  try {
    const u = new URL(trimmed);
    for (const param of TRACKING_PARAMS) u.searchParams.delete(param);
    cleaned = u.toString();
  } catch {
    // not a URL — keep as-is, validation below will fail
  }

  const m = trimmed.match(YT_PATTERN);
  if (!m) return { videoId: null, isValid: false, cleaned };
  return { videoId: m[1], isValid: true, cleaned };
}

/**
 * Extracts the real client IP from request headers.
 *
 * RESEARCH Pattern 2: Vercel overwrites x-forwarded-for with the true client IP
 * at the edge — cannot be spoofed at the client level (T-02-04-03 accept).
 *
 * Priority: x-forwarded-for → x-real-ip → "127.0.0.1" (local fallback for dev)
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}
