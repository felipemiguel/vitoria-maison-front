import { SafeImage } from "@/components/property/safe-image";
import { initials } from "./links";

/**
 * Foto profissional do corretor. Sem foto cadastrada, um painel neutro com as iniciais:
 * nunca uma fotografia ilustrativa de outra pessoa.
 */
export function BrokerPortrait({ name, url, sizes, preload = false, aspectClassName = "aspect-[4/5]", compact = false, alt }: { name: string; url?: string | null; sizes: string; preload?: boolean; aspectClassName?: string; compact?: boolean; alt?: string }) {
  return <div className={`relative overflow-hidden bg-[#ebe3dc] ${aspectClassName}`}>
    {url ? <SafeImage src={url} alt={alt ?? `Foto de ${name}`} fill sizes={sizes} preload={preload} className="object-cover"/>
      : <div role="img" aria-label={`Iniciais de ${name}`} className="absolute inset-0 grid place-items-center"><span className={`serif leading-none text-[#66142e]/80 ${compact ? "text-3xl" : "text-[clamp(56px,10vw,140px)]"}`}>{initials(name)}</span>{!compact && <span className="absolute bottom-6 text-[10px] uppercase tracking-[.22em] text-[#69635f]">Vitória Maison</span>}</div>}
  </div>;
}
