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
import { callHfSpace, spaceSupportsRequest } from "./hf-space";

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

/**
 * Image services that can take the COMPLETE mural request (wall photo +
 * artwork images + instructions) and return an edited image. Text-only or
 * single-image services (Recraft, Cloudinary) are deliberately not here.
 */
export type ProviderId = "lovable" | "google" | "fal" | "huggingface" | "hfspace";

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  lovable: "Built-in AI",
  google: "Google Gemini",
  fal: "fal.ai",
  huggingface: "Hugging Face",
  hfspace: "Hugging Face free Space",
};

/** Models per provider, best first. Each accepts several input images. */
export const PROVIDER_MODELS: Record<ProviderId, readonly string[]> = {
  lovable: [
    "google/gemini-3.1-flash-image",
    "google/gemini-3-pro-image",
    "google/gemini-2.5-flash-image",
    "google/gemini-3.1-flash-lite-image",
  ],
  google: ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"],
  fal: ["fal-ai/nano-banana-pro/edit", "fal-ai/nano-banana/edit"],
  // Hugging Face Inference Providers, routed to fal's multi-image Qwen editor.
  huggingface: ["fal-ai/qwen-image-edit-2509"],
  hfspace: ["Qwen/Qwen-Image-Edit-2509"],
};

/** What to tell the user when a provider's account has no money on it. */
const PROVIDER_CREDITS_HINT: Record<ProviderId, string> = {
  lovable: "credits used up",
  google: "no image allowance — turn on billing in Google AI Studio",
  fal: "account needs a top-up",
  huggingface: "needs pre-paid credits",
  hfspace: "free allowance unavailable",
};

/**
 * Work out which service a pasted key belongs to from its shape. Unknown
 * shapes are assumed to be Lovable AI keys (the original behaviour).
 */
export function detectKeyProvider(key: string): ProviderId | "unsupported" {
  const k = key.trim();
  if (/^AIza[\w-]{20,}$/.test(k)) return "google";
  if (/^hf_\w{10,}$/.test(k)) return "huggingface";
  if (/^fal_/.test(k) || /^[0-9a-f-]{36}:[0-9a-f]{32}$/i.test(k)) return "fal";
  if (/^cloudinary:\/\//i.test(k) || /^CLOUDINARY_URL=/i.test(k)) return "unsupported";
  return "lovable";
}

export interface Credential {
  key: string;
  /** Safe, non-secret label for telemetry — never the key itself. */
  label: string;
  /** Which service the key belongs to. Defaults to the built-in AI service. */
  provider?: ProviderId;
}

export interface Resource {
  id: string;
  provider: ProviderId;
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
export const MODEL_CASCADE = PROVIDER_MODELS.lovable;

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

/**
 * When every option fails, report the reason the user can act on (credits used
 * up, bad key, busy) rather than whichever failure happened to come last.
 */
const FAILURE_PRIORITY: FailureKind[] = [
  "credits",
  "auth",
  "rate_limit",
  "bad_request",
  "timeout",
  "server",
  "network",
  "no_image",
  "model_unavailable",
];

export function mostTellingFailure(failures: (FailureKind | null | undefined)[]): FailureKind {
  const seen = new Set(failures.filter(Boolean));
  return FAILURE_PRIORITY.find((f) => seen.has(f)) ?? "model_unavailable";
}

export function failureMessage(failure: FailureKind): string {
  return USER_MESSAGE[failure];
}

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

const OUT_OF_MONEY =
  /exhausted balance|locked|top_?up|pre-?paid|insufficient (credit|balance|funds)|billing|purchase|limit: 0|free_tier|payment required/i;

export function classifyStatus(status: number, body = ""): FailureKind {
  // Providers report an empty account in different ways (402, 403 "locked",
  // 429 "limit: 0"). All of them mean the same thing to the user.
  if ((status === 402 || status === 403 || status === 429) && OUT_OF_MONEY.test(body)) {
    return "credits";
  }
  if (status === 400 && /api key not valid|api_key_invalid|invalid api key/i.test(body)) {
    return "auth";
  }
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
export function buildResourcePlan(credentials: Credential[], models?: readonly string[]): Resource[] {
  // Round-robin by model depth: every credential's best model first (in the
  // caller's order), then every credential's second model, and so on — so an
  // empty account fails over to the next service before burning its cascade.
  const plan: Resource[] = [];
  const depth = Math.max(
    0,
    ...credentials.map((c) => (models ?? PROVIDER_MODELS[c.provider ?? "lovable"]).length),
  );
  for (let d = 0; d < depth; d++) {
    for (const credential of credentials) {
      const provider = credential.provider ?? "lovable";
      const model = (models ?? PROVIDER_MODELS[provider])[d];
      if (!model) continue;
      plan.push({ id: `${provider}:${model}:${credential.label}`, provider, model, credential });
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

function splitDataUrl(url: string): { mimeType: string; data: string } {
  const m = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(url);
  return { mimeType: m?.[1] || "image/png", data: m?.[2] ?? "" };
}

/** Images in the order the mural prompt describes them: artwork(s) first, wall last. */
function orderedImages(request: MuralRequest): string[] {
  return [...request.artworkDataUrls, ...(request.wallDataUrl ? [request.wallDataUrl] : [])];
}

/**
 * Build the provider-specific HTTP call. Every provider receives the complete
 * mural request: the full prompt plus every artwork image and the wall photo.
 */
export function buildProviderRequest(
  resource: Resource,
  request: MuralRequest,
): { url: string; init: RequestInit } {
  const key = resource.credential.key;
  const json = { "Content-Type": "application/json" };
  switch (resource.provider) {
    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${resource.model}:generateContent`,
        init: {
          method: "POST",
          headers: { ...json, "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: request.prompt },
                  ...orderedImages(request).map((u) => ({ inlineData: splitDataUrl(u) })),
                ],
              },
            ],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        },
      };
    case "fal":
    case "huggingface": {
      const body = JSON.stringify({
        prompt: request.prompt,
        image_urls: orderedImages(request),
        num_images: 1,
        output_format: "png",
        sync_mode: true,
      });
      return resource.provider === "fal"
        ? {
            url: `https://fal.run/${resource.model}`,
            init: { method: "POST", headers: { ...json, Authorization: `Key ${key}` }, body },
          }
        : {
            url: `https://router.huggingface.co/fal-ai/${resource.model}`,
            init: { method: "POST", headers: { ...json, Authorization: `Bearer ${key}` }, body },
          };
    }
    default:
      return {
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        init: {
          method: "POST",
          headers: { ...json, Authorization: `Bearer ${key}` },
          body: buildBody(request, resource.model),
        },
      };
  }
}

/** Pull the finished image out of each provider's response shape. */
export function extractImage(provider: ProviderId, data: unknown): string | null {
  const d = data as Record<string, any> | null;
  if (!d) return null;
  if (provider === "google") {
    const parts: any[] = d.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
    const inline = img?.inlineData ?? img?.inline_data;
    return inline ? `data:${inline.mimeType ?? inline.mime_type ?? "image/png"};base64,${inline.data}` : null;
  }
  if (provider === "fal" || provider === "huggingface" || provider === "hfspace") {
    const url = d.images?.[0]?.url ?? d.image?.url;
    return typeof url === "string" && url ? url : null;
  }
  return d.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
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

  const usable = resources.filter((r) => isUsable(r.id, now()) && (r.provider !== "hfspace" || spaceSupportsRequest(request.artworkDataUrls, request.wallDataUrl)));
  const plan = usable.length > 0 ? usable : [];

  if (plan.length === 0) {
    // Everything is cooling down: say why (e.g. credits used up) instead of a generic line.
    const reason = mostTellingFailure(resources.map((r) => getHealth(r.id, now()).lastFailure));
    return {
      ok: false,
      failure: reason,
      message:
        reason === "model_unavailable"
          ? "No compatible image service is available right now. Please try again shortly."
          : USER_MESSAGE[reason],
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
        const res = resource.provider === "hfspace"
          ? await callHfSpace(orderedImages(request), request.prompt, resource.credential.key, doFetch)
          : await (async () => {
              const { url, init } = buildProviderRequest(resource, request);
              return doFetch(url, { ...init, ...(deps.timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}) });
            })();
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          failure = classifyStatus(res.status, text);
        } else {
          imageUrl = extractImage(resource.provider, await res.json());
          if (imageUrl && /^https?:/i.test(imageUrl)) {
            imageUrl = await toDataUrl(imageUrl, doFetch);
          }
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
      if (transient && resource.provider !== "hfspace" && attempt <= maxTransientRetries) {
        // Bounded exponential backoff, then one more try on the same resource.
        await sleep(Math.min(4_000, 500 * 2 ** (attempt - 1)));
        continue;
      }

      markFailure(resource.id, lastFailure, now());
      if (lastFailure === "auth" || lastFailure === "credits") {
        // A rejected or empty account fails for every model on it — skip them.
        for (const other of plan) {
          if (
            other.id !== resource.id &&
            other.provider === resource.provider &&
            other.credential.label === resource.credential.label
          ) {
            markFailure(other.id, lastFailure, now());
          }
        }
      }
      break; // fail over to the next compatible resource
    }
  }

  const reason = mostTellingFailure([...attempts.map((a) => a.failure), lastFailure]);
  return { ok: false, failure: reason, message: describeFailure(reason, attempts), attempts };
}

const SHORT_REASON: Record<FailureKind, string> = {
  rate_limit: "busy",
  auth: "key rejected",
  credits: "credits used up",
  model_unavailable: "model unavailable",
  timeout: "too slow",
  server: "service down",
  network: "unreachable",
  no_image: "no picture returned",
  bad_request: "request refused",
};

/**
 * Plain-English failure, naming each service tried and why, so the user knows
 * which account to top up or which key to fix. Never includes keys or codes.
 */
export function describeFailure(reason: FailureKind, attempts: AttemptLog[]): string {
  const byProvider = new Map<ProviderId, FailureKind[]>();
  for (const a of attempts) {
    const p = a.provider as ProviderId;
    if (!a.failure) continue;
    byProvider.set(p, [...(byProvider.get(p) ?? []), a.failure]);
  }
  if (byProvider.size <= 1) return USER_MESSAGE[reason];
  const parts = [...byProvider.entries()].map(([p, fs]) => {
    const f = mostTellingFailure(fs);
    const why = f === "credits" ? (PROVIDER_CREDITS_HINT[p] ?? "credits used up") : SHORT_REASON[f];
    return `${PROVIDER_LABEL[p] ?? p}: ${why}`;
  });
  return `No image service could make this mockup. ${parts.join(" · ")}.`;
}

async function toDataUrl(url: string, doFetch: typeof fetch): Promise<string | null> {
  try {
    const r = await doFetch(url);
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}
