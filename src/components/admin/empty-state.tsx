export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed border-[#d8ccc3] bg-white px-6 py-14 text-center"><h3 className="text-base font-semibold text-[#342b27]">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm text-[#746c67]">{description}</p></div>;
}
