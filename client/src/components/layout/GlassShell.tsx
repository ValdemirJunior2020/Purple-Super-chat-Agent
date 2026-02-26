// ✅ FILE: client/src/components/layout/GlassShell.tsx
// Fix: use canonical Tailwind sizes (h-130, w-130, h-155, w-155) to remove IntelliSense warnings

import React from "react";

export function GlassShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-screen gemini-bg relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-130 w-130 rounded-full bg-purple-700/25 blur-3xl" />
        <div className="absolute top-1/3 -right-28 h-155 w-155 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/4 h-155 w-155 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}