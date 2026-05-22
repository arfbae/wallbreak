import { useCallback, useRef, useState } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  artworkUrl: string | null;
  onArtwork: (dataUrl: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function UploadZone({ artworkUrl, onArtwork, onGenerate, isGenerating }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onArtwork(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [onArtwork],
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
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
          "group relative flex h-40 w-full cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-5 transition-all md:w-[420px]",
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
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt="Source artwork"
            className="h-32 w-32 rounded-xl object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-white/[0.03] ring-1 ring-white/10">
            <ImageIcon className="h-7 w-7 text-white/30" />
          </div>
        )}
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            01 · Source
          </div>
          <div className="mt-1 font-display text-lg leading-tight text-white">
            {artworkUrl ? "Artwork loaded" : "Drop artwork"}
          </div>
          <div className="mt-1 text-xs text-white/50">
            {artworkUrl ? "Click to replace · PNG / JPG" : "or click to browse"}
          </div>
        </div>
        <Upload className="h-5 w-5 text-white/40 transition-transform group-hover:translate-y-[-2px]" />
      </div>

      <button
        onClick={onGenerate}
        disabled={!artworkUrl || isGenerating}
        className={cn(
          "relative flex h-40 flex-1 items-center justify-center overflow-hidden rounded-2xl border px-8 font-display text-2xl tracking-tight transition-all",
          !artworkUrl || isGenerating
            ? "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/30"
            : "cursor-pointer border-[var(--studio-accent)]/40 bg-gradient-to-br from-[var(--studio-accent)]/20 to-[var(--studio-accent-2)]/10 text-white hover:from-[var(--studio-accent)]/30 hover:to-[var(--studio-accent-2)]/20",
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
            02 · Render Pipeline
          </div>
          <div>{isGenerating ? "Rendering 3 mockups…" : "Generate Triptych"}</div>
          <div className="font-mono text-[10px] tracking-wider text-white/40">
            3 SCENES · ~30S
          </div>
        </div>
        {isGenerating && (
          <div className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden bg-white/5">
            <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-[var(--studio-accent)]" />
          </div>
        )}
      </button>
    </div>
  );
}
