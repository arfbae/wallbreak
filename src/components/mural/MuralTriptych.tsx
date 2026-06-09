import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DebugOverlay } from "./DebugOverlay";

export type Mural = {
  id: string;
  name: string;
  imageUrl: string | null;
  error?: string;
};

interface Props {
  murals: Mural[] | null;
  isGenerating: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  retryNonce: number;
  showDebug?: boolean;
}

const PLACEHOLDER_SCENES = [
  { id: "container", name: "Industrial Container" },
  { id: "corner", name: "Dual-Plane Brick Corner" },
  { id: "concrete", name: "Obstructed Concrete Facade" },
];

export function MuralTriptych({ murals, isGenerating, selected, onSelect, retryNonce, showDebug }: Props) {
  const slots = murals ?? PLACEHOLDER_SCENES.map((s) => ({ ...s, imageUrl: null }));

  return (
    <div className="relative grid grid-cols-1 gap-[2px] overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 md:grid-cols-3">
      {slots.map((m, i) => {
        const isSelected = selected === m.id;
        return (
          <motion.button
            key={`${m.id}-${retryNonce}`}
            onClick={() => m.imageUrl && onSelect(m.id)}
            disabled={!m.imageUrl}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: i * 0.08 }}
            className={cn(
              "group relative aspect-[3/4] w-full overflow-hidden bg-[#0a0a0f] text-left transition-all md:aspect-[3/4]",
              m.imageUrl ? "cursor-pointer" : "cursor-default",
              isSelected && "ring-2 ring-inset ring-[var(--studio-accent)]",
            )}
          >
            {m.imageUrl ? (
              <motion.img
                key={m.imageUrl}
                src={m.imageUrl}
                alt={m.name}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{
                  opacity: 1,
                  scale: isSelected ? 1.03 : 1,
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/40">
                {isGenerating ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em]">
                      Rendering scene {i + 1}
                    </div>
                  </>
                ) : (m as Mural).error ? (
                  <>
                    <AlertCircle className="h-6 w-6 text-red-400/70" />
                    <div className="px-4 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-red-300/70">
                      {(m as Mural).error}
                    </div>
                  </>
                ) : (
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em]">
                    Awaiting render
                  </div>
                )}
              </div>
            )}

            {/* HUD overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
              <div className="flex items-start justify-between">
                <div className="rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
                  Mockup {String(i + 1).padStart(2, "0")}
                </div>
                {isSelected && (
                  <div className="rounded-md bg-[var(--studio-accent)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-black">
                    Selected
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="font-display text-lg leading-tight text-white drop-shadow-lg">
                  {m.name}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">
                  ANGLE {[35, -25, 10][i]}° · OPACITY 95%
                </div>
              </div>
            </div>

            {/* Hover scrim */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 opacity-100" />
          </motion.button>
        );
      })}
    </div>
  );
}
