/** Moldura das telas públicas de acesso (login, convite, recuperação), com a identidade do painel. */
export function AccessCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[#f3eee9] px-5 py-12"><section className="w-full max-w-md rounded-2xl border border-[#e0d6ce] bg-[#fffdfa] p-7 shadow-xl sm:p-9"><p className="font-serif text-3xl tracking-[.08em] text-[#66142e]">VITÓRIA</p><p className="text-[10px] uppercase tracking-[.3em] text-[#b88945]">Maison Admin</p><h1 className="mt-10 text-2xl font-semibold text-[#302724]">{title}</h1>{description && <p className="mt-2 text-sm leading-6 text-[#746c67]">{description}</p>}{children}</section></main>;
}
