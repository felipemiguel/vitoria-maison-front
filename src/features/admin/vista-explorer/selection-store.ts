"use client";

const STORAGE_KEY = "vitoria-maison:vista-selection";
const listeners = new Set<() => void>();
let cached: string[] = [];
let cachedPurpose: "ALL" | "SALE" | "RENT" | undefined;
let loaded = false;

function load(): void {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(parsed)) cached = parsed.filter((item): item is string => typeof item === "string").slice(0, 20);
      else if (parsed && typeof parsed === "object") {
        const stored = parsed as { codes?: unknown; purpose?: unknown };
        cached = Array.isArray(stored.codes) ? stored.codes.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
        cachedPurpose = stored.purpose === "ALL" || stored.purpose === "SALE" || stored.purpose === "RENT" ? stored.purpose : undefined;
      }
    } catch { cached = []; cachedPurpose = undefined; }
  }
}

function persist(): void { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ codes: cached, purpose: cachedPurpose })); }

export function getVistaSelection(): string[] {
  load();
  return cached;
}

export function getVistaSelectionPurpose(): "ALL" | "SALE" | "RENT" | undefined { load(); return cachedPurpose; }
export function getServerVistaSelectionPurpose(): undefined { return undefined; }

export function getServerVistaSelection(): string[] { return EMPTY_SELECTION; }
const EMPTY_SELECTION: string[] = [];

export function setVistaSelection(value: string[]): void {
  cached = [...new Set(value)].slice(0, 20);
  loaded = true;
  persist();
  listeners.forEach((listener) => listener());
}

export function setVistaSelectionPurpose(value: "ALL" | "SALE" | "RENT"): void {
  cachedPurpose = value;
  loaded = true;
  persist();
  listeners.forEach((listener) => listener());
}

export function subscribeVistaSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
