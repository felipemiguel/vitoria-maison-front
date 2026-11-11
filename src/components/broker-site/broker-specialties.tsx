/** Seção 04: especialidades e regiões, somente quando preenchidas. Nada é inferido. */
export function BrokerSpecialties({ specialties = [], regions = [] }: { specialties?: string[]; regions?: string[] }) {
  if (!specialties.length && !regions.length) return null;
  const list = (title: string, items: string[]) => items.length > 0 && <div><p className="eyebrow">{title}</p><ul className="mt-6 divide-y divide-[#e6ddd6] border-y border-[#e6ddd6]">{items.map((item) => <li key={item} className="serif py-4 text-2xl md:text-3xl">{item}</li>)}</ul></div>;
  return <section className="section bg-[#f8f6f2]"><div className={`container grid gap-14 ${specialties.length && regions.length ? "md:grid-cols-2" : "max-w-3xl"}`}>{list("Especialidades", specialties)}{list("Regiões de atuação", regions)}</div></section>;
}
