// ✅ FILE: server/src/index.js
// Make sure dotenv is loaded BEFORE anything else (keep this at the top)

import "dotenv/config";
import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { refreshMatrix, getMatrixStatus, searchMatrix } from "./matrixStore.js";
import { streamAnswerFromClaude } from "./llm.js";

/* ...rest of your file unchanged... */

const app = express();

app.use(express.json({ limit: "1mb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
    credentials: true
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/matrix/status", (req, res) => {
  res.json(getMatrixStatus());
});

app.post("/api/matrix/refresh", async (req, res) => {
  try {
    const status = await refreshMatrix();
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.post("/api/chat/stream", async (req, res) => {
  const { message, chatId } = req.body || {};
  const safeChatId = chatId || uuidv4();

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (!message || typeof message !== "string" || !message.trim()) {
      send("error", { message: "Missing message" });
      return res.end();
    }

    const status = getMatrixStatus();
    if (!status.loaded) {
      try {
        await refreshMatrix();
      } catch {
        // ignore
      }
    }

    const matches = searchMatrix(message);

    if (!matches.found) {
      const exact = "This scenario is not covered in the 2026 Service Matrix. Please escalate to supervisor.";
      send("meta", { chatId: safeChatId });
      send("token", { t: exact });
      send("done", { ok: true });
      return res.end();
    }

    send("meta", { chatId: safeChatId, matches: matches.summary });

    await streamAnswerFromClaude({
      userMessage: message,
      matches,
      onToken: (t) => send("token", { t }),
      onDone: () => send("done", { ok: true })
    });

    res.end();
  } catch (err) {
    send("error", { message: String(err?.message || err) });
    res.end();
  }
});

const port = Number(process.env.PORT || 5050);
app.listen(port, async () => {
  console.log(`Server listening on :${port}`);
  try {
    await refreshMatrix();
    console.log("Matrix loaded.");
  } catch (e) {
    console.log("Matrix load skipped/failed on boot:", String(e?.message || e));
  }
});
