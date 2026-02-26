const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export type StreamHandlers = {
  onMeta?: (meta: any) => void;
  onToken?: (t: string) => void;
  onDone?: () => void;
  onError?: (msg: string) => void;
};

export async function streamChat(chatId: string, message: string, handlers: StreamHandlers) {
  const r = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message })
  });

  if (!r.ok || !r.body) {
    handlers.onError?.(`Server error (${r.status})`);
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  const process = (chunk: string) => {
    buf += chunk;

    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const rawEvent = buf.slice(0, idx);
      buf = buf.slice(idx + 2);

      const lines = rawEvent.split("\n");
      let eventName = "message";
      let dataLine = "";

      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }

      if (!dataLine) continue;

      try {
        const data = JSON.parse(dataLine);

        if (eventName === "meta") handlers.onMeta?.(data);
        if (eventName === "token") handlers.onToken?.(data.t || "");
        if (eventName === "done") handlers.onDone?.();
        if (eventName === "error") handlers.onError?.(data.message || "Error");
      } catch {
        // ignore
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    process(decoder.decode(value, { stream: true }));
  }
}
