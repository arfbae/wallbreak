import { useState } from "react";
import { FileText, Loader2, Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { writeProposalCopy, buildPaintPlan, type PaintPlan } from "@/lib/ai-features.functions";

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
import {
  DEFAULT_QUOTE,
  computeQuote,
  formatMoney,
  quoteSummary,
  type QuoteInput,
} from "@/lib/quote";

const QUOTE_FIELDS: Array<{ key: keyof QuoteInput; label: string; step?: string }> = [
  { key: "widthM", label: "Wall width (m)", step: "0.1" },
  { key: "heightM", label: "Wall height (m)", step: "0.1" },
  { key: "ratePerSqm", label: "Rate per m²" },
  { key: "prepHours", label: "Prep hours" },
  { key: "prepRate", label: "Prep rate / h" },
  { key: "designFee", label: "Design fee" },
  { key: "equipment", label: "Access equipment" },
  { key: "travelKm", label: "Travel (km)" },
  { key: "travelRate", label: "Travel rate / km", step: "0.05" },
  { key: "contingencyPct", label: "Contingency %" },
  { key: "taxPct", label: "Tax %" },
];

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
  const [writing, setWriting] = useState(false);
  const [painting, setPainting] = useState(false);
  const [plan, setPlan] = useState<PaintPlan | null>(null);
  const writeCopy = useServerFn(writeProposalCopy);
  const paintPlan = useServerFn(buildPaintPlan);

  const set = (key: FieldKey, v: string) => setForm((p) => ({ ...p, [key]: v }));

  const areaFromDims = () => {
    const nums = form.wallDimensions.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
    return nums.length >= 2 && nums[0] * nums[1] > 0 ? nums[0] * nums[1] : 50;
  };

  const handleWrite = async () => {
    setWriting(true);
    try {
      const { text } = await writeCopy({
        data: {
          muralImageUrl,
          sceneName: sceneName ?? "",
          clientName: form.clientName,
          projectTitle: form.projectTitle,
          location: form.location,
          wallDimensions: form.wallDimensions,
          timeline: form.timeline,
          brief: notes.slice(0, 2000),
        },
      });
      setNotes(text);
      toast.success("Scope written");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not write copy");
    } finally {
      setWriting(false);
    }
  };

  const handlePaint = async () => {
    const urls = [...artworkImageUrls.slice(0, 3), ...(muralImageUrl ? [muralImageUrl] : [])];
    if (!urls.length) return toast.error("Add artwork first");
    setPainting(true);
    try {
      setPlan(await paintPlan({ data: { imageUrls: urls.slice(0, 4), areaSqm: areaFromDims() } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not build the paint list");
    } finally {
      setPainting(false);
    }
  };

  const paintText = plan
    ? `\n\nPaint list (${plan.areaSqm.toFixed(0)} m², 2 coats, ~${plan.totalLitres} L total):\n` +
      plan.colours.map((c) => `- ${c.name} ${c.hex} — ${c.coveragePct}% · ${c.litres} L`).join("\n") +
      (plan.notes ? `\n${plan.notes}` : "")
    : "";

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
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleWrite}
              disabled={writing}
              className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 font-mono text-[10px] uppercase tracking-[0.15em] text-white/70 hover:bg-white/5 disabled:opacity-40"
            >
              {writing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {writing ? "Writing…" : "Write with AI"}
            </button>
            <button
              type="button"
              onClick={handlePaint}
              disabled={painting}
              className="flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 font-mono text-[10px] uppercase tracking-[0.15em] text-white/70 hover:bg-white/5 disabled:opacity-40"
            >
              {painting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Palette className="h-3 w-3" />}
              {painting ? "Analysing…" : "Palette & paint list"}
            </button>
          </div>
        </div>

        {plan && (
          <div className="space-y-2 rounded-lg border border-white/10 p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              Paint list · {plan.areaSqm.toFixed(0)} m² · ~{plan.totalLitres} L · added to PDF
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {plan.colours.map((c) => (
                <div key={c.hex + c.name} className="flex items-center gap-2 text-xs text-white/75">
                  <span className="h-4 w-4 shrink-0 rounded-sm border border-white/15" style={{ background: c.hex }} />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-white/40">{c.coveragePct}% · {c.litres} L</span>
                </div>
              ))}
            </div>
            {plan.notes && <p className="text-xs text-white/45">{plan.notes}</p>}
          </div>
        )}

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
