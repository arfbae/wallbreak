import { Link } from "@tanstack/react-router";
import { Cloud, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function AuthPill() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Link
        to="/auth"
        className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/70 hover:border-[var(--studio-accent)]/50 hover:text-white"
      >
        <Cloud className="h-3 w-3" /> Sign in to sync
      </Link>
    );
  }

  const label = user.email ?? "signed in";
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--studio-accent)]/40 bg-[var(--studio-accent)]/10 px-3 py-1.5">
      <Cloud className="h-3 w-3 text-[var(--studio-accent)]" />
      <span className="max-w-[160px] truncate font-mono text-[10px] uppercase tracking-widest text-white/80">
        {label}
      </span>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-white/40 hover:text-white"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}
