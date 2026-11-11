import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Property } from "@/features/properties/types";
import { formatPrice } from "@/lib/format";
import { SafeImage } from "./safe-image";

const typeLabel={APARTMENT:"Apartamento",FLAT:"Flat",STUDIO:"Studio",PENTHOUSE:"Cobertura"};
/**
 * `sizes` deve refletir a grade onde o card é usado, para o navegador não baixar fotos maiores
 * que o necessário. `preload` apenas no primeiro card acima da dobra; os demais usam lazy loading.
 */
export function PropertyCard({property,preload=false,sizes="(min-width: 768px) 33vw, 100vw"}:{property:Property;preload?:boolean;sizes?:string}){const c=property.commercial;const cover=property.editorial.images[0];return <article><Link href={`/imoveis/${property.slug}`} className="group block"><div className="image-zoom relative aspect-[4/5] bg-[#e7e0da]">{cover&&<SafeImage src={cover.url} alt={cover.alt} fill className="object-cover" sizes={sizes} preload={preload}/>}<span className="absolute left-4 top-4 bg-[#f8f6f2] px-3 py-2 text-[10px] uppercase tracking-[.15em]">{typeLabel[c.type]}</span></div><div className="flex items-start justify-between border-b border-[#d8cdc4] py-5"><div><p className="text-[10px] uppercase tracking-[.16em] text-[#66142e]">{property.location.neighborhood} · {property.location.city}</p><h3 className="serif mt-2 text-[25px] leading-tight">{property.editorial.title}</h3><p className="mt-3 text-sm text-[#69635f]">{c.area} m²{c.bedrooms ? ` · ${c.bedrooms} dorm.` : ""} · {formatPrice(c.price)}</p></div><ArrowUpRight className="mt-1 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" size={19} aria-hidden/></div></Link></article>}
