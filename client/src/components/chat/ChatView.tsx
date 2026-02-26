
// Chat view
import { useEffect, useRef, useState  } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadMessages, type ChatMessage } from "../../lib/chatStore";
import { streamChat } from "../../lib/sseClient";
import { Composer } from "./Composer";
import { nowMs } from "../../lib/time";

type Props = {
  chatId: string;
  title: string;
  onPersistMessage: (chatId: string, msg: ChatMessage) => Promise<void>;
  firebaseError?: string | null;
};

const SUGGESTIONS = [
  "Reservation not found at check-in",
  "Overbooking leading to relocation (walked reservation) or hotel is closed down",
  "Incorrect guest name or modifying name",
  "Guest requests refund — what is the compliant process?"
];

export function ChatView({ chatId, title, onPersistMessage, firebaseError }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const assistantTextRef = useRef<string>("");

  useEffect(() => {
    if (!chatId) return;

    (async () => {
      const msgs = await loadMessages(chatId, 250);
      setMessages(msgs);
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }));
    })();
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || streaming || !chatId) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: nowMs()
    };

    setMessages((m) => [...m, userMsg]);
    setDraft("");
    await onPersistMessage(chatId, userMsg);

    const assistantId = crypto.randomUUID();
    assistantTextRef.current = "";

    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: nowMs()
    };

    setMessages((m) => [...m, assistantMsg]);
    setStreaming(true);

    await streamChat(chatId, text, {
      onToken: (t) => {
        assistantTextRef.current += t;
        setMessages((m) =>
          m.map((x) => (x.id === assistantId ? { ...x, content: x.content + t } : x))
        );
      },
      onDone: async () => {
        setStreaming(false);
        await onPersistMessage(chatId, { ...assistantMsg, content: assistantTextRef.current.trim() });
      },
      onError: async (msg) => {
        setStreaming(false);
        const errText = `**Error:** ${msg}`;
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: errText } : x)));
        await onPersistMessage(chatId, { ...assistantMsg, content: errText });
      }
    });
  }

  return (
    <main className="flex-1 h-full p-6">
      <div className="glass glow rounded-3xl h-full flex flex-col overflow-hidden relative">
        <div className="px-8 py-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold tracking-tight">Matrix-AI</div>
            <div className="text-xs text-muted-foreground truncate max-w-[60%]">{title}</div>
          </div>
        </div>

        {firebaseError ? (
          <div className="px-8 py-4 border-b border-white/10 bg-destructive/10">
            <div className="text-sm font-semibold text-destructive">Firebase issue</div>
            <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{firebaseError}</div>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto px-8 py-8 pb-28">
          {messages.length === 0 ? (
            <div className="h-full grid place-items-center">
              <div className="text-center max-w-2xl">
                <div className="text-3xl font-semibold text-foreground/90">How can I help you today?</div>

                <div className="mt-6 grid gap-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="glass glow border border-white/10 hover:bg-white/5 transition rounded-2xl px-5 py-3 text-left"
                    >
                      <div className="text-sm text-foreground/90 truncate">{s}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={[
                      "max-w-215 rounded-2xl border px-5 py-4",
                      m.role === "user" ? "bg-purple-600/25 border-purple-400/30" : "bg-white/5 border-white/10"
                    ].join(" ")}
                  >
                    <div className="text-xs text-muted-foreground mb-2">{m.role === "user" ? "You" : "QA Master"}</div>

                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content || (m.role === "assistant" && streaming ? "…" : "")}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="absolute left-0 right-0 bottom-0 px-8 pb-6 pt-3 bg-linear-to-t from-black/40 to-transparent">
          <Composer value={draft} onChange={setDraft} onSend={() => send()} disabled={streaming} />
        </div>
      </div>
    </main>
  );
}
