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
import { ProposalDialog } from "@/components/mural/ProposalDialog";

import {
  ApiKeyField,
  loadStoredApiKeyState,
  type ApiKeyState,
} from "@/components/mural/ApiKeyField";
import { LibraryPanel } from "@/components/mural/LibraryPanel";
import { AuthPill } from "@/components/mural/AuthPill";
import { saveLibraryItem, migrateLocalToCloudIfNeeded } from "@/lib/library";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mural Mockup Studio — AI Wall Mural Visualiser" },
      {
        name: "description",
        content:
          "Upload your artwork and a wall photo to render photorealistic mural mockups in seconds, then export a branded client proposal PDF.",
      },
      { property: "og:title", content: "Mural Mockup Studio — AI Wall Mural Visualiser" },
      {
        property: "og:description",
        content:
          "Photorealistic mural mockups from your own artwork and wall photos, with cinematic reveals and PDF proposals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MuralStudio,
});

function MuralStudio() {
  const generate = useServerFn(generateMurals);
  const [artworks, setArtworks] = useState<(string | null)[]>([null, null, null]);
  const [wall, setWall] = useState<string | null>(null);
  const [murals, setMurals] = useState<Mural[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);

  const [retryNonce, setRetryNonce] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [mode, setMode] = useState<"separate" | "combined">("separate");
  const [count, setCount] = useState<1 | 2 | 3>(1);
  const [keepBackground, setKeepBackground] = useState(false);

  const [apiKeyState, setApiKeyState] = useState<ApiKeyState>({ keys: [], serverFallback: true });
  const { user } = useAuth();
  const [libraryNonce, setLibraryNonce] = useState(0);

  useEffect(() => {
    setApiKeyState(loadStoredApiKeyState());
  }, []);

  useEffect(() => {
    if (!user) return;
    void migrateLocalToCloudIfNeeded(user.id).then((n) => {
      if (n > 0) {
        toast.success(`Synced ${n} item${n > 1 ? "s" : ""} to your cloud library`);
        setLibraryNonce((v) => v + 1);
      } else {
        setLibraryNonce((v) => v + 1);
      }
    });
  }, [user]);

  const setArtworkAt = (index: number, value: string | null) => {
    setArtworks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setMurals(null);
    setSelected(null);
    if (value) void saveLibraryItem("artwork", value).catch(() => {});
  };

  const loadArtworkFromLibrary = (dataUrl: string) => {
    setArtworks((prev) => {
      const next = [...prev];
      const emptyIdx = next.findIndex((v) => !v);
      next[emptyIdx === -1 ? 0 : emptyIdx] = dataUrl;
      return next;
    });
    setMurals(null);
    setSelected(null);
  };

  const setWallAndSave = (dataUrl: string) => {
    setWall(dataUrl);
    setMurals(null);
    setSelected(null);
    void saveLibraryItem("wall", dataUrl).catch(() => {});
  };

  const filledArtworks = artworks.filter((a): a is string => Boolean(a));

  const mutation = useMutation({
    mutationFn: async (variant: "base" | "retry") => {
      if (filledArtworks.length === 0) throw new Error("no artwork");
      return generate({
        data: {
          artworkDataUrls: filledArtworks,
          wallDataUrl: wall,
          variant,
          apiKeys: apiKeyState.keys,
          serverFallback: apiKeyState.serverFallback,
          mode,
          count,
        },
      });
    },

    onSuccess: (data, variant) => {
      setMurals(data.murals);
      if (variant === "retry") setRetryNonce((n) => n + 1);
      const failed = data.murals.filter((m) => !m.imageUrl);
      if (failed.length === data.murals.length) {
        toast.error(failed[0]?.error ?? "All renders failed");
      } else if (failed.length > 0) {
        toast.warning(`${failed.length} of ${data.murals.length} mockups failed`);
      } else {
        toast.success(
          variant === "retry"
            ? "Recomposed"
            : `${data.murals.length} mockup${data.murals.length > 1 ? "s" : ""} rendered`,
        );
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

  const muralIds = useMemo(() => (murals ?? []).map((m) => m.id), [murals]);

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
          <div className="flex items-center gap-3">
            <AuthPill />
            <ApiKeyField value={apiKeyState} onChange={setApiKeyState} />
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
            artworkUrls={artworks}
            wallUrl={wall}
            onArtwork={setArtworkAt}
            onWall={setWallAndSave}
            onGenerate={() => mutation.mutate("base")}
            isGenerating={mutation.isPending}
            mode={mode}
            onModeChange={setMode}
            count={count}
            onCountChange={setCount}
          />
        </section>

        {/* Library */}
        <section>
          <LibraryPanel
            key={`lib-${user?.id ?? "anon"}-${libraryNonce}`}
            currentArtworks={artworks}
            currentWall={wall}
            onLoadArtwork={loadArtworkFromLibrary}
            onLoadWall={setWallAndSave}
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
            count={((mode === "combined" ? count : filledArtworks.length) || 1) as 1 | 2 | 3}
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
            onProposal={() => setProposalOpen(true)}
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

      <ProposalDialog
        open={proposalOpen}
        onOpenChange={setProposalOpen}
        muralImageUrl={selectedMural?.imageUrl ?? null}
        sceneName={selectedMural?.name ?? null}
        wallImageUrl={wall}
        artworkImageUrls={filledArtworks}
      />
    </main>
  );
}
