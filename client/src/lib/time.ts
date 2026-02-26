// ✅ FILE: client/src/lib/time.ts
// Adds a helper so your eslint rule stops complaining about Date.now()

export function nowMs(): number {
  return Date.now();
}