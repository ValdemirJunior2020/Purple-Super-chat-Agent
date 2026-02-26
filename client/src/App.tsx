// ✅ FILE: client/src/App.tsx
// Update: after the first USER message, rename the chat title to the first characters of that message.

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
  }

  async function handleSelectChat(id: string) {
    setActiveChatId(id);
  }

  async function handleRefreshMatrix() {
    const s = await refreshMatrix();
    setMatrix(s);
  }

  async function handleAfterSendMessage(chatId: string, message: ChatMessage) {
    await saveMessage(chatId, message);

    // ✅ Rename chat when first user message arrives (only if current title is generic)
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
      <div className="min-h-screen bg-background text-foreground grid place-items-center">
        <div className="text-sm opacity-80">Loading…</div>
      </div>
    );
  }

  return (
    <GlassShell>
      <div className="h-screen w-screen overflow-hidden">
        <div className="h-full w-full flex">
          <Sidebar
            chats={chats}
            activeChatId={activeChatId}
            onNewChat={handleNewChat}
            onSelectChat={handleSelectChat}
            onRefreshMatrix={handleRefreshMatrix}
            matrix={matrix}
            isCreatingChat={!activeChatId}
          />

          <ChatView
            key={activeChatId}
            chatId={activeChatId}
            title={activeTitle}
            onPersistMessage={handleAfterSendMessage}
            firebaseError={firebaseError}
          />
        </div>
      </div>
    </GlassShell>
  );
}