"use client";

import { signOut } from "@/lib/auth-actions";
import { LogOut } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-dm-sans flex flex-col">
      <header className="bg-surface-raised border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="font-syne font-bold text-ink text-xl">Admin Console</div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-muted hover:text-error hover:bg-error-bg rounded-md transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
