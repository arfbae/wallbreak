import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  open: boolean;
  imageUrl: string | null;
  name: string | null;
  onClose: () => void;
}

export function CinematicReveal({ open, imageUrl, name, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
        >
          {/* Cinematic image with sequenced zoom-out + parallax */}
          <motion.img
            src={imageUrl}
            alt={name ?? ""}
            initial={{ scale: 3.2, x: 80, y: -60, filter: "blur(8px)" }}
            animate={{
              scale: [3.2, 2.4, 1.05, 1.1],
              x: [80, 40, 0, -20],
              y: [-60, -20, 0, 10],
              filter: ["blur(8px)", "blur(2px)", "blur(0px)", "blur(0px)"],
            }}
            transition={{
              duration: 7,
              times: [0, 0.25, 0.7, 1],
              ease: [0.22, 1, 0.36, 1],
              repeat: Infinity,
              repeatType: "reverse",
            }}
            className="h-full w-full object-cover"
          />

          {/* Letterbox bars */}
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute top-0 left-0 h-[8vh] w-full origin-top bg-black"
          />
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute bottom-0 left-0 h-[8vh] w-full origin-bottom bg-black"
          />

          {/* HUD */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="absolute bottom-[10vh] left-0 right-0 px-12 text-center"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">
              Cinematic Reveal · Selected Mockup
            </div>
            <div className="mt-2 font-display text-3xl tracking-tight text-white">{name}</div>
          </motion.div>

          <button
            onClick={onClose}
            className="absolute top-[10vh] right-8 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
