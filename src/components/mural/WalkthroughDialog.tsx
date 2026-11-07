import { useEffect, useRef, useState } from "react";
import { Download, Film, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { recordWalkthrough } from "@/lib/walkthrough";
import { downloadBlob } from "@/lib/proposal";

export function WalkthroughDialog({ open, onOpenChange, imageUrl }: { open: boolean; onOpenChange: (v: boolean) => void; imageUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clip, setClip] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!clip) { setUrl(null); return; }
    const next = URL.createObjectURL(clip); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [clip]);
  useEffect(() => () => controller.current?.abort(), []);
  const create = async () => {
    if (!imageUrl || busy) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setProgress(0); setClip(null);
    try { setClip(await recordWalkthrough(imageUrl, setProgress, abort.signal)); }
    catch (err) { if (!abort.signal.aborted) toast.error(err instanceof Error ? err.message : "Could not make the video."); }
    finally { setBusy(false); controller.current = null; }
  };
  return <Dialog open={open} onOpenChange={v => { if (!v) controller.current?.abort(); onOpenChange(v); }}>
    <DialogContent className="max-w-2xl bg-background text-foreground">
      <DialogHeader><DialogTitle>Mockup walk-through</DialogTitle><DialogDescription>8 seconds · original mural · no AI credits</DialogDescription></DialogHeader>
      {url ? <video src={url} controls playsInline className="max-h-[50vh] w-full rounded-md bg-muted" /> : imageUrl ? <img src={imageUrl} alt="Selected mural" className="max-h-[50vh] w-full object-contain" /> : null}
      {busy && <div role="status" className="text-sm text-muted-foreground">Recording · {Math.round(progress * 100)}%</div>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !imageUrl} onClick={create}>{busy ? <Loader2 className="animate-spin" /> : <Film />}{clip ? "Record again" : "Make video"}</Button>
        {busy && <Button variant="outline" onClick={() => controller.current?.abort()}><Square />Stop</Button>}
        {clip && <Button variant="outline" onClick={() => downloadBlob(clip, `mural-walkthrough.${clip.type.startsWith("video/mp4") ? "mp4" : "webm"}`)}><Download />Download video</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}