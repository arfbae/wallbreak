import { RefreshCw, Play, Crosshair, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  hasMurals: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onReveal: () => void;
  onProposal: () => void;
  isGenerating: boolean;
  muralIds: string[];
  showDebug: boolean;
  onToggleDebug: () => void;
}


export function ControlDock({
  hasMurals,
  selected,
  onSelect,
  onRetry,
  onReveal,
  onProposal,

  isGenerating,
  muralIds,
  showDebug,
  onToggleDebug,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-md md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Select Mockup
        </div>
        <div className="flex gap-1 rounded-lg bg-black/30 p-1 ring-1 ring-white/5">
          {[0, 1, 2].map((i) => {
            const id = muralIds[i];
            const active = selected === id;
            return (
              <button
                key={i}
                onClick={() => id && onSelect(id)}
                disabled={!hasMurals || !id}
                className={cn(
                  "h-9 w-12 rounded-md font-mono text-sm transition-all",
                  active
                    ? "bg-[var(--studio-accent)] text-black"
                    : hasMurals
                      ? "text-white/70 hover:bg-white/10 hover:text-white"
                      : "text-white/20",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onToggleDebug}
          disabled={!hasMurals}
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg border px-4 font-mono text-xs uppercase tracking-[0.15em] transition-all",
            !hasMurals
              ? "cursor-not-allowed border-white/5 text-white/20"
              : showDebug
                ? "border-[var(--studio-accent)]/60 bg-[var(--studio-accent)]/15 text-[var(--studio-accent)]"
                : "border-white/15 bg-white/[0.04] text-white/80 hover:border-white/30 hover:bg-white/10",
          )}
        >
          <Crosshair className="h-3.5 w-3.5" />
          Align Debug
        </button>
        <button
          onClick={onRetry}
          disabled={!hasMurals || isGenerating}
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg border px-4 font-mono text-xs uppercase tracking-[0.15em] transition-all",
            hasMurals && !isGenerating
              ? "border-white/15 bg-white/[0.04] text-white/80 hover:border-white/30 hover:bg-white/10"
              : "cursor-not-allowed border-white/5 text-white/20",
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
          Smart Retry
        </button>
        <button
          onClick={onReveal}
          disabled={!selected}
          className={cn(
            "flex h-10 items-center gap-2 rounded-lg px-5 font-mono text-xs uppercase tracking-[0.15em] transition-all",
            selected
              ? "bg-gradient-to-r from-[var(--studio-accent)] to-[var(--studio-accent-2)] text-black hover:brightness-110"
              : "cursor-not-allowed bg-white/[0.04] text-white/20",
          )}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Cinematic Reveal
        </button>
      </div>
    </div>
  );
}
