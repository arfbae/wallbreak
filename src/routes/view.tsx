import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, ImageOff, Maximize2 } from "lucide-react";

type ViewSearch = {
  src?: string;
  name?: string;
  kind?: string;
};

export const Route = createFileRoute("/view")({
  validateSearch: (search: Record<string, unknown>): ViewSearch => ({
    src: typeof search.src === "string" ? search.src : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    kind: typeof search.kind === "string" ? search.kind : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shared Mockup Viewer — Mural Mockup Studio" },
      {
        name: "description",
        content:
          "View a shared mural mockup or artwork in a clean, cinematic full-bleed viewer. Read-only, no account required.",
      },
      { property: "og:title", content: "Shared Mockup Viewer — Mural Mockup Studio" },
      {
        property: "og:description",
        content: "A shared mural mockup or artwork, presented in a cinematic read-only viewer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedViewer,
});

function SharedViewer() {
  const { src, name, kind } = Route.useSearch();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const title = name?.trim() || (kind === "wall" ? "Shared wall photo" : "Shared mockup");

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Ambient wash */}
      <div className="pointer-events-none fixed inset-0 opacity-50">
        <div
          className="absolute -top-1/3 -left-1/4 h-[80vh] w-[80vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(217,70,239,0.16), transparent 60%)" }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/4 h-[80vh] w-[80vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.12), transparent 60%)" }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 px-6 py-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              Read-only Viewer · Shared Link
            </div>
            <h1 className="mt-2 font-display text-3xl font-medium tracking-tight md:text-4xl">
              {title}
            </h1>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Studio
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center">
          {!src || failed ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-10 py-16 text-center">
              <ImageOff className="h-7 w-7 text-white/40" />
              <div className="font-display text-xl">
                {!src ? "No image in this link" : "This link has expired"}
              </div>
              <p className="max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-white/40">
                Shared links are time-limited. Ask the owner to generate a fresh link.
              </p>
            </div>
          ) : (
            <motion.figure
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.03 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
            >
              <img
                src={src}
                alt={title}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className="max-h-[72vh] w-full object-contain"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              <figcaption className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
                  {kind === "wall" ? "Wall substrate" : kind === "artwork" ? "Artwork" : "Mockup"}
                </div>
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/80 backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Maximize2 className="h-3 w-3" />
                  Full size
                </a>
              </figcaption>
            </motion.figure>
          )}
        </section>

        <footer className="border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          Shared from Mural Mockup Studio · Read-only · Link expires automatically
        </footer>
      </div>
    </main>
  );
}
