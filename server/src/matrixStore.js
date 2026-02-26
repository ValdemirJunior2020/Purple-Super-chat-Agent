// ✅ FILE: server/src/matrixStore.js
// Uses MATRIX_TABS_JSON (gid+tabName) — no HTML scraping.
// Loads each tab as CSV via gviz export, finds the header row for gate columns,
// and when searching returns evidence INCLUDING Slack/Refund Queue/Create Ticket/Supervisor cells from the matched row.

import fetch from "node-fetch";
import Papa from "papaparse";

let matrix = {
  loaded: false,
  loadedAt: null,
  tabs: [],
  error: null
};

function normalizeCell(v) {
  if (v === null || v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

function extractSheetId(urlOrId) {
  const s = String(urlOrId || "").trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9-_]+$/.test(s)) return s;
  return "";
}

function parseTabsJson(raw) {
  const txt = String(raw || "").trim();
  if (!txt) return [];

  let arr;
  try {
    arr = JSON.parse(txt);
  } catch {
    throw new Error("MATRIX_TABS_JSON is not valid JSON.");
  }

  if (!Array.isArray(arr) || arr.length === 0) return [];

  return arr.map((t) => {
    if (!t || typeof t !== "object") throw new Error("MATRIX_TABS_JSON entries must be objects.");
    const tabName = String(t.tabName || "").trim();
    const gid = Number(t.gid);
    if (!tabName) throw new Error("Each MATRIX_TABS_JSON entry must include tabName.");
    if (!Number.isFinite(gid)) throw new Error("Each MATRIX_TABS_JSON entry must include numeric gid.");
    return { tabName, gid };
  });
}

async function fetchText(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`Failed to fetch: ${url} (${r.status})`);
  return r.text();
}

async function loadCsvFromGid(sheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const csv = await fetchText(url);
  const parsed = Papa.parse(csv, { skipEmptyLines: false });
  const data = (parsed.data || []).map((row) => row.map(normalizeCell));
  return data;
}

function findHeaderRow(rows) {
  // We look for these exact headers somewhere on the same row:
  const need = ["slack", "refund queue", "create a ticket", "supervisor"];
  const scanMax = Math.min(rows.length, 120);

  for (let r = 0; r < scanMax; r++) {
    const row = rows[r] || [];
    const joined = row.map((x) => String(x).trim().toLowerCase()).join(" | ");
    if (need.every((k) => joined.includes(k))) return r;
  }
  return -1;
}

function buildHeaderMap(headerRow) {
  const norm = headerRow.map((x) => String(x || "").trim().toLowerCase());
  const idxExact = (name) => norm.findIndex((c) => c === name);

  return {
    instructionsCol: idxExact("instructions"),
    slackCol: idxExact("slack"),
    refundCol: idxExact("refund queue"),
    ticketCol: idxExact("create a ticket"),
    supervisorCol: idxExact("supervisor")
  };
}

export function getMatrixStatus() {
  return {
    loaded: matrix.loaded,
    loadedAt: matrix.loadedAt,
    tabs: matrix.tabs.map((t) => ({
      tabName: t.tabName,
      gid: t.gid,
      width: t.width,
      height: t.height,
      headerRowIndex: t.headerRowIndex
    })),
    error: matrix.error
  };
}

export async function refreshMatrix() {
  const sheetId =
    extractSheetId(process.env.MATRIX_SHEET_ID) ||
    extractSheetId(process.env.MATRIX_SHEET_URL);

  if (!sheetId) throw new Error("Missing MATRIX_SHEET_ID (or MATRIX_SHEET_URL).");

  const envTabs = parseTabsJson(process.env.MATRIX_TABS_JSON);
  if (envTabs.length === 0) {
    throw new Error(
      'MATRIX_TABS_JSON is empty. Example: [{"tabName":"Voice Matrix","gid":1543851224}]'
    );
  }

  const loadedTabs = [];

  for (const t of envTabs) {
    const rows = await loadCsvFromGid(sheetId, t.gid);

    const height = rows.length;
    const width = Math.max(0, ...rows.map((r) => r.length));

    const headerRowIndex = findHeaderRow(rows);
    const headerRow = headerRowIndex >= 0 ? rows[headerRowIndex] : [];
    const headerMap = headerRowIndex >= 0 ? buildHeaderMap(headerRow) : null;

    loadedTabs.push({
      tabName: t.tabName,
      gid: t.gid,
      rows,
      width,
      height,
      headerRowIndex,
      headerMap
    });
  }

  matrix = {
    loaded: true,
    loadedAt: new Date().toISOString(),
    tabs: loadedTabs,
    error: null
  };

  return getMatrixStatus();
}

// Search every tab/cell; then pull gate columns (Slack/Refund/Ticket/Supervisor) from the matched row.
export function searchMatrix(queryText) {
  const q = String(queryText || "").trim();
  if (!matrix.loaded || !q) return { found: false, hits: [], summary: { totalHits: 0 } };

  const qLower = q.toLowerCase();
  const terms = qLower.split(/\s+/g).filter(Boolean).slice(0, 14);

  const scored = [];

  for (const tab of matrix.tabs) {
    for (let r = 0; r < tab.rows.length; r++) {
      const row = tab.rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = normalizeCell(row[c]);
        if (!cell) continue;

        const cellLower = cell.toLowerCase();
        let score = 0;

        if (cellLower.includes(qLower)) score += 20;
        for (const t of terms) if (cellLower.includes(t)) score += 2;

        if (score > 0) {
          scored.push({
            tab,
            rowIndex0: r,
            colIndex0: c,
            exact: cell,
            score
          });
        }
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return { found: false, hits: [], summary: { totalHits: 0 } };

  const tab = best.tab;
  const r0 = best.rowIndex0;
  const row = tab.rows[r0] || [];

  const hits = [];

  // Matched cell evidence
  hits.push({
    tabName: tab.tabName,
    row: r0 + 1,
    col: best.colIndex0 + 1,
    exact: normalizeCell(best.exact),
    label: "Matched"
  });

  // Gate evidence from the same row (only if this tab has those headers)
  if (tab.headerMap) {
    const hm = tab.headerMap;

    const addCol = (colIndex0, label) => {
      if (typeof colIndex0 !== "number" || colIndex0 < 0) return;
      const v = normalizeCell(row[colIndex0]);
      if (!v) return;
      hits.push({
        tabName: tab.tabName,
        row: r0 + 1,
        col: colIndex0 + 1,
        exact: v,
        label
      });
    };

    addCol(hm.instructionsCol, "Instructions");
    addCol(hm.slackCol, "Slack");
    addCol(hm.refundCol, "Refund Queue");
    addCol(hm.ticketCol, "Create a Ticket");
    addCol(hm.supervisorCol, "Supervisor");
  }

  return {
    found: true,
    hits,
    summary: {
      totalHits: scored.length,
      best: { tabName: tab.tabName, row: r0 + 1, col: best.colIndex0 + 1 }
    }
  };
}