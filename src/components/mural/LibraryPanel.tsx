import { useEffect, useState, useCallback } from "react";
import { Cloud, Trash2, Plus, Share2, Check } from "lucide-react";
import {
  listLibrary,
  saveLibraryItem,
  deleteLibraryItem,
  createShareLink,
  type LibraryItem,
  type LibraryKind,
} from "@/lib/library";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const EXPIRY_OPTIONS: { label: string; seconds: number }[] = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "24 hours", seconds: 60 * 60 * 24 },
  { label: "7 days", seconds: 60 * 60 * 24 * 7 },
  { label: "30 days", seconds: 60 * 60 * 24 * 30 },
];

interface Props {
  currentArtworks: (string | null)[];
  currentWall: string | null;
  onLoadArtwork: (dataUrl: string) => void;
  onLoadWall: (dataUrl: string) => void;
}

export function LibraryPanel({ currentArtworks, currentWall, onLoadArtwork, onLoadWall }: Props) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const isCloud = !!user;

  const refresh = useCallback(async () => {
    setItems(await listLibrary());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveCurrent = async (kind: LibraryKind) => {
    setBusy(true);
    try {
      if (kind === "wall" && currentWall) {
        await saveLibraryItem("wall", currentWall);
      } else if (kind === "artwork") {
        for (const a of currentArtworks) {
          if (a) await saveLibraryItem("artwork", a);
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await deleteLibraryItem(id);
    await refresh();
  };

  const [expirySeconds, setExpirySeconds] = useState(EXPIRY_OPTIONS[2].seconds);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const share = async (item: LibraryItem) => {
    setShareError(null);
    try {
      const url = await createShareLink(item, expirySeconds);
      await navigator.clipboard.writeText(url);
      setSharedId(item.id);
      setTimeout(() => setSharedId((v) => (v === item.id ? null : v)), 2000);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Could not create share link");
      setTimeout(() => setShareError(null), 4000);
    }
  };

  const hasArtwork = currentArtworks.some(Boolean);
  const artworks = items.filter((i) => i.kind === "artwork");
  const walls = items.filter((i) => i.kind === "wall");

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-[var(--studio-accent)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
            Library · {items.length} saved · {isCloud ? "cloud" : "local"}
          </span>
        </div>
        <span className="font-mono text-[10px] text-white/40">{open ? "hide" : "show"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!hasArtwork || busy}
              onClick={() => saveCurrent("artwork")}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all",
                hasArtwork && !busy
                  ? "border-white/20 text-white hover:bg-white/5"
                  : "cursor-not-allowed border-white/5 text-white/20",
              )}
            >
              <Plus className="h-3 w-3" /> Save current artwork(s)
            </button>
            <button
              disabled={!currentWall || busy}
              onClick={() => saveCurrent("wall")}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all",
                currentWall && !busy
                  ? "border-white/20 text-white hover:bg-white/5"
                  : "cursor-not-allowed border-white/5 text-white/20",
              )}
            >
              <Plus className="h-3 w-3" /> Save current wall
            </button>
          </div>

          {isCloud && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
                Share link expires in
              </span>
              {EXPIRY_OPTIONS.map((o) => (
                <button
                  key={o.seconds}
                  onClick={() => setExpirySeconds(o.seconds)}
                  className={cn(
                    "rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all",
                    expirySeconds === o.seconds
                      ? "bg-[var(--studio-accent)] text-black"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  {o.label}
                </button>
              ))}
              {shareError && (
                <span className="ml-auto font-mono text-[10px] text-red-400">{shareError}</span>
              )}
            </div>
          )}

          <Row
            label="Artworks"
            items={artworks}
            onLoad={onLoadArtwork}
            onRemove={remove}
            onShare={isCloud ? share : undefined}
            sharedId={sharedId}
          />
          <Row
            label="Walls"
            items={walls}
            onLoad={onLoadWall}
            onRemove={remove}
            onShare={isCloud ? share : undefined}
            sharedId={sharedId}
          />

          <p className="font-mono text-[9px] uppercase tracking-wider text-white/30">
            {isCloud
              ? "Synced to your cloud library. Share links are signed, time-limited, and viewable by anyone with the URL until they expire."
              : "Stored privately in this browser (IndexedDB). Sign in to sync and generate shareable links."}
          </p>
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  items,
  onLoad,
  onRemove,
  onShare,
  sharedId,
}: {
  label: string;
  items: LibraryItem[];
  onLoad: (dataUrl: string) => void;
  onRemove: (id: string) => void;
  onShare?: (item: LibraryItem) => void;
  sharedId?: string | null;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
        {label} · {items.length}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/30">
          Nothing saved yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <div key={it.id} className="group relative">
              <button
                onClick={() => onLoad(it.dataUrl)}
                className="block h-20 w-20 overflow-hidden rounded-lg ring-1 ring-white/10 transition-all hover:ring-[var(--studio-accent)]"
              >
                <img src={it.dataUrl} alt={it.name} className="h-full w-full object-cover" />
              </button>
              {onShare && it.storagePath && (
                <button
                  onClick={() => onShare(it)}
                  className="absolute left-1 top-1 hidden rounded bg-black/70 p-1 text-white/70 hover:text-[var(--studio-accent)] group-hover:block"
                  aria-label="Copy share link"
                  title="Copy shareable link"
                >
                  {sharedId === it.id ? (
                    <Check className="h-3 w-3 text-[var(--studio-accent)]" />
                  ) : (
                    <Share2 className="h-3 w-3" />
                  )}
                </button>
              )}
              <button
                onClick={() => onRemove(it.id)}
                className="absolute right-1 top-1 hidden rounded bg-black/70 p-1 text-white/70 hover:text-white group-hover:block"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
