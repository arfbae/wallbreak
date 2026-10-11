import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Loader2, Search, Cloud, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listLibrary, type LibraryItem, type LibraryKind } from "@/lib/library";

type KindFilter = LibraryKind | "all";
type SortKey = "newest" | "oldest" | "name";

const KIND_LABEL: Record<KindFilter, string> = {
  all: "All",
  artwork: "Artworks",
  wall: "Walls",
  mockup: "Mockups",
};

function bytesFromDataUrl(d: string): number {
  const i = d.indexOf(",");
  return Math.round(((d.length - i - 1) * 3) / 4);
}
function fmtBytes(n: number): string {
  return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
}

export function LibraryPicker({
  kind,
  onPick,
}: {
  kind: LibraryKind;
  onPick: (dataUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>(kind);
  const [sort, setSort] = useState<SortKey>("newest");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dims, setDims] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) return setOpen(false);
    setOpen(true);
    setKindFilter(kind);
    setLoading(true);
    try {
      const all = await listLibrary();
      setItems(all.filter((i) => i.dataUrl));
    } catch {
      toast.error("Could not load your library.");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (kindFilter === "all" || i.kind === kindFilter) && (!q || i.name.toLowerCase().includes(q)),
    );
    list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "oldest"
          ? a.createdAt - b.createdAt
          : b.createdAt - a.createdAt,
    );
    return list;
  }, [items, query, kindFilter, sort]);

  const active = filtered.find((i) => i.id === activeId) ?? filtered[0] ?? null;

  const pick = (it: LibraryItem) => {
    onPick(it.dataUrl);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={toggle}
        className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
        aria-label={`Pick ${kind} from library`}
        title={`Pick ${kind} from library`}
      >
        <FolderOpen className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[min(92vw,560px)] rounded-xl border border-white/10 bg-[var(--studio-panel)] p-3 shadow-2xl shadow-black/60">
          <div className="mb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                className="w-full rounded-md border border-white/10 bg-black/30 py-1.5 pl-7 pr-2 text-xs text-white placeholder:text-white/30 focus:border-[var(--studio-accent)] focus:outline-none"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/80 focus:outline-none"
              aria-label="Sort"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {(["all", "artwork", "wall", "mockup"] as KindFilter[]).map((k) => {
              const n = k === "all" ? items.length : items.filter((i) => i.kind === k).length;
              return (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                    kindFilter === k
                      ? "bg-[var(--studio-accent)] text-black"
                      : "bg-white/5 text-white/55 hover:bg-white/10",
                  )}
                >
                  {KIND_LABEL[k]} · {n}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-white/50" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-1 py-8 text-center text-xs text-white/40">
              {items.length === 0
                ? "Nothing saved yet. Use the save button on an upload box to add items."
                : "No items match your search."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
              <div className="grid max-h-72 grid-cols-3 content-start gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">
                {filtered.map((it) => (
                  <button
                    key={it.id}
                    onMouseEnter={() => setActiveId(it.id)}
                    onFocus={() => setActiveId(it.id)}
                    onClick={() => pick(it)}
                    title={it.name}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg ring-1 transition-all",
                      active?.id === it.id
                        ? "ring-2 ring-[var(--studio-accent)]"
                        : "ring-white/10 hover:ring-white/30",
                    )}
                  >
                    <img
                      src={it.dataUrl}
                      alt={it.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
              {active && (
                <div className="flex flex-col gap-2">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
                    <img
                      src={active.dataUrl}
                      alt={active.name}
                      className="max-h-full max-w-full object-contain"
                      onLoad={(e) => {
                        const im = e.currentTarget;
                        setDims((d) => ({
                          ...d,
                          [active.id]: `${im.naturalWidth} × ${im.naturalHeight}`,
                        }));
                      }}
                    />
                  </div>
                  <div className="truncate text-xs text-white" title={active.name}>
                    {active.name}
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 font-mono text-[10px] text-white/50">
                    <dt>Type</dt>
                    <dd className="capitalize text-white/75">{active.kind}</dd>
                    <dt>Size</dt>
                    <dd className="text-white/75">{dims[active.id] ?? "…"} px</dd>
                    <dt>File</dt>
                    <dd className="text-white/75">{fmtBytes(bytesFromDataUrl(active.dataUrl))}</dd>
                    <dt>Saved</dt>
                    <dd className="text-white/75">
                      {new Date(active.createdAt).toLocaleDateString()}
                    </dd>
                    <dt>Where</dt>
                    <dd className="flex items-center gap-1 text-white/75">
                      {active.remote ? (
                        <Cloud className="h-3 w-3" />
                      ) : (
                        <HardDrive className="h-3 w-3" />
                      )}
                      {active.remote ? "Cloud" : "This device"}
                    </dd>
                  </dl>
                  <button
                    onClick={() => pick(active)}
                    className="mt-1 rounded-md bg-[var(--studio-accent)] py-1.5 text-xs font-medium text-black hover:opacity-90"
                  >
                    Use this {kind}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
