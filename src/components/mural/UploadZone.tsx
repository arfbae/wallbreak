import { useCallback, useRef, useState } from "react";
import { Upload, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  artworkUrls: (string | null)[]; // length 3
  wallUrl: string | null;
  onArtwork: (index: number, dataUrl: string | null) => void;
  onWall: (dataUrl: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  mode: "separate" | "combined";
  onModeChange: (mode: "separate" | "combined") => void;
  count: 1 | 2 | 3;
  onCountChange: (count: 1 | 2 | 3) => void;
  keepBackground: boolean;
  onKeepBackgroundChange: (keep: boolean) => void;
}

interface DropBoxProps {
  imageUrl: string | null;
  onFile: (dataUrl: string) => void;
  onClear?: () => void;
  stepLabel: string;
  title: string;
  placeholderTitle: string;
  hint: string;
  compact?: boolean;
}

function DropBox({
  imageUrl,
  onFile,
  onClear,
  stepLabel,
  title,
  placeholderTitle,
  hint,
  compact,
}: DropBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onFile(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group relative flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 transition-all",
        compact ? "h-28" : "h-40 gap-4 px-5",
        drag
          ? "border-[var(--studio-accent)] bg-white/5"
          : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className={cn(
            "rounded-xl object-cover ring-1 ring-white/10",
            compact ? "h-20 w-20" : "h-32 w-32",
          )}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center rounded-xl bg-white/[0.03] ring-1 ring-white/10",
            compact ? "h-20 w-20" : "h-32 w-32",
          )}
        >
          <ImageIcon className={cn("text-white/30", compact ? "h-5 w-5" : "h-7 w-7")} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          {stepLabel}
        </div>
        <div
          className={cn(
            "mt-1 truncate font-display leading-tight text-white",
            compact ? "text-sm" : "text-lg",
          )}
        >
          {imageUrl ? title : placeholderTitle}
        </div>
        <div className="mt-1 truncate text-xs text-white/50">
          {imageUrl ? "Click to replace" : hint}
        </div>
      </div>
      {imageUrl && onClear ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Remove"
        >
          <X className="h-4 w-4" />
        </button>
      ) : (
        <Upload className="h-5 w-5 text-white/40 transition-transform group-hover:translate-y-[-2px]" />
      )}
    </div>
  );
}

export function UploadZone({
  artworkUrls,
  wallUrl,
  onArtwork,
  onWall,
  onGenerate,
  isGenerating,
  mode,
  onModeChange,
  count,
  onCountChange,
  keepBackground,
  onKeepBackgroundChange,
}: Props) {
  const filledCount = artworkUrls.filter(Boolean).length;
  const outputs = mode === "combined" ? count : filledCount;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <div className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {artworkUrls.map((url, i) => (
            <DropBox
              key={i}
              compact
              imageUrl={url}
              onFile={(d) => onArtwork(i, d)}
              onClear={() => onArtwork(i, null)}
              stepLabel={`0${i + 1} · Artwork ${i + 1}`}
              title={`Artwork ${i + 1}`}
              placeholderTitle={i === 0 ? "Drop artwork" : "+ Add artwork"}
              hint={i === 0 ? "required · PNG / JPG" : "optional"}
            />
          ))}
        </div>
        <DropBox
          imageUrl={wallUrl}
          onFile={onWall}
          stepLabel="04 · Wall (optional)"
          title="Wall loaded"
          placeholderTitle="Drop wall image"
          hint="background for all mockups"
          compact
        />
      </div>

      <div className="flex flex-col gap-3 lg:w-[320px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            05 · Composition Mode
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { id: "separate", label: "Separate", sub: "1 mural per artwork" },
                { id: "combined", label: "Combined", sub: "all artworks, 1 mural" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition-all",
                  mode === m.id
                    ? "border-[var(--studio-accent)]/50 bg-[var(--studio-accent)]/15 text-white"
                    : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25 hover:text-white",
                )}
              >
                <div className="font-display text-sm leading-tight">{m.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-white/45">{m.sub}</div>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              Mockups
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => onCountChange(n as 1 | 2 | 3)}
                  disabled={mode !== "combined"}
                  className={cn(
                    "h-8 w-8 rounded-lg border font-mono text-xs transition-all",
                    mode !== "combined"
                      ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/20"
                      : count === n
                        ? "border-[var(--studio-accent)]/50 bg-[var(--studio-accent)]/20 text-white"
                        : "border-white/10 bg-white/[0.02] text-white/50 hover:border-white/25 hover:text-white",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {mode !== "combined" && (
            <div className="mt-2 text-[10px] leading-tight text-white/35">
              Separate mode renders one mockup per uploaded artwork.
            </div>
          )}

          <button
            onClick={() => onKeepBackgroundChange(!keepBackground)}
            className={cn(
              "mt-3 flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-all",
              keepBackground
                ? "border-[var(--studio-accent)]/50 bg-[var(--studio-accent)]/15"
                : "border-white/10 bg-white/[0.02] hover:border-white/25",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-all",
                keepBackground ? "bg-[var(--studio-accent)]" : "bg-white/15",
              )}
            >
              <span
                className={cn(
                  "h-3 w-3 rounded-full bg-black transition-transform",
                  keepBackground ? "translate-x-3" : "translate-x-0",
                )}
              />
            </span>
            <span>
              <span className="block font-display text-sm leading-tight text-white">
                Keep artwork background
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-white/45">
                {keepBackground
                  ? "The whole composition is painted — washes and colour fields included."
                  : "Only the main subject is painted; surroundings are removed."}
              </span>
            </span>
          </button>
        </div>

        <button
          onClick={onGenerate}
          disabled={filledCount === 0 || isGenerating}
          className={cn(
            "relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border px-8 font-display text-2xl tracking-tight transition-all",
            filledCount === 0 || isGenerating
              ? "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/30"
              : "cursor-pointer border-[var(--studio-accent)]/40 bg-gradient-to-br from-[var(--studio-accent)]/20 to-[var(--studio-accent-2)]/10 text-white hover:from-[var(--studio-accent)]/30 hover:to-[var(--studio-accent-2)]/20",
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
              06 · Render Pipeline
            </div>
            <div>
              {isGenerating
                ? `Rendering ${outputs} mockup${outputs > 1 ? "s" : ""}…`
                : filledCount === 0
                  ? "Add artwork"
                  : outputs === 1
                    ? "Generate Mockup"
                    : `Generate ${outputs} Mockups`}
            </div>
            <div className="font-mono text-[10px] tracking-wider text-white/40">
              {filledCount} ARTWORK{filledCount === 1 ? "" : "S"} ·{" "}
              {mode === "combined" ? "COMBINED" : "SEPARATE"} · ~{Math.max(1, outputs) * 10}S
            </div>
          </div>
          {isGenerating && (
            <div className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden bg-white/5">
              <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-[var(--studio-accent)]" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
