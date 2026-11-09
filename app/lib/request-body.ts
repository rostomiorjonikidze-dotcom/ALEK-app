export class RequestBodyError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Count actual streamed bytes; Content-Length alone is not a trustworthy limit.
export async function readJsonObject(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestBodyError(415, "Un contenu JSON est requis.");
  }
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new RequestBodyError(413, "Requête trop volumineuse.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, "Requête JSON vide.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RequestBodyError(413, "Requête trop volumineuse.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new RequestBodyError(400, "Un objet JSON est requis.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, "Requête JSON invalide.");
  } finally {
    reader.releaseLock();
  }
}
