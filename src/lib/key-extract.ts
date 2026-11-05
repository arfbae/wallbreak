// Browser-safe: find API keys inside any pasted text and guess their service.

export type DetectedProvider =
  | "google"
  | "huggingface"
  | "fal"
  | "lovable"
  | "recraft"
  | "cloudinary"
  | "unknown";

export interface KeyMatch {
  key: string;
  provider: DetectedProvider;
  label: string;
  /** Whether the mural renderer can actually use it. */
  usable: boolean;
  note?: string;
}

const LABELS: Record<DetectedProvider, string> = {
  google: "Google Gemini",
  huggingface: "Hugging Face",
  fal: "fal.ai",
  lovable: "Lovable AI",
  recraft: "Recraft",
  cloudinary: "Cloudinary",
  unknown: "Unknown service",
};

const USABLE = new Set<DetectedProvider>(["google", "huggingface", "fal", "lovable"]);

export function classifyKey(raw: string, context = ""): DetectedProvider {
  const k = raw.trim();
  if (/^AIza[\w-]{30,}$/.test(k)) return "google";
  if (/^hf_[A-Za-z0-9]{20,}$/.test(k)) return "huggingface";
  if (/^fal_sk_/.test(k) || /^[0-9a-f-]{36}:[0-9a-f]{32}$/i.test(k)) return "fal";
  if (/^fal_[\w:]{20,}$/.test(k)) return "fal";
  if (/^cloudinary:\/\//i.test(k)) return "cloudinary";
  if (/^(sk-lov|lov_)/i.test(k)) return "lovable";
  const ctx = context.toLowerCase();
  if (/recraft/.test(ctx) && /^[A-Za-z0-9]{48,80}$/.test(k)) return "recraft";
  if (/cloudinary/.test(ctx)) return "cloudinary";
  if (/lovable/.test(ctx) && /^[\w-]{24,}$/.test(k)) return "lovable";
  return "unknown";
}

const TOKEN = /cloudinary:\/\/\S+|[A-Za-z0-9_][A-Za-z0-9_:\-]{19,}/g;

/** Pull every key-looking token out of pasted text, with its likely service. */
export function extractKeys(text: string): KeyMatch[] {
  const out: KeyMatch[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const context = [lines[i - 2], lines[i - 1], line].filter(Boolean).join(" ");
    for (const m of line.matchAll(TOKEN)) {
      const key = m[0].replace(/[.,;)"'`]+$/, "");
      if (seen.has(key)) continue;
      // Skip plain words / env names / pure numbers (e.g. account IDs).
      if (/^[A-Z_]+$/.test(key) || /^\d+$/.test(key)) continue;
      if (!/\d/.test(key) && !/^cloudinary/i.test(key)) continue;
      const provider = classifyKey(key, context);
      seen.add(key);
      out.push({
        key,
        provider,
        label: LABELS[provider],
        usable: USABLE.has(provider),
        note:
          provider === "recraft"
            ? "Recraft can't edit a wall photo, so it can't make mockups"
            : provider === "cloudinary"
              ? "Cloudinary stores pictures but can't make mockups"
              : provider === "unknown"
                ? "Couldn't tell which service this is for"
                : undefined,
      });
    }
  });
  return out;
}

export function maskKey(key: string): string {
  return key.length <= 10 ? "••••" : `${key.slice(0, 6)}…${key.slice(-4)}`;
}
