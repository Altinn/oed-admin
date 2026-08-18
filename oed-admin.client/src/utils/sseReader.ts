/**
 * Reads an SSE stream off a fetch Response.
 *
 * The browser's own EventSource cannot send an Authorization header, so it cannot reach an
 * endpoint behind RequireAdminRole - and a token in the query string would land in the audit
 * log. Hence fetchWithMsal plus this reader.
 *
 * Resolves when the server closes the stream or the signal aborts.
 */
export async function readSseStream<T>(
  response: Response,
  onMessage: (payload: T) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) {
    throw new Error("Svaret inneholder ingen strøm");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const cancel = () => { void reader.cancel(); };
  signal.addEventListener("abort", cancel);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trim())
          .join("\n");

        if (data.length > 0) {
          onMessage(JSON.parse(data) as T);
        }

        separator = buffer.indexOf("\n\n");
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
