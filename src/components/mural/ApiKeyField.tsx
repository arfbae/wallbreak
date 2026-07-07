import { useEffect, useState } from "react";
import { Key, Eye, EyeOff, Check, Server } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mural.apiKeys";
const FALLBACK_KEY = "mural.serverFallback";

export interface ApiKeyState {
  keys: string[];
  serverFallback: boolean;
}

interface Props {
  value: ApiKeyState;
  onChange: (state: ApiKeyState) => void;
}

export function ApiKeyField({ value, onChange }: Props) {
  const [reveal, setReveal] = useState(false);
  const [draft, setDraft] = useState(value.keys.join("\n"));
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setDraft(value.keys.join("\n")), [value.keys]);

  const save = () => {
    const keys = draft
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter(Boolean);
    const next = { ...value, keys };
    onChange(next);
    if (keys.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const toggleFallback = () => {
    const next = { ...value, serverFallback: !value.serverFallback };
    onChange(next);
    localStorage.setItem(FALLBACK_KEY, next.serverFallback ? "1" : "0");
  };

  const dirty = draft.trim() !== value.keys.join("\n").trim();
  const count = value.keys.length;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2">
        <Key className={cn("h-4 w-4 shrink-0", count > 0 ? "text-emerald-400" : "text-white/40")} />
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
            AI API Keys
          </span>
          <span className="text-[10px] text-white/40">
            {count > 0
              ? `${count} user key${count > 1 ? "s" : ""} · tried in order`
              : "Optional · using server key"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-white/60 hover:bg-white/5 hover:text-white"
        >
          {expanded ? "Hide" : count > 0 ? "Edit" : "Add"}
        </button>
        <button
          type="button"
          onClick={toggleFallback}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors",
            value.serverFallback
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              : "border-white/10 text-white/40 hover:text-white",
          )}
          title="Fall back to server LOVABLE_API_KEY on 401/403"
        >
          <Server className="h-3 w-3" />
          Fallback {value.serverFallback ? "on" : "off"}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            placeholder={"sk-…\nsk-…\n(one key per line — tried in order, then server key)"}
            rows={3}
            className={cn(
              "w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white outline-none placeholder:text-white/25 focus:border-[var(--studio-accent)]/60",
              !reveal && "[-webkit-text-security:disc] [text-security:disc]",
            )}
            spellCheck={false}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:bg-white/5 hover:text-white"
            >
              {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {reveal ? "Hide" : "Show"}
            </button>
            {dirty && (
              <button
                type="button"
                onClick={save}
                className="flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-400/20"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
            )}
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.15em] text-white/30">
              401/403 → next key → {value.serverFallback ? "server" : "fail"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function loadStoredApiKeyState(): ApiKeyState {
  if (typeof window === "undefined") return { keys: [], serverFallback: true };
  let keys: string[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) keys = parsed.filter((k) => typeof k === "string" && k.trim());
    } else {
      // migrate legacy single-key storage
      const legacy = localStorage.getItem("mural.apiKey");
      if (legacy) keys = [legacy];
    }
  } catch {
    /* ignore */
  }
  const fb = localStorage.getItem(FALLBACK_KEY);
  return { keys, serverFallback: fb === null ? true : fb === "1" };
}
