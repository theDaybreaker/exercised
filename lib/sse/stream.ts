// Source: nextjs.org Streaming docs (iteratorToStream pattern from MDN)
// Source: upstash.com/blog/sse-streaming-llm-responses (SSE data-line format)

const encoder = new TextEncoder();

/**
 * Converts an AsyncIterable into a ReadableStream of SSE-encoded Uint8Array chunks.
 *
 * Each item from the iterator is JSON-stringified and emitted as:
 *   data: {json}\n\n
 *
 * On iterator error, emits a structured error event before closing.
 * Pitfall 6 mitigation: catches enqueue errors to avoid leaked async iterators.
 */
export function toSSEStream<T>(
  iterator: AsyncIterable<T>
): ReadableStream<Uint8Array> {
  const iter = iterator[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iter.next();
        if (done) {
          controller.close();
          return;
        }
        const line = `data: ${JSON.stringify(value)}\n\n`;
        controller.enqueue(encoder.encode(line));
      } catch (err) {
        // Emit a structured error event so the client can show a useful message
        const errEvent = {
          type: "error" as const,
          code: "UNKNOWN" as const,
          message: err instanceof Error ? err.message : "Stream error",
        };
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`)
          );
        } catch {
          // controller already closed — ignore
        }
        controller.close();
      }
    },
  });
}
