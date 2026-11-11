const styles: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-800 ring-emerald-200", SUCCESS: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  MANUAL_CONFIRMED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  PUBLIC: "bg-emerald-50 text-emerald-800 ring-emerald-200", PUBLISHED: "bg-blue-50 text-blue-800 ring-blue-200",
  UNKNOWN: "bg-amber-50 text-amber-800 ring-amber-200", NEVER: "bg-stone-100 text-stone-700 ring-stone-200",
  DRAFT: "bg-stone-100 text-stone-700 ring-stone-200", UNAVAILABLE: "bg-red-50 text-red-800 ring-red-200",
  FAILED: "bg-red-50 text-red-800 ring-red-200", EXPIRED: "bg-red-50 text-red-800 ring-red-200",
};

export function PropertyStatusBadge({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] ring-1 ring-inset ${styles[value] ?? styles.NEVER}`}>{label ?? value}</span>;
}
