// ONE central generation router for Scale Breakers mural rendering.
//
// Every mural image request goes through `renderImageWithFailover`. It owns
// provider/model/credential selection, health tracking, cooldowns, bounded
// retries and failover. Nothing else in the app decides which model or key to
// use.
//
// The full mural request (wall image + artwork images + the assembled mural
// prompt) is built ONCE by the caller and handed to the router as a
// `MuralRequest`. Every attempt — on every model and every credential — sends
// that same complete request. The router never degrades a mural request to a
// text-only prompt.

export type FailureKind =
  | "rate_limit"
  | "auth"
  | "credits"
  | "model_unavailable"
  | "timeout"
  | "server"
  | "network"
  | "no_image"
  | "bad_request";

export interface MuralRequest {
  /** Fully assembled mural prompt — never reduced or truncated on failover. */
  prompt: string;
  /** Artwork images as data URLs (1-3). Always resent. */
  artworkDataUrls: string[];
  /** Optional wall photo as a data URL. Always resent when present. */
  wallDataUrl: string | null;
}

export interface Credential {
  key: string;
  /** Safe, non-secret label for telemetry — never the key itself. */
  label: string;
}

export interface Resource {
  id: string;
  provider: string;
  model: string;
  credential: Credential;
}

export type HealthState =
  | "available"
  | "rate_limited"
  | "auth_failure"
  | "model_unavailable"
  | "temporarily_unavailable";

export interface HealthRecord {
  state: HealthState;
  cooldownUntil: number;
  recentFailures: number;
  lastSuccess: number | null;
  lastFailure: FailureKind | null;
}

export interface AttemptLog {
  resourceId: string;
  provider: string;
  model: string;
  credential: string;
  attempt: number;
  ms: number;
  ok: boolean;
  failure?: FailureKind;
}

export type RenderOutcome =
  | { ok: true; imageUrl: string; resource: Resource; attempts: AttemptLog[] }
  | {
      ok: false;
      failure: FailureKind;
      /** Message safe to show a user — never raw status codes or provider internals. */
      message: string;
      attempts: AttemptLog[];
    };

/**
 * Compatible image-generation models, in priority order. Every entry accepts
 * text + image input on the gateway chat-completions endpoint, so the complete
 * mural request (wall + artwork + instructions) survives a model change.
 */
export const MODEL_CASCADE = [
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image",
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-lite-image",
] as const;

const COOLDOWN_MS: Record<FailureKind, number> = {
  rate_limit: 60_000,
  auth: 15 * 60_000,
  credits: 15 * 60_000,
  model_unavailable: 30 * 60_000,
  timeout: 30_000,
  server: 120_000,
  network: 30_000,
  no_image: 15_000,
  bad_request: 0,
};

const STATE_FOR: Record<FailureKind, HealthState> = {
  rate_limit: "rate_limited",
  auth: "auth_failure",
  credits: "temporarily_unavailable",
  model_unavailable: "model_unavailable",
  timeout: "temporarily_unavailable",
  server: "temporarily_unavailable",
  network: "temporarily_unavailable",
  no_image: "temporarily_unavailable",
  bad_request: "available",
};

const USER_MESSAGE: Record<FailureKind, string> = {
  rate_limit: "The image service is busy right now. Please try again in a moment.",
  auth: "No usable image service credential is available for this render.",
  credits: "Image rendering credits are used up. Add credits to keep rendering.",
  model_unavailable: "No compatible image service could complete this request.",
  timeout: "The image service took too long to respond. Please try again.",
  server: "The image service is temporarily unavailable. Please try again.",
  network: "Could not reach the image service. Please try again.",
  no_image: "The image service did not return a mockup. Please try again.",
  bad_request: "This request could not be rendered. Try smaller or different images.",
};

// ---------------------------------------------------------------------------
// Health registry (per server instance, in memory)
// ---------------------------------------------------------------------------

const health = new Map<string, HealthRecord>();

export function getHealth(id: string, now = Date.now()): HealthRecord {
  const rec = health.get(id);
  if (!rec) {
    return {
      state: "available",
      cooldownUntil: 0,
      recentFailures: 0,
      lastSuccess: null,
      lastFailure: null,
    };
  }
  if (rec.cooldownUntil && rec.cooldownUntil <= now) {
    // Temporary failures recover automatically once the cooldown expires.
    const recovered: HealthRecord = { ...rec, state: "available", cooldownUntil: 0 };
    health.set(id, recovered);
    return recovered;
  }
  return rec;
}

export function isUsable(id: string, now = Date.now()): boolean {
  return getHealth(id, now).cooldownUntil <= now;
}

export function markFailure(id: string, failure: FailureKind, now = Date.now()) {
  const prev = getHealth(id, now);
  health.set(id, {
    state: STATE_FOR[failure],
    cooldownUntil: COOLDOWN_MS[failure] ? now + COOLDOWN_MS[failure] : 0,
    recentFailures: prev.recentFailures + 1,
    lastSuccess: prev.lastSuccess,
    lastFailure: failure,
  });
}

export function markSuccess(id: string, now = Date.now()) {
  health.set(id, {
    state: "available",
    cooldownUntil: 0,
    recentFailures: 0,
    lastSuccess: now,
    lastFailure: null,
  });
}

export function resetHealth() {
  health.clear();
}

export function healthSnapshot(): Record<string, HealthRecord> {
  return Object.fromEntries(health.entries());
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

export function classifyStatus(status: number, body = ""): FailureKind {
  if (status === 429) return "rate_limit";
  if (status === 401) return "auth";
  if (status === 403) return "auth";
  if (status === 402) return "credits";
  if (status === 404) return "model_unavailable";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server";
  if (status === 400) {
    return /model|not supported|unsupported|unavailable/i.test(body)
      ? "model_unavailable"
      : "bad_request";
  }
  return "server";
}

// ---------------------------------------------------------------------------
// Resource plan
// ---------------------------------------------------------------------------

/**
 * Build the ordered list of provider/model/credential combinations to try.
 * Primary model across all credentials first, then the alternate models — so a
 * bad credential fails over before the whole model cascade is burned.
 */
export function buildResourcePlan(
  credentials: Credential[],
  models: readonly string[] = MODEL_CASCADE,
): Resource[] {
  const plan: Resource[] = [];
  for (const model of models) {
    for (const credential of credentials) {
      plan.push({
        id: `google:${model}:${credential.label}`,
        provider: "google",
        model,
        credential,
      });
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------

export interface RouterDeps {
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onAttempt?: (log: AttemptLog) => void;
  /** Per-attempt bound so a hung provider can never leave the user waiting. */
  timeoutMs?: number;
  /** Bounded retries for transient failures (timeout / 5xx / network). */
  maxTransientRetries?: number;
}

function buildBody(request: MuralRequest, model: string): string {
  // The COMPLETE mural request travels with every attempt: prompt + artwork
  // images + wall photo. Never reduced to text-only.
  const content: Array<Record<string, unknown>> = [{ type: "text", text: request.prompt }];
  for (const artwork of request.artworkDataUrls) {
    content.push({ type: "image_url", image_url: { url: artwork } });
  }
  if (request.wallDataUrl) {
    content.push({ type: "image_url", image_url: { url: request.wallDataUrl } });
  }
  return JSON.stringify({
    model,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
  });
}

export function assertCompleteRequest(request: MuralRequest) {
  if (!request.prompt || request.prompt.length < 40) {
    throw new Error("Generation router: mural prompt missing — refusing to render");
  }
  if (!request.artworkDataUrls.length) {
    throw new Error("Generation router: artwork missing — refusing to render");
  }
}

export async function renderImageWithFailover(
  request: MuralRequest,
  resources: Resource[],
  deps: RouterDeps = {},
): Promise<RenderOutcome> {
  assertCompleteRequest(request);

  const doFetch = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const timeoutMs = deps.timeoutMs ?? 180_000;
  const maxTransientRetries = deps.maxTransientRetries ?? 1;

  const attempts: AttemptLog[] = [];
  let lastFailure: FailureKind = "server";

  const usable = resources.filter((r) => isUsable(r.id, now()));
  const plan = usable.length > 0 ? usable : [];

  if (plan.length === 0) {
    return {
      ok: false,
      failure: "model_unavailable",
      message: "No compatible image service is available right now. Please try again shortly.",
      attempts,
    };
  }

  for (const resource of plan) {
    if (!isUsable(resource.id, now())) continue;

    for (let attempt = 1; attempt <= maxTransientRetries + 1; attempt++) {
      const started = now();
      let failure: FailureKind | null = null;
      let imageUrl: string | null = null;

      try {
        const res = await doFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resource.credential.key}`,
            "Content-Type": "application/json",
          },
          body: buildBody(request, resource.model),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          failure = classifyStatus(res.status, text);
        } else {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
          };
          imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
          if (!imageUrl) failure = "no_image";
        }
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        failure = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
      }

      const log: AttemptLog = {
        resourceId: resource.id,
        provider: resource.provider,
        model: resource.model,
        credential: resource.credential.label,
        attempt,
        ms: now() - started,
        ok: !failure,
        ...(failure ? { failure } : {}),
      };
      attempts.push(log);
      deps.onAttempt?.(log);

      if (!failure && imageUrl) {
        markSuccess(resource.id, now());
        return { ok: true, imageUrl, resource, attempts };
      }

      lastFailure = failure ?? "server";

      const transient =
        lastFailure === "timeout" || lastFailure === "server" || lastFailure === "network";
      if (transient && attempt <= maxTransientRetries) {
        // Bounded exponential backoff, then one more try on the same resource.
        await sleep(Math.min(4_000, 500 * 2 ** (attempt - 1)));
        continue;
      }

      markFailure(resource.id, lastFailure, now());
      break; // fail over to the next compatible resource
    }
  }

  return { ok: false, failure: lastFailure, message: USER_MESSAGE[lastFailure], attempts };
}
