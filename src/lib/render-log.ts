/**
 * Structured logging for a single render attempt.
 *
 * Every attempt gets a correlation id so the prompt guard, the gateway call
 * and the post-render medium classifier can all be tied together in the logs.
 */

export type RenderLogEvent = {
  cid: string;
  event: string;
  scene?: string;
  variant?: string;
  artworks?: number;
  promptHash?: string;
  promptChars?: number;
  medium?: "ok" | "wrong" | "unknown";
  offenders?: string[];
  status?: number;
  key?: string;
  detail?: string;
  ms?: number;
};

/** Short, collision-resistant-enough id for correlating one render attempt. */
export function newCorrelationId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `r_${Date.now().toString(36)}${rand}`;
}

/** Stable, dependency-free content hash (FNV-1a, 32-bit, hex). */
export function hashPrompt(prompt: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function formatRenderLog(e: RenderLogEvent): string {
  const parts = Object.entries(e)
    .filter(([k, v]) => k !== "cid" && k !== "event" && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") || "-" : String(v)}`);
  return `[mural:${e.event}] cid=${e.cid}${parts.length ? ` ${parts.join(" ")}` : ""}`;
}

export function logRender(e: RenderLogEvent, level: "info" | "warn" | "error" = "info"): string {
  const line = formatRenderLog(e);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
  return line;
}
