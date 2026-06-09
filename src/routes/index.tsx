import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

import { generateMurals } from "@/lib/mural.functions";
import { UploadZone } from "@/components/mural/UploadZone";
import { MuralTriptych, type Mural } from "@/components/mural/MuralTriptych";
import { ControlDock } from "@/components/mural/ControlDock";
import { CinematicReveal } from "@/components/mural/CinematicReveal";
import { ApiKeyField, loadStoredApiKey } from "@/components/mural/ApiKeyField";

export const Route = createFileRoute("/")({
  component: MuralStudio,
});

function MuralStudio() {
  const generate = useServerFn(generateMurals);
  const [artwork, setArtwork] = useState<string | null>(null);
  const [wall, setWall] = useState<string | null>(null);
  const [murals, setMurals] = useState<Mural[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    setApiKey(loadStoredApiKey());
  }, []);

  const mutation = useMutation({
    mutationFn: async (variant: "base" | "retry") => {
      if (!artwork) throw new Error("no artwork");
      return generate({
        data: { artworkDataUrl: artwork, wallDataUrl: wall, variant, apiKey: apiKey || null },
      });
    },
    onSuccess: (data, variant) => {
      setMurals(data.murals);
      if (variant === "retry") setRetryNonce((n) => n + 1);
      const failed = data.murals.filter((m) => !m.imageUrl);
      if (failed.length === data.murals.length) {
        toast.error(failed[0]?.error ?? "All renders failed");
      } else if (failed.length > 0) {
        toast.warning(`${failed.length} of ${data.murals.length} scenes failed`);
      } else {
        toast.success(variant === "retry" ? "Recomposed" : "Triptych rendered");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Render failed");
    },
  });

  const selectedMural = useMemo(
    () => murals?.find((m) => m.id === selected) ?? null,
    [murals, selected],
  );

  const muralIds = useMemo(
    () => (murals ?? []).map((m) => m.id),
    [murals],
  );

  return (
    <main className="min-h-screen bg-[var(--studio-bg)] text-white">
      <Toaster theme="dark" position="top-center" />

      {/* Ambient wash */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div
          className="absolute -top-1/3 -left-1/4 h-[80vh] w-[80vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(217,70,239,0.18), transparent 60%)" }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/4 h-[80vh] w-[80vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.14), transparent 60%)" }}
        />
      </div>

      <div className="relative mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-10">
        {/* Header */}
        <header className="flex items-end justify-between border-b border-white/10 pb-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              Spatial Planning Engine · v1.0
            </div>
            <h1 className="mt-2 font-display text-4xl font-medium tracking-tight md:text-5xl">
              Mural Mockup <span className="text-[var(--studio-accent)]">Studio</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ApiKeyField value={apiKey} onChange={setApiKey} />
            <div className="hidden text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-white/40 lg:block">
              <div>KEY 1200W · FILL 500W · RIM 700W</div>
              <div>ELEVATION 15° · OPACITY 95%</div>
              <div>SUBSTRATE MAPPING · ENABLED</div>
            </div>
          </div>
        </header>

        {/* Upload + Generate */}
        <section>
          <UploadZone
            artworkUrl={artwork}
            wallUrl={wall}
            onArtwork={(d) => {
              setArtwork(d);
              setMurals(null);
              setSelected(null);
            }}
            onWall={(d) => {
              setWall(d);
              setMurals(null);
              setSelected(null);
            }}
            onGenerate={() => mutation.mutate("base")}
            isGenerating={mutation.isPending}
          />
        </section>

        {/* Triptych */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              03 · Panoramic Triptych
            </div>
            {mutation.isPending && mutation.variables === "retry" && (
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--studio-accent)]">
                Re-analyzing alignment data…
              </div>
            )}
          </div>
          <MuralTriptych
            murals={murals}
            isGenerating={mutation.isPending}
            selected={selected}
            onSelect={setSelected}
            retryNonce={retryNonce}
            showDebug={showDebug}
          />
        </section>

        {/* Controls */}
        <section>
          <ControlDock
            hasMurals={!!murals?.some((m) => m.imageUrl)}
            selected={selected}
            onSelect={setSelected}
            onRetry={() => mutation.mutate("retry")}
            onReveal={() => setRevealOpen(true)}
            isGenerating={mutation.isPending}
            muralIds={muralIds}
            showDebug={showDebug}
            onToggleDebug={() => setShowDebug((v) => !v)}
          />
        </section>

        <footer className="border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          Upload any artwork · 3 scenes rendered in parallel · Wall substrate bleeds through paint
        </footer>
      </div>

      <CinematicReveal
        open={revealOpen}
        imageUrl={selectedMural?.imageUrl ?? null}
        name={selectedMural?.name ?? null}
        onClose={() => setRevealOpen(false)}
      />
    </main>
  );
}
