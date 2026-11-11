"use client";

const STORAGE_KEY = "vitoria-maison:vista-selection";
const listeners = new Set<() => void>();
let cached: string[] = [];
let loaded = false;

export function getVistaSelection(): string[] {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
      cached = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
    } catch { cached = []; }
  }
  return cached;
}

export function getServerVistaSelection(): string[] { return EMPTY_SELECTION; }
const EMPTY_SELECTION: string[] = [];

export function setVistaSelection(value: string[]): void {
  cached = [...new Set(value)].slice(0, 20);
  loaded = true;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  listeners.forEach((listener) => listener());
}

export function subscribeVistaSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
