import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { planComposition, type CompositionPlan } from "@/lib/ai-features.functions";

interface Props {
  artworks: string[];
  wall: string | null;
  keepBackground: boolean;
  plan: CompositionPlan | null;
  onPlan: (plan: CompositionPlan | null) => void;
  usePlan: boolean;
  onUsePlanChange: (v: boolean) => void;
}

export function CompositionPlanner({
  artworks,
  wall,
  keepBackground,
  plan,
  onPlan,
  usePlan,
  onUsePlanChange,
}: Props) {
  const run = useServerFn(planComposition);
  const [busy, setBusy] = useState(false);

  const handlePlan = async () => {
    setBusy(true);
    try {
      const result = await run({ data: { artworkUrls: artworks, wallUrl: wall, keepBackground } });
      onPlan(result);
      onUsePlanChange(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not plan the composition.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-[var(--studio-panel)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-sm text-white">AI composition planner</div>
          <div className="text-[11px] text-white/45">
            Decides the hero piece, order, sizes and how to blend your artworks into one mural.
          </div>
        </div>
        <button
          onClick={handlePlan}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-xs text-white hover:border-white/35 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {plan ? "Re-plan" : "Plan composition"}
        </button>
      </div>

      {plan && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {plan.order.map((idx, i) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <img
                  src={artworks[idx]}
                  alt={`Artwork ${idx + 1}`}
                  style={{ height: `${Math.round(28 + 0.44 * plan.scales[i]!)}px` }}
                  className={cn(
                    "rounded-md border object-contain",
                    idx === plan.heroIndex ? "border-[var(--studio-accent)]" : "border-white/10",
                  )}
                />
                <span className="font-mono text-[10px] text-white/50">
                  {idx === plan.heroIndex ? "HERO" : `${plan.scales[i]}%`}
                </span>
              </div>
            ))}
            {plan.palette.length > 0 && (
              <div className="ml-auto flex gap-1">
                {plan.palette.map((h) => (
                  <span
                    key={h}
                    title={h}
                    className="h-5 w-5 rounded-full border border-white/10"
                    style={{ backgroundColor: h }}
                  />
                ))}
              </div>
            )}
          </div>
          <p className="text-xs leading-relaxed text-white/70">{plan.arrangement}</p>
          <p className="text-xs leading-relaxed text-white/70">{plan.bridges}</p>
          <p className="text-[11px] italic leading-relaxed text-white/45">{plan.rationale}</p>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={usePlan}
              onChange={(e) => onUsePlanChange(e.target.checked)}
            />
            Use this plan for the next combined render
          </label>
        </div>
      )}
    </div>
  );
}
