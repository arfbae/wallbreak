import { useEffect, useState } from "react";
import { Key, Eye, EyeOff, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mural.apiKey";

interface Props {
  value: string;
  onChange: (key: string) => void;
}

export function ApiKeyField({ value, onChange }: Props) {
  const [reveal, setReveal] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const save = () => {
    const trimmed = draft.trim();
    onChange(trimmed);
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const clear = () => {
    setDraft("");
    onChange("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const dirty = draft.trim() !== value;
  const hasKey = !!value;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <Key className={cn("h-4 w-4 shrink-0", hasKey ? "text-emerald-400" : "text-white/40")} />
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
          AI API Key
        </span>
        <span className="text-[10px] text-white/40">
          {hasKey ? "Using your key" : "Optional · falls back to server"}
        </span>
      </div>
      <input
        type={reveal ? "text" : "password"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder="sk-… or LOVABLE_API_KEY"
        className="ml-2 w-56 rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-white outline-none placeholder:text-white/25 focus:border-[var(--studio-accent)]/60"
      />
      <button
        type="button"
        onClick={() => setReveal((v) => !v)}
        className="rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white"
        title={reveal ? "Hide" : "Show"}
      >
        {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      {dirty && (
        <button
          type="button"
          onClick={save}
          className="rounded-md p-1 text-emerald-400 hover:bg-emerald-400/10"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
      {hasKey && !dirty && (
        <button
          type="button"
          onClick={clear}
          className="rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white"
          title="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function loadStoredApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}
