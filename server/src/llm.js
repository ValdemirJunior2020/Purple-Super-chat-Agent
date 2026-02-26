// ✅ FILE: server/src/llm.js
// Update: evidence includes the gate labels (Slack / Refund Queue / Create a Ticket / Supervisor)
// so Claude ALWAYS sees those exact cells and quotes them.

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620";

function clean(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function buildMatrixEvidence(matches) {
  const lines = [];
  lines.push("SERVICE MATRIX EVIDENCE (ONLY source of truth):");
  for (const h of matches.hits) {
    const label = h.label ? ` (${clean(h.label)})` : "";
    lines.push(`- Tab: "${clean(h.tabName)}" | Cell: R${h.row}C${h.col}${label}`);
    lines.push(`  Exact: "${clean(h.exact)}"`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `
You are "QA Master" — the strictest, smartest HotelPlanner Call Center Quality & Compliance Analyst.

You MUST use ONLY the provided SERVICE MATRIX EVIDENCE. No outside knowledge.

Goal:
- Provide the exact compliant steps.
- Output Decision Gates for: Slack, Refund Queue, Create a Ticket, Supervisor.
- Use YES/NO. If the matrix shows conditional rules (ex: "YES only for same-day, NO for future"),
  you must request the missing verification field (ex: check-in date) and present the gate as conditional in the "Why" text,
  but keep the YES/NO cell starting with YES or NO.

Hard rules:
1) If evidence does not cover it, output EXACTLY:
   NOT FOUND IN DOCS
   Then ask 1–2 clarifying questions and stop.
2) Never invent policy or steps.
3) Every step and every gate must include a citation with Tab + Cell + exact quoted wording.

OUTPUT FORMAT (EXACT)

Acknowledge:
- (1 sentence empathic acknowledgement)

Verification Needed:
- Itinerary/Confirmation #:
- Guest Name:
- Hotel Name:
- Check-in Date:
- Check-out Date:
- City/Destination:

Decision Gates:
| Gate | YES/NO | Why (quote exact matrix wording) | Citation |
|---|---|---|---|
| Slack | YES/NO | "..." | [Tab: ... | Cell: R#C#] |
| Refund Queue | YES/NO | "..." | [Tab: ... | Cell: R#C#] |
| Create a Ticket | YES/NO | "..." | [Tab: ... | Cell: R#C#] |
| Supervisor | YES/NO | "..." | [Tab: ... | Cell: R#C#] |

Steps:
1) ...
2) ...
3) ...

Do/Don’t Script (agent lines):
- Say: "..."
- Don’t say: "..."

Citations:
- [Tab: <tab> | Cell: R#C# | Exact: "<exact quoted text>"]

Quality Check:
- Compliance Risk: Low/Medium/High + 1 reason grounded in matrix
- Missing Info Needed: None OR list

Now answer.
`.trim();

export async function streamAnswerFromClaude({ userMessage, matches, onToken, onDone }) {
  const evidence = buildMatrixEvidence(matches);

  const content = `
${evidence}

USER SCENARIO:
${clean(userMessage)}
`.trim();

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 900,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }]
  });

  stream.on("text", (t) => t && onToken(t));
  await stream.finalMessage();
  onDone?.();
}