// ✅ FILE: client/src/components/sidebar/Sidebar.tsx
// Change: Chat History items are now SIMPLE TEXT ROWS (not big buttons).
// Everything else stays the same.

import React from "react";
import type { ChatListItem } from "../../lib/chatStore";
import type { MatrixStatus } from "../../lib/matrixApi";

type Props = {
  chats: ChatListItem[];
  activeChatId: string;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onRefreshMatrix: () => void;
  matrix: MatrixStatus | null;
  isCreatingChat?: boolean;
  showTopLogo?: boolean;
};

function GlowButton({
  children,
  onClick,
  disabled,
  title
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full rounded-2xl px-5 py-4 text-base font-semibold tracking-tight",
        "glass glow",
        "border border-purple-300/25",
        "bg-purple-700/15 hover:bg-purple-700/25 active:bg-purple-700/30",
        "transition",
        "focus:outline-none focus:ring-2 focus:ring-purple-400/40",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={["glass rounded-2xl border border-white/10 px-5 py-4", className].join(" ")}>{children}</div>
  );
}

export function Sidebar({
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onRefreshMatrix,
  matrix,
  isCreatingChat,
  showTopLogo
}: Props) {
  const loadedText = matrix?.loaded ? "Matrix: loaded" : "Matrix: not loaded";
  const shouldShowLogo = showTopLogo !== false;

  return (
    <aside className="w-full md:w-96 shrink-0 h-full p-6">
      <div className="glass glow rounded-3xl h-full flex flex-col overflow-hidden p-5 gap-4">
        {shouldShowLogo ? (
          <div className="flex justify-center pt-1">
            <div className="glass glow rounded-3xl border border-white/10 px-6 py-4">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-16 w-auto object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.35)]"
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full glass glow border border-purple-300/25 grid place-items-center">
            <span className="text-2xl font-bold text-purple-200">M</span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center justify-center rounded-2xl glass border border-white/10 px-5 py-2 text-2xl font-semibold">
              Matrix-AI
            </div>

            <div className="inline-flex items-center justify-center rounded-2xl glass border border-white/10 px-5 py-2 text-xl font-semibold text-foreground/90">
              Super QA Analyst
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlowButton onClick={onNewChat}>+ New Chat</GlowButton>
          <GlowButton onClick={onRefreshMatrix} title="Reload all Matrix tabs from Google Sheet">
            Refresh Matrix
          </GlowButton>
        </div>

        <Tile className="border border-purple-300/20">
          <div className="text-lg font-semibold">{loadedText}</div>
          {matrix?.loaded ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Loaded at {matrix.loadedAt ? new Date(matrix.loadedAt).toLocaleString() : "—"} • Tabs{" "}
              {matrix.tabs?.length || 0}
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">Click “Refresh Matrix”</div>
          )}
        </Tile>

        <Tile className="py-3 text-center">
          <div className="text-xl font-semibold">Chat History</div>
        </Tile>

        {/* ✅ SIMPLE TEXT LIST (not big buttons) */}
        <div className="flex-1 overflow-auto pr-1">
          <div className="flex flex-col">
            {chats.map((c) => {
              const active = c.id === activeChatId;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectChat(c.id)}
                  className={[
                    "w-full text-left px-2 py-2 rounded-lg",
                    "transition",
                    "focus:outline-none focus:ring-2 focus:ring-purple-400/40",
                    active ? "bg-white/10" : "hover:bg-white/5"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white truncate">{c.title}</span>
                    <span className="text-xs text-white/60">›</span>
                  </div>
                </button>
              );
            })}

            {chats.length === 0 ? (
              <div className="text-sm text-white/70 px-2 py-2">
                No chats yet — click <span className="text-white">New Chat</span>.
              </div>
            ) : null}
          </div>
        </div>

        <Tile className="py-3">
          <div className="text-lg font-semibold">Firebase:DATABASE</div>
        </Tile>

        {isCreatingChat ? (
          <Tile className="border border-purple-300/25 text-center py-5 glow">
            <div className="text-xl font-semibold text-foreground/90">Creating chat…</div>
          </Tile>
        ) : null}
      </div>
    </aside>
  );
}