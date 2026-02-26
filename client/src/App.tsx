

import React, { useEffect, useMemo, useState } from "react";
import { initFirebase, signInAnon } from "./lib/firebase";
import { GlassShell } from "./components/layout/GlassShell";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ChatView } from "./components/chat/ChatView";

import {
  createNewChat,
  listChats,
  saveMessage,
  setChatTitle,
  type ChatListItem,
  type ChatMessage
} from "./lib/chatStore";
import { refreshMatrix, getMatrixStatus, type MatrixStatus } from "./lib/matrixApi";

function getErrorText(e: unknown): string {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown error";
}

function makeTitleFromText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New Chat";
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

function isGenericTitle(t: string): boolean {
  const x = (t || "").trim().toLowerCase();
  return x === "new chat" || x === "recovered chat";
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [matrix, setMatrix] = useState<MatrixStatus | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        initFirebase();
        await signInAnon();
      } catch (e: unknown) {
        setFirebaseError(getErrorText(e));
      }

      const items = await listChats(30);
      setChats(items);

      if (items[0]?.id) setActiveChatId(items[0].id);
      else {
        const id = await createNewChat("New Chat");
        setActiveChatId(id);
        setChats(await listChats(30));
      }

      setReady(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await getMatrixStatus();
        setMatrix(s);
      } catch {
        setMatrix(null);
      }
    })();
  }, []);

  const activeTitle = useMemo(
    () => chats.find((c) => c.id === activeChatId)?.title || "New Chat",
    [chats, activeChatId]
  );

  async function handleNewChat() {
    const id = await createNewChat("New Chat");
    setActiveChatId(id);
    setChats(await listChats(30));
    setSidebarOpen(false);
  }

  async function handleSelectChat(id: string) {
    setActiveChatId(id);
    setSidebarOpen(false);
  }

  async function handleRefreshMatrix() {
    const s = await refreshMatrix();
    setMatrix(s);
  }

  async function handleAfterSendMessage(chatId: string, message: ChatMessage) {
    await saveMessage(chatId, message);

    if (message.role === "user") {
      const current = chats.find((c) => c.id === chatId)?.title || "New Chat";
      if (isGenericTitle(current)) {
        await setChatTitle(chatId, makeTitleFromText(message.content));
      }
    }

    setChats(await listChats(30));
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center">
        <div className="text-sm opacity-80">Loading…</div>
      </div>
    );
  }

  return (
    <GlassShell>
      {/* ✅ Always-sticky top header space */}
      <div className="fixed top-0 left-0 right-0 z-60 pointer-events-none">
        <div className="w-full flex justify-center pt-3">
          <div className="pointer-events-auto glass glow rounded-3xl border border-white/10 px-8 py-4">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-16 w-auto object-contain drop-shadow-[0_0_22px_rgba(168,85,247,0.45)]"
            />
          </div>
        </div>
      </div>

      {/* ✅ Add top padding so content doesn't slide behind the sticky logo */}
      <div className="h-screen w-screen overflow-hidden relative pt-24">
        {/* Mobile top bar */}
        <div className="md:hidden px-4 pt-2">
          <div className="glass glow rounded-2xl border border-white/10 px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="px-3 py-2 rounded-xl glass border border-white/10 hover:bg-white/5 transition"
              aria-label="Open menu"
            >
              ☰
            </button>

            <div className="text-sm font-semibold truncate max-w-[65%]">{activeTitle}</div>

            <button
              type="button"
              onClick={handleNewChat}
              className="px-3 py-2 rounded-xl bg-purple-600/35 border border-white/10 hover:bg-purple-600/50 transition"
              aria-label="New chat"
            >
              ＋
            </button>
          </div>
        </div>

        <div className="h-full w-full flex">
          <div className="hidden md:block">
            <Sidebar
              chats={chats}
              activeChatId={activeChatId}
              onNewChat={handleNewChat}
              onSelectChat={handleSelectChat}
              onRefreshMatrix={handleRefreshMatrix}
              matrix={matrix}
              isCreatingChat={!activeChatId}
              showTopLogo={false}
            />
          </div>

          <div className="flex-1 min-w-0">
            <ChatView
              key={activeChatId}
              chatId={activeChatId}
              title={activeTitle}
              onPersistMessage={handleAfterSendMessage}
              firebaseError={firebaseError}
            />
          </div>
        </div>

        {sidebarOpen ? (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-[92%] max-w-105 p-4 pt-24">
              <div className="relative h-full">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="absolute right-3 top-3 z-10 px-3 py-2 rounded-xl glass border border-white/10 hover:bg-white/5 transition"
                  aria-label="Close menu"
                >
                  ✕
                </button>

                <Sidebar
                  chats={chats}
                  activeChatId={activeChatId}
                  onNewChat={handleNewChat}
                  onSelectChat={handleSelectChat}
                  onRefreshMatrix={handleRefreshMatrix}
                  matrix={matrix}
                  isCreatingChat={!activeChatId}
                  showTopLogo={false}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </GlassShell>
  );
}