import { useEffect, useState } from "react";
import { BookmarkPlus, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { createOutline, loadOutlineSource } from "@/lib/outline";
import { saveLibraryItem } from "@/lib/library";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  name: string | null;
}

export function OutlineDialog({ open, onOpenChange, imageUrl, name }: Props) {
  const [detail, setDetail] = useState(65);
  const [lineWidth, setLineWidth] = useState(1);
  const [original, setOriginal] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof createOutline> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open || !imageUrl) return;
    let cancelled = false;
    setBusy(true);
    setResult(null);
    setError(null);
    const timer = window.setTimeout(() => {
      void loadOutlineSource(imageUrl).then((image) => {
        if (cancelled) return;
        const next = createOutline(image, detail, lineWidth);
        if (!cancelled) setResult(next);
      }).catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not create the outline.");
      }).finally(() => {
        if (!cancelled) setBusy(false);
      });
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, imageUrl, detail, lineWidth, retry]);

  const save = async () => {
    if (!result || busy || saving) return;
    setSaving(true);
    try {
      await saveLibraryItem("mockup", result.url, `${name ?? "Mural"} — outline`);
      toast.success("Outline saved to library");
    } catch {
      toast.error("Could not save the outline. You can still download it.");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>Black & white outline</DialogTitle>
          <DialogDescription>{name ?? "Selected mockup"}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {busy ? <div role="status" className="flex items-center gap-2 p-12 text-muted-foreground"><Loader2 className="size-5 animate-spin" />Preparing outline…</div> : error ? (
            <div role="alert" className="space-y-3 p-6 text-center"><p>{error}</p><Button variant="outline" onClick={() => setRetry((n) => n + 1)}><RefreshCw />Try again</Button></div>
          ) : result && <img src={original ? imageUrl ?? result.url : result.url} alt={original ? "Original selected mockup" : "Complete scene in black and white outlines"} className="max-h-[52dvh] w-full object-contain" />}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-3"><label htmlFor="outline-detail" className="flex justify-between text-sm">Detail<output>{detail}%</output></label><Slider id="outline-detail" aria-label="Outline detail" min={0} max={100} step={5} value={[detail]} onValueChange={(v) => setDetail(v[0] ?? 65)} /></div>
          <div className="space-y-3"><label htmlFor="outline-width" className="flex justify-between text-sm">Line weight<output>{lineWidth}</output></label><Slider id="outline-width" aria-label="Outline line weight" min={1} max={3} step={1} value={[lineWidth]} onValueChange={(v) => setLineWidth(v[0] ?? 1)} /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setOriginal((v) => !v)} disabled={!result || busy}>{original ? "Show outline" : "Show original"}</Button>{result && !busy && <span className="text-xs text-muted-foreground">{result.width} × {result.height} · PNG</span>}</div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!result || busy || saving} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : <BookmarkPlus />}Save to library</Button><Button disabled={!result || busy} onClick={() => {
            if (!result) return;
            const link = document.createElement("a");
            link.href = result.url;
            link.download = `${(name ?? "mural").replace(/[^a-z0-9_-]+/gi, "-")}-outline.png`;
            link.click();
          }}><Download />Download outline</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}