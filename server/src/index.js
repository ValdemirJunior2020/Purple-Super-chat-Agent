// ✅ FILE: server/src/index.js
// FIX: CORS blocked because ALLOWED_ORIGINS contains a trailing "/" and your code was doing exact match.
// This version NORMALIZES origins (lowercase + removes trailing "/") and properly handles OPTIONS + SSE.

import "dotenv/config";
import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { refreshMatrix, getMatrixStatus, searchMatrix } from "./matrixStore.js";
import { streamAnswerFromClaude } from "./llm.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));

// ✅ Normalize helper (Origin header NEVER includes a trailing slash)
function normalizeOrigin(v) {
  return String(v || "")
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();
}

const allowlist = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // same-origin/server-to-server/no Origin header
    if (!origin) return cb(null, true);

    const o = normalizeOrigin(origin);

    // allow all if allowlist is empty
    if (allowlist.length === 0) return cb(null, true);

    // allow if exact match after normalization
    if (allowlist.includes(o)) return cb(null, true);

    // block
    return cb(new Error("CORS blocked"), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.get("/", (req, res) => res.status(200).send("Super QA Analyst API is running."));
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

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

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (!message || typeof message !== "string" || !message.trim()) {
      send("error", { message: "Missing message" });
      return res.end();
    }

    // Ensure matrix loaded
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
      const exact =
        "This scenario is not covered in the 2026 Service Matrix. Please escalate to supervisor.";
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