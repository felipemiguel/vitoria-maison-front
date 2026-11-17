import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SafeImage } from "@/components/property/safe-image";
import { PropertyCard } from "@/components/property/property-card";
import { companyInfo } from "@/lib/config/company";
import { formatPrice } from "@/lib/format";
import type { Property } from "@/features/properties/types";
import { toRichChunks, type LandingBlock } from "@/features/landing-pages/blocks";
import type { LandingPageView } from "@/features/landing-pages/landing-page-service";
import { whatsappHref, whatsappMessage } from "@/features/landing-pages/whatsapp";
import { WhatsappButton } from "./whatsapp-button";

const PURPOSE: Record<Property["commercial"]["purpose"], string> = { SALE: "À venda", RENT: "Para alugar", INVESTMENT: "Para investir" };
const SECTION = "pt-16 md:pt-24";
const FACT_COLUMNS: Record<number, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5" };
const UNAVAILABLE_MESSAGE = "Olá! Vi uma página de imóvel da Vitória Maison e gostaria de conhecer opções parecidas.";

type Props = {
  page: LandingPageView;
  /** null = imóvel saiu do catálogo público: a página mostra o estado "indisponível". */
  property: Property | null;
  /** Sugestões exibidas quando o imóvel está indisponível. */
  alternatives?: Property[];
  /** Prévia no painel: links dos cards desativados. */
  preview?: boolean;
};

/**
 * Landing page de imóvel: blocos na ordem definida no painel, contato só por WhatsApp.
 * Preço, ficha e fotos vêm do snapshot do imóvel (nunca digitados).
 */
export function LandingPageViewer({ page, property, alternatives = [], preview = false }: Props) {
  const sourcePage = `/lp/${page.slug}`;
  if (!property) return <Shell page={page} sourcePage={sourcePage} href={page.whatsappNumber ? whatsappHref(page.whatsappNumber, UNAVAILABLE_MESSAGE) : null}>
    <section className="bg-[#66142e] pb-20 pt-40 text-white"><div className="container max-w-3xl">
      <p className="text-[11px] uppercase tracking-[.2em] text-white/65">Vitória Maison</p>
      <h1 className="serif mt-5 text-5xl leading-none md:text-7xl">Este imóvel não está mais disponível</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">Ele pode ter sido vendido ou alugado. Fale com a nossa equipe para conhecer opções parecidas.</p>
      <div className="mt-10"><WhatsappButton href={page.whatsappNumber ? whatsappHref(page.whatsappNumber, UNAVAILABLE_MESSAGE) : null} label="Falar no WhatsApp" sourcePage={sourcePage} variant="light"/></div>
    </div></section>
    {alternatives.length > 0 && <section className="section"><div className="container"><p className="eyebrow">Curadoria Vitória Maison</p><h2 className="serif section-title mt-4">Outros imóveis</h2>
      <div className="mt-12 grid gap-7 md:grid-cols-3">{alternatives.map((item) => <PropertyCard key={item.id} property={item} href={preview ? null : `/imoveis/${item.slug}`}/>)}</div></div></section>}
  </Shell>;

  const href = page.whatsappNumber ? whatsappHref(page.whatsappNumber, whatsappMessage(page.whatsappMessage, { code: property.commercial.code, title: property.editorial.title })) : null;
  const blocks = page.content.blocks.filter((block) => block.enabled);
  return <Shell page={page} sourcePage={sourcePage} href={href} code={property.commercial.code}>
    {blocks.map((block, index) => <Block key={block.id} block={block} property={property} page={page} href={href} sourcePage={sourcePage} first={index === 0}/>)}
  </Shell>;
}

function Shell({ page, href, code, sourcePage, children }: { page: LandingPageView; href: string | null; code?: string; sourcePage: string; children: React.ReactNode }) {
  return <div className="bg-[#f8f6f2] pb-20 md:pb-0">
    <header className="absolute inset-x-0 top-0 z-30"><div className="container flex items-center justify-between gap-4 py-5">
      <Link href="/" aria-label="Vitória Maison — início" className="rounded bg-white/95 px-3 py-2"><Logo className="w-[170px] md:w-[210px]"/></Link>
      <WhatsappButton href={href} label="WhatsApp" code={code} sourcePage={sourcePage} variant="light" className="hidden min-h-[44px] px-5 md:inline-flex"/>
    </div></header>
    <main className="pb-16 md:pb-24">{children}</main>
    <footer className="border-t border-[#e6ddd6] bg-[#f0eae4]"><div className="container grid gap-6 py-12 text-sm text-[#69635f] md:grid-cols-[1fr_auto] md:items-end">
      <div><p className="font-semibold text-[#181817]">{companyInfo.group} · CRECI {companyInfo.creci}</p>
        <p className="mt-2">{companyInfo.address.street} · {companyInfo.address.neighborhood}, {companyInfo.address.city} - {companyInfo.address.state}</p>
        <p className="mt-4 max-w-2xl text-xs leading-5">Valores, disponibilidade e condições sujeitos a alteração sem aviso prévio. Imagens ilustrativas. Confirme as informações com a nossa equipe antes de qualquer decisão.</p></div>
      <div className="flex gap-5"><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link></div>
    </div></footer>
    {/* Celular: botão do WhatsApp sempre visível. */}
    {href && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e6ddd6] bg-white/95 p-3 backdrop-blur md:hidden" data-page={page.slug}>
      <WhatsappButton href={href} label="Falar no WhatsApp" code={code} sourcePage={sourcePage} variant="bar"/>
    </div>}
  </div>;
}

function RichText({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{toRichChunks(text).map((chunk, index) => chunk.kind === "list"
    ? <ul key={index} className="mt-4 space-y-2">{chunk.items.map((item) => <li key={item} className="flex gap-3"><span aria-hidden className="text-[#66142e]">—</span><span>{item}</span></li>)}</ul>
    : <p key={index} className="mt-4 first:mt-0">{chunk.text}</p>)}</div>;
}

function SectionTitle({ title }: { title: string }) {
  return title ? <h2 className="serif section-title">{title}</h2> : null;
}

function priceLine(property: Property) {
  const c = property.commercial;
  return `${formatPrice(c.price)}${c.purpose === "RENT" ? "/mês" : ""}`;
}

function Block({ block, property, page, href, sourcePage, first }: { block: LandingBlock; property: Property; page: LandingPageView; href: string | null; sourcePage: string; first: boolean }) {
  const c = property.commercial;
  const code = c.code;
  switch (block.type) {
    case "hero": {
      const image = page.heroImageUrl ?? property.editorial.images[0]?.url;
      return <section className="relative flex min-h-[620px] items-end md:min-h-[760px] overflow-hidden bg-[#2a1d1a] text-white">
        {image && <SafeImage src={image} alt={property.editorial.images[0]?.alt ?? property.editorial.title} fill priority sizes="100vw" className="object-cover"/>}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20"/>
        <div className="container relative pb-16 pt-36 md:pb-24">
          {block.eyebrow && <p className="text-[11px] uppercase tracking-[.2em] text-white/75">{block.eyebrow}</p>}
          <h1 className="serif mt-4 max-w-4xl text-5xl leading-[.95] md:text-7xl">{block.title}</h1>
          {block.subtitle && <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85">{block.subtitle}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-5">
            <div><span className="block text-[10px] uppercase tracking-[.16em] text-white/65">{PURPOSE[c.purpose]}</span><b className="serif mt-1 block text-3xl font-normal md:text-4xl">{priceLine(property)}</b></div>
            <WhatsappButton href={href} label={block.ctaLabel || "Falar no WhatsApp"} code={code} sourcePage={sourcePage} variant="light"/>
          </div>
        </div>
      </section>;
    }
    case "facts": {
      const facts = [["Valor", priceLine(property)], ["Área privativa", `${c.area} m²`], ["Dormitórios", c.bedrooms], ["Suítes", c.suites], ["Vagas", c.parkingSpaces]].filter(([, value]) => value);
      return <section className={first ? "pt-32" : SECTION}><div className="container">
        <SectionTitle title={block.title}/>
        <dl className={`mt-10 grid grid-cols-2 gap-px border border-[#e6ddd6] bg-[#e6ddd6] [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1 ${FACT_COLUMNS[facts.length] ?? "md:grid-cols-5"}`}>{facts.map(([label, value]) => <div key={label as string} className="bg-[#f8f6f2] p-5"><dt className="text-[9px] uppercase tracking-[.14em] text-[#69635f]">{label}</dt><dd className="serif mt-2 text-2xl">{value}</dd></div>)}</dl>
        <p className="mt-4 text-xs uppercase tracking-[.12em] text-[#69635f]">Código do imóvel: {code}</p>
      </div></section>;
    }
    case "text":
      return block.body ? <section className={SECTION}><div className="container grid gap-8 lg:grid-cols-[1fr_1.4fr]"><SectionTitle title={block.title}/><RichText text={block.body} className="prose max-w-3xl"/></div></section> : null;
    case "gallery": {
      const images = property.editorial.images.slice(0, block.limit);
      if (!images.length) return null;
      return <section className={SECTION}><div className="container"><SectionTitle title={block.title}/>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">{images.map((image, index) => <div key={image.url} className={`relative overflow-hidden bg-[#e6ddd6] ${index === 0 ? `col-span-2 aspect-[16/10] ${images.length >= 3 ? "md:row-span-2 md:aspect-auto" : "md:col-span-3"}` : "aspect-[4/3]"}`}>
          <SafeImage src={image.url} alt={image.alt} fill sizes={index === 0 ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 50vw"} className="object-cover"/></div>)}</div>
      </div></section>;
    }
    case "highlights":
      return block.items.length ? <section className={SECTION}><div className="container"><SectionTitle title={block.title}/>
        <ul className="mt-10 grid gap-px border border-[#e6ddd6] bg-[#e6ddd6] sm:grid-cols-2 lg:grid-cols-3">{block.items.map((item) => <li key={item.title} className="bg-[#f8f6f2] p-6"><p className="serif text-2xl">{item.title}</p>{item.text && <p className="mt-3 text-sm leading-6 text-[#69635f]">{item.text}</p>}</li>)}</ul>
      </div></section> : null;
    case "location":
      return <section className={SECTION}><div className="container grid gap-8 lg:grid-cols-[1fr_1.4fr]"><div><SectionTitle title={block.title}/><p className="mt-4 text-sm uppercase tracking-[.14em] text-[#66142e]">{property.location.neighborhood} · {property.location.city}</p></div>{block.body && <RichText text={block.body} className="prose max-w-3xl"/>}</div></section>;
    case "conditions":
      return block.body ? <section className={SECTION}><div className="container"><div className="border border-[#e6ddd6] bg-white p-7 md:p-10"><SectionTitle title={block.title}/><RichText text={block.body} className="prose mt-6 max-w-3xl"/><p className="mt-6 text-xs text-[#69635f]">Condições e valores informativos, sujeitos a alteração e à aprovação. Consulte a nossa equipe.</p></div></div></section> : null;
    case "faq":
      return block.items.length ? <section className={SECTION}><div className="container max-w-4xl"><SectionTitle title={block.title}/>
        <div className="mt-8 divide-y divide-[#e6ddd6] border-y border-[#e6ddd6]">{block.items.map((item) => <details key={item.question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg">{item.question}<span aria-hidden className="text-2xl text-[#66142e] transition group-open:rotate-45">+</span></summary><RichText text={item.answer} className="prose mt-4"/></details>)}</div>
      </div></section> : null;
    case "cta":
      return <section className={SECTION}><div className="container"><div className="bg-[#66142e] px-7 py-14 text-center text-white md:px-16">
        <h2 className="serif text-4xl leading-tight md:text-6xl">{block.title}</h2>
        {block.text && <p className="mx-auto mt-5 max-w-2xl text-white/80">{block.text}</p>}
        <div className="mt-9"><WhatsappButton href={href} label={block.ctaLabel || "Falar no WhatsApp"} code={code} sourcePage={sourcePage} variant="light"/></div>
      </div></div></section>;
  }
}
