// ✅ FILE: client/src/lib/chatStore.ts
// Update: add setChatTitle() so chats rename from "New Chat" to first characters of the first message.
// Keeps Firebase (anonymous) + Local fallback.

import {
  collection,
  addDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  setDoc,
  where,
  type DocumentData
} from "firebase/firestore";
import { db, auth } from "./firebase";

export type ChatListItem = {
  id: string;
  title: string;
  storage: "firebase" | "local";
  updatedAtMs: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number; // unix ms
};

type MessageDoc = {
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

const CHATS_COL = "chats";
const LOCAL_INDEX_KEY = "localChats:index";

function now() {
  return Date.now();
}

function uidOrEmpty(): string {
  return auth().currentUser?.uid || "";
}

function localChatId() {
  return `local-${crypto.randomUUID()}`;
}

function readLocalIndex(): ChatListItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is ChatListItem => {
        if (!x || typeof x !== "object") return false;
        const o = x as Record<string, unknown>;
        return typeof o.id === "string" && typeof o.title === "string" && (o.storage === "local" || o.storage === "firebase");
      })
      .map((x) => ({ ...x, storage: "local" as const }));
  } catch {
    return [];
  }
}

function writeLocalIndex(items: ChatListItem[]) {
  localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(items));
}

function localMessagesKey(chatId: string) {
  return `localChats:${chatId}:messages`;
}

function readLocalMessages(chatId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(localMessagesKey(chatId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m): m is ChatMessage => {
      if (!m || typeof m !== "object") return false;
      const o = m as Record<string, unknown>;
      return typeof o.id === "string" && (o.role === "user" || o.role === "assistant") && typeof o.content === "string" && typeof o.createdAt === "number";
    });
  } catch {
    return [];
  }
}

function writeLocalMessages(chatId: string, msgs: ChatMessage[]) {
  localStorage.setItem(localMessagesKey(chatId), JSON.stringify(msgs));
}

function upsertLocalChat(chatId: string, title: string) {
  const idx = readLocalIndex();
  const updatedAtMs = now();

  const item: ChatListItem = { id: chatId, title, storage: "local", updatedAtMs };
  const exists = idx.some((c) => c.id === chatId);

  const next = exists ? idx.map((c) => (c.id === chatId ? item : c)) : [item, ...idx];
  writeLocalIndex(next.sort((a, b) => b.updatedAtMs - a.updatedAtMs));
}

function parseFirestoreTimestampMs(v: unknown): number {
  if (!v || typeof v !== "object") return 0;
  const obj = v as { toMillis?: () => number };
  return typeof obj.toMillis === "function" ? obj.toMillis() : 0;
}

export async function createNewChat(title: string): Promise<string> {
  const uid = uidOrEmpty();

  if (uid) {
    try {
      const chatsRef = collection(db(), CHATS_COL);
      const chatDoc = await addDoc(chatsRef, {
        uid,
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return chatDoc.id;
    } catch {
      // fall back to local
    }
  }

  const id = localChatId();
  upsertLocalChat(id, title);
  return id;
}

export async function setChatTitle(chatId: string, title: string): Promise<void> {
  if (!chatId) return;
  const safeTitle = String(title || "").trim() || "New Chat";

  // local
  if (chatId.startsWith("local-")) {
    upsertLocalChat(chatId, safeTitle);
    return;
  }

  // firebase
  try {
    const uid = uidOrEmpty();
    if (!uid) throw new Error("Not signed in");
    const chatRef = doc(db(), CHATS_COL, chatId);
    await setDoc(chatRef, { title: safeTitle, updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    // if firebase fails, store a local copy so UI still behaves
    const localId = localChatId();
    upsertLocalChat(localId, safeTitle);
  }
}

export async function listChats(max = 30): Promise<ChatListItem[]> {
  const uid = uidOrEmpty();
  const local = readLocalIndex().slice(0, max);

  if (!uid) return local;

  try {
    const chatsRef = collection(db(), CHATS_COL);
    const qy = query(chatsRef, where("uid", "==", uid), orderBy("updatedAt", "desc"), limit(max));
    const snap = await getDocs(qy);

    const firebaseChats: ChatListItem[] = snap.docs.map((d) => {
      const data = d.data() as DocumentData;
      const title = typeof data.title === "string" ? data.title : "New Chat";
      const updatedAtMs = parseFirestoreTimestampMs(data.updatedAt) || parseFirestoreTimestampMs(data.createdAt) || now();
      return { id: d.id, title, storage: "firebase", updatedAtMs };
    });

    const combined = [...firebaseChats, ...local];
    const dedup = new Map<string, ChatListItem>();
    for (const c of combined) if (!dedup.has(c.id)) dedup.set(c.id, c);
    return Array.from(dedup.values()).sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, max);
  } catch {
    return local;
  }
}

export async function saveMessage(chatId: string, msg: ChatMessage): Promise<void> {
  if (!chatId) return;

  if (chatId.startsWith("local-")) {
    const msgs = readLocalMessages(chatId);
    writeLocalMessages(chatId, [...msgs, msg]);
    upsertLocalChat(chatId, "New Chat");
    return;
  }

  try {
    const chatRef = doc(db(), CHATS_COL, chatId);
    const msgRef = collection(chatRef, "messages");
    await addDoc(msgRef, { role: msg.role, content: msg.content, createdAt: msg.createdAt } satisfies MessageDoc);
    await setDoc(chatRef, { updatedAt: serverTimestamp() }, { merge: true });
  } catch {
    // fallback to local
    const localId = localChatId();
    upsertLocalChat(localId, "Recovered Chat");
    const msgs = readLocalMessages(localId);
    writeLocalMessages(localId, [...msgs, msg]);
  }
}

export async function loadMessages(chatId: string, max = 200): Promise<ChatMessage[]> {
  if (!chatId) return [];

  if (chatId.startsWith("local-")) {
    return readLocalMessages(chatId).slice(-max);
  }

  try {
    const chatRef = doc(db(), CHATS_COL, chatId);
    const msgRef = collection(chatRef, "messages");
    const qy = query(msgRef, orderBy("createdAt", "asc"), limit(max));
    const snap = await getDocs(qy);

    return snap.docs.map((d) => {
      const data = d.data() as DocumentData;
      const role = data.role === "assistant" ? "assistant" : "user";
      const content = typeof data.content === "string" ? data.content : "";
      const createdAt = typeof data.createdAt === "number" ? data.createdAt : now();
      return { id: d.id, role, content, createdAt };
    });
  } catch {
    return [];
  }
}