const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

export type MatrixStatus = {
  loaded: boolean;
  loadedAt: string | null;
  tabs: { tabName: string; width: number; height: number }[];
  error: string | null;
};

export async function getMatrixStatus(): Promise<MatrixStatus> {
  const r = await fetch(`${API_BASE}/api/matrix/status`);
  if (!r.ok) throw new Error("Matrix status failed");
  return r.json();
}

export async function refreshMatrix(): Promise<MatrixStatus> {
  const r = await fetch(`${API_BASE}/api/matrix/refresh`, { method: "POST" });
  if (!r.ok) throw new Error("Matrix refresh failed");
  const data = await r.json();
  return data.status as MatrixStatus;
}
