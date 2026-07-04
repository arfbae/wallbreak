import { useCallback, useRef, useState } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  artworkUrl: string | null;
  wallUrl: string | null;
  onArtwork: (dataUrl: string) => void;
  onWall: (dataUrl: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  count: 1 | 2 | 3;
  onCountChange: (count: 1 | 2 | 3) => void;
}

interface DropBoxProps {
  imageUrl: string | null;
  onFile: (dataUrl: string) => void;
  stepLabel: string;
  title: string;
  placeholderTitle: string;
  hint: string;
}

function DropBox({ imageUrl, onFile, stepLabel, title, placeholderTitle, hint }: DropBoxProps) {
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
        "group relative flex h-40 flex-1 cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-5 transition-all",
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
          className="h-32 w-32 rounded-xl object-cover ring-1 ring-white/10"
        />
      ) : (
        <div className="flex h-32 w-32 items-center justify-center rounded-xl bg-white/[0.03] ring-1 ring-white/10">
          <ImageIcon className="h-7 w-7 text-white/30" />
        </div>
      )}
      <div className="flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          {stepLabel}
        </div>
        <div className="mt-1 font-display text-lg leading-tight text-white">
          {imageUrl ? title : placeholderTitle}
        </div>
        <div className="mt-1 text-xs text-white/50">
          {imageUrl ? "Click to replace · PNG / JPG" : hint}
        </div>
      </div>
      <Upload className="h-5 w-5 text-white/40 transition-transform group-hover:translate-y-[-2px]" />
    </div>
  );
}

export function UploadZone({
  artworkUrl,
  wallUrl,
  onArtwork,
  onWall,
  onGenerate,
  isGenerating,
  count,
  onCountChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <div className="flex flex-1 flex-col gap-4 md:flex-row">
        <DropBox
          imageUrl={artworkUrl}
          onFile={onArtwork}
          stepLabel="01 · Artwork"
          title="Artwork loaded"
          placeholderTitle="Drop artwork"
          hint="or click to browse"
        />
        <DropBox
          imageUrl={wallUrl}
          onFile={onWall}
          stepLabel="02 · Wall (optional)"
          title="Wall loaded"
          placeholderTitle="Drop wall image"
          hint="background for all mockups"
        />
      </div>

      <div className="flex flex-col gap-3 lg:w-[320px]">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
            Mockups
          </div>
          <div className="flex gap-1 rounded-lg bg-black/30 p-1 ring-1 ring-white/5">
            {[1, 2, 3].map((n) => {
              const active = count === n;
              return (
                <button
                  key={n}
                  onClick={() => onCountChange(n as 1 | 2 | 3)}
                  disabled={isGenerating}
                  className={cn(
                    "h-7 w-9 rounded-md font-mono text-xs transition-all",
                    active
                      ? "bg-[var(--studio-accent)] text-black"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                    isGenerating && "cursor-not-allowed opacity-40",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={!artworkUrl || isGenerating}
          className={cn(
            "relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border px-8 font-display text-2xl tracking-tight transition-all",
            !artworkUrl || isGenerating
              ? "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/30"
              : "cursor-pointer border-[var(--studio-accent)]/40 bg-gradient-to-br from-[var(--studio-accent)]/20 to-[var(--studio-accent-2)]/10 text-white hover:from-[var(--studio-accent)]/30 hover:to-[var(--studio-accent-2)]/20",
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
              03 · Render Pipeline
            </div>
            <div>
              {isGenerating
                ? `Rendering ${count} mockup${count > 1 ? "s" : ""}…`
                : count === 1
                  ? "Generate Mockup"
                  : count === 2
                    ? "Generate Pair"
                    : "Generate Triptych"}
            </div>
            <div className="font-mono text-[10px] tracking-wider text-white/40">
              {count} SCENE{count > 1 ? "S" : ""} · ~{count * 10}S
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
