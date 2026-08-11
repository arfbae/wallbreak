import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, ImageOff, Maximize2 } from "lucide-react";

type ViewSearch = {
  src?: string;
  name?: string;
  kind?: string;
};

// Supabase serves signed originals from /storage/v1/object/sign/… and
// on-the-fly resized variants from /storage/v1/render/image/sign/….
// When the URL matches, we can precompute width variants for a srcset so
// phones download a ~640px image instead of a multi-megabyte original.
const RENDER_WIDTHS = [640, 1024, 1600, 2048];

function buildVariants(src: string): { srcSet?: string; base: string } {
  if (!src.includes("/storage/v1/object/sign/")) return { base: src };
  try {
    const url = new URL(src);
    url.pathname = url.pathname.replace(
      "/storage/v1/object/sign/",
      "/storage/v1/render/image/sign/",
    );
    const at = (w: number) => {
      const v = new URL(url.toString());
      v.searchParams.set("width", String(w));
      v.searchParams.set("quality", "80");
      v.searchParams.set("resize", "contain");
      return `${v.toString()} ${w}w`;
    };
    return { srcSet: RENDER_WIDTHS.map(at).join(", "), base: src };
  } catch {
    return { base: src };
  }
}

export const Route = createFileRoute("/view")({
  validateSearch: (search: Record<string, unknown>): ViewSearch => ({
    src: typeof search.src === "string" ? search.src : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    kind: typeof search.kind === "string" ? search.kind : undefined,
  }),
  head: ({ match }) => ({
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
    links: match.search?.src
      ? [{ rel: "preload", as: "image" as const, href: match.search.src }]
      : [],
  }),
  component: SharedViewer,
});

function SharedViewer() {
  const { src, name, kind } = Route.useSearch();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const variants = src ? buildVariants(src) : null;

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.naturalWidth && el.naturalHeight) setRatio(el.naturalWidth / el.naturalHeight);
    setLoaded(true);
  }, []);

  // A resized variant can 404 when image transformation isn't available —
  // drop the srcset and fall back to the original signed URL once.
  const onError = useCallback(() => {
    const el = imgRef.current;
    if (el && el.srcset) {
      el.srcset = "";
      return;
    }
    setFailed(true);
  }, []);

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

      <div className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/10 pb-5">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
              Read-only Viewer · Shared Link
            </div>
            <h1 className="mt-2 truncate font-display text-2xl font-medium tracking-tight sm:text-3xl md:text-4xl">
              {title}
            </h1>
          </div>
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Studio
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center">
          {!src || failed ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center sm:px-10 sm:py-16">
              <ImageOff className="h-7 w-7 text-white/40" />
              <div className="font-display text-xl">
                {!src ? "No image in this link" : "This link has expired"}
              </div>
              <p className="max-w-sm font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-white/40">
                Shared links are time-limited. Ask the owner to generate a fresh link.
              </p>
            </div>
          ) : (
            <figure className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0d] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
              {/* Reserved box: holds layout before the image decodes, then
                  snaps to the image's true aspect ratio — no layout shift. */}
              <div
                className="relative w-full"
                style={{
                  aspectRatio: ratio ? `${ratio}` : "16 / 10",
                  maxHeight: "78vh",
                }}
              >
                {!loaded && (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent">
                    <div className="absolute inset-0 grid place-items-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                      Decoding image…
                    </div>
                  </div>
                )}
                <motion.img
                  ref={imgRef}
                  src={variants?.base}
                  srcSet={variants?.srcSet}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 1400px"
                  alt={title}
                  loading="eager"
                  decoding="async"
                  onLoad={onLoad}
                  onError={onError}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.02 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              <figcaption className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3 sm:bottom-4 sm:left-6 sm:right-6">
                <div className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
                  {kind === "wall" ? "Wall substrate" : kind === "artwork" ? "Artwork" : "Mockup"}
                </div>
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/80 backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  <Maximize2 className="h-3 w-3" />
                  Full size
                </a>
              </figcaption>
            </figure>
          )}
        </section>


        <footer className="border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          Shared from Mural Mockup Studio · Read-only · Link expires automatically
        </footer>
      </div>
    </main>
  );
}
