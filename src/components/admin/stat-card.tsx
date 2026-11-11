export function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return <div className="rounded-xl border border-[#e4dcd5] bg-white p-5 shadow-sm"><p className="text-xs font-medium text-[#746c67]">{label}</p><p className="mt-3 text-3xl font-semibold text-[#2b2421]">{value}</p>{hint&&<p className="mt-2 text-xs text-[#8a817b]">{hint}</p>}</div>;
}
