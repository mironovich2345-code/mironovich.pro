type LeadInput = Record<string, unknown>;
type Result = { ok: true; body: LeadInput } | { ok: false; status: 400 | 413; error: "bad_request" | "too_large" };

/** Bound the stream before parsing, including requests without Content-Length. */
export async function readLeadRequest(req: Request, maxCharacters: number): Promise<Result> {
  const bad = { ok: false, status: 400, error: "bad_request" } as const;
  const large = { ok: false, status: 413, error: "too_large" } as const;
  const maxBytes = maxCharacters * 4;
  const length = req.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) return bad;
  if (length !== null && Number(length) > maxBytes) return large;
  if (!req.body) return bad;

  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return large;
      }
      raw += decoder.decode(value, { stream: true });
      if (raw.length > maxCharacters) {
        await reader.cancel();
        return large;
      }
    }
    raw += decoder.decode();
    if (raw.length > maxCharacters) return large;
    const body: unknown = JSON.parse(raw);
    if (typeof body !== "object" || body === null || Array.isArray(body)) return bad;
    const input = body as LeadInput;
    // Missing fields are handled by the existing semantic validation (422).
    for (const key of ["name", "phone", "task", "company", "direction", "page", "website"]) {
      if (key in input && typeof input[key] !== "string") return bad;
    }
    if ("consent" in input && typeof input.consent !== "boolean") return bad;
    // Attribution is optional and sanitised separately; malformed attribution
    // must still degrade to direct/unknown rather than lose a valid lead.
    return { ok: true, body: input };
  } catch {
    await reader.cancel().catch(() => {});
    return bad;
  } finally {
    reader.releaseLock();
  }
}
