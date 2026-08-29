import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateProposalPdf, downloadBlob } from "@/lib/proposal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  muralImageUrl: string | null;
  sceneName: string | null;
  wallImageUrl: string | null;
  artworkImageUrls: string[];
}

const FIELDS = [
  { key: "clientName", label: "Client name", placeholder: "Acme Property Group" },
  { key: "projectTitle", label: "Project title", placeholder: "East Wall Mural Commission" },
  { key: "location", label: "Location", placeholder: "42 Fortitude St, Brisbane" },
  { key: "wallDimensions", label: "Wall dimensions", placeholder: "12.0 m × 6.5 m" },
  { key: "timeline", label: "Timeline", placeholder: "3 weeks from deposit" },
  { key: "budget", label: "Investment", placeholder: "$18,500 AUD + GST" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function ProposalDialog({
  open,
  onOpenChange,
  muralImageUrl,
  sceneName,
  wallImageUrl,
  artworkImageUrls,
}: Props) {
  const [form, setForm] = useState<Record<FieldKey, string>>({
    clientName: "",
    projectTitle: "",
    location: "",
    wallDimensions: "",
    timeline: "",
    budget: "",
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: FieldKey, v: string) => setForm((p) => ({ ...p, [key]: v }));

  const handleGenerate = async () => {
    if (!muralImageUrl) {
      toast.error("Select a mockup first");
      return;
    }
    setBusy(true);
    try {
      const blob = await generateProposalPdf({
        ...form,
        notes,
        sceneName: sceneName ?? "Selected concept",
        muralImageUrl,
        wallImageUrl,
        artworkImageUrls,
      });
      const slug =
        (form.projectTitle || form.clientName || "mural-proposal")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "mural-proposal";
      downloadBlob(blob, `${slug}.pdf`);
      toast.success("Proposal PDF generated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build the proposal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/10 bg-[#0c0d10] text-white">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-medium tracking-tight">
            Client Proposal
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            {sceneName ? `${sceneName} · ` : ""}3-page branded PDF
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label
                htmlFor={f.key}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40"
              >
                {f.label}
              </Label>
              <Input
                id={f.key}
                value={form[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                className="border-white/10 bg-white/[0.03] text-sm text-white placeholder:text-white/25"
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="notes"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40"
          >
            Scope notes (optional — a default scope is used if blank)
          </Label>
          <Textarea
            id="notes"
            value={notes}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Surface prep, access equipment, anti-graffiti coating…"
            className="resize-none border-white/10 bg-white/[0.03] text-sm text-white placeholder:text-white/25"
          />
        </div>

        <DialogFooter>
          <button
            onClick={handleGenerate}
            disabled={busy || !muralImageUrl}
            className="flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--studio-accent)] to-[var(--studio-accent-2)] px-5 font-mono text-xs uppercase tracking-[0.15em] text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {busy ? "Building…" : "Download PDF"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
