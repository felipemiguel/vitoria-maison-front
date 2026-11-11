import Link from "next/link";
import { buildNoIndexMetadata } from "@/features/seo/metadata";
import { companyInfo } from "@/lib/config/company";

/** Mantido como noindex até a revisão jurídica. Após aprovação, trocar por buildPageMetadata e incluir no sitemap. */
export function generateMetadata(){return buildNoIndexMetadata({title:"Termos de Uso",description:"Condições de uso do site Vitória Maison: informações sobre imóveis, formulários de contato, intermediação imobiliária, propriedade intelectual e responsabilidades.",path:"/termos"})}

const LAST_UPDATE = "10 de novembro de 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4"><h2 className="serif text-3xl text-[#181817]">{title}</h2>{children}</section>;
}

export default function Page(){
  const a = companyInfo.address;
  return <div className="container max-w-3xl pb-24 pt-40">
    <h1 className="serif text-6xl">Termos de Uso</h1>
    <p className="mt-6 text-xs uppercase tracking-[.14em] text-[#69635f]">Última atualização: {LAST_UPDATE}</p>
    <div className="prose mt-10 space-y-12 text-[#69635f]">
      <Section title="1. Quem somos">
        <p>Este site é operado pela Vitória Maison, marca do {companyInfo.group}, imobiliária inscrita no CRECI sob o nº {companyInfo.creci}, com endereço na {a.street}, {a.neighborhood}, {a.city} - {a.state}, CEP {a.postalCode}.</p>
        <p>Ao navegar pelo site ou enviar qualquer formulário, você declara ter lido e concordado com estes Termos de Uso e com a nossa <Link href="/privacidade" className="text-[#66142e] underline underline-offset-4">Política de Privacidade</Link>. Se não concordar, recomendamos não utilizar o site.</p>
      </Section>

      <Section title="2. Informações sobre os imóveis">
        <p>Os imóveis apresentados resultam de uma curadoria da nossa equipe. Preços, áreas, número de dormitórios, vagas, características e disponibilidade são informados com base nos dados disponíveis no momento da publicação e podem ser alterados a qualquer tempo, sem aviso prévio, inclusive por decisão do proprietário.</p>
        <p>As informações têm caráter informativo e não constituem proposta, oferta vinculante ou reserva. Valores de condomínio, IPTU, taxas e demais custos, bem como a documentação do imóvel, devem ser confirmados com a nossa equipe antes de qualquer decisão.</p>
        <p>Fotografias de imóveis podem ter sido produzidas em datas anteriores e não necessariamente refletem o estado atual de conservação ou a decoração. Imagens de ambientes usadas em seções institucionais e editoriais do site são meramente ilustrativas e não representam imóveis específicos.</p>
      </Section>

      <Section title="3. Intermediação imobiliária">
        <p>A Vitória Maison atua na intermediação de compra, venda e locação de imóveis. Visitas, propostas e negociações são conduzidas pela nossa equipe e só se formalizam por meio de instrumento próprio, assinado pelas partes envolvidas.</p>
        <p>A remuneração pela intermediação, quando aplicável, segue a legislação vigente e as condições acordadas por escrito em cada negociação.</p>
      </Section>

      <Section title="4. Conteúdo sobre investimentos">
        <p>Conteúdos sobre investimento imobiliário, flats e hotelaria têm finalidade exclusivamente informativa e não constituem recomendação de investimento, consultoria financeira, jurídica ou tributária. Resultados obtidos no passado não garantem resultados futuros, e eventuais estimativas de retorno dependem de condições de mercado e do desempenho de terceiros, como operadoras hoteleiras.</p>
        <p>A decisão de investir é de responsabilidade do usuário, que deve avaliar seu perfil e, quando necessário, buscar orientação profissional independente.</p>
      </Section>

      <Section title="5. Formulários e contato">
        <p>Ao enviar um formulário, você se compromete a fornecer informações verdadeiras e atualizadas, em seu próprio nome ou com autorização de quem representa. Os dados são utilizados para responder à sua solicitação e tratados conforme a Política de Privacidade.</p>
        <p>O envio de um formulário não garante a disponibilidade do imóvel nem gera obrigação de atendimento em prazo determinado. Nossa equipe entrará em contato pelos meios informados.</p>
      </Section>

      <Section title="6. Anúncio de imóveis por proprietários">
        <p>O envio de dados pela página Anuncie seu imóvel não implica aceitação automática do imóvel para comercialização. A inclusão na curadoria depende de avaliação da nossa equipe e da formalização de autorização específica.</p>
        <p>Quem apresenta um imóvel declara ser o proprietário ou ter poderes para representá-lo, e que as informações prestadas são verdadeiras.</p>
      </Section>

      <Section title="7. Uso permitido">
        <p>O site destina-se ao uso pessoal e não comercial. Não é permitido:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>copiar, extrair ou coletar de forma automatizada (robôs, scraping) anúncios, fotografias ou dados do site;</li>
          <li>enviar formulários com informações falsas, em nome de terceiros sem autorização ou com conteúdo ofensivo ou ilícito;</li>
          <li>tentar acessar áreas restritas, contornar mecanismos de segurança ou sobrecarregar a infraestrutura do site;</li>
          <li>utilizar o site para fins contrários à lei, à moral ou a estes Termos.</li>
        </ul>
      </Section>

      <Section title="8. Propriedade intelectual">
        <p>A marca Vitória Maison, o logotipo, os textos, o layout e os demais elementos do site pertencem ao {companyInfo.group} ou são utilizados com autorização de seus titulares, inclusive proprietários e fotógrafos dos imóveis. É proibida a reprodução, total ou parcial, sem autorização prévia e por escrito.</p>
      </Section>

      <Section title="9. Links de terceiros">
        <p>O site pode conter links para sites de terceiros. Não nos responsabilizamos pelo conteúdo, pelas políticas ou pelas práticas desses sites, cujo uso está sujeito aos respectivos termos.</p>
      </Section>

      <Section title="10. Disponibilidade e responsabilidade">
        <p>Empregamos esforços razoáveis para manter o site disponível, seguro e com informações corretas, mas não garantimos funcionamento ininterrupto ou livre de erros. O site pode passar por manutenções, atualizações ou interrupções sem aviso prévio.</p>
        <p>Na extensão permitida pela legislação, não nos responsabilizamos por decisões tomadas exclusivamente com base nas informações do site sem confirmação com a nossa equipe, nem por danos decorrentes de indisponibilidade, falhas técnicas ou uso indevido por terceiros.</p>
      </Section>

      <Section title="11. Alterações destes Termos">
        <p>Estes Termos podem ser atualizados periodicamente. A versão vigente estará sempre disponível nesta página, com a data da última atualização. O uso continuado do site após alterações representa concordância com a nova versão.</p>
      </Section>

      <Section title="12. Legislação aplicável">
        <p>Estes Termos são regidos pela legislação brasileira, incluindo o Código de Defesa do Consumidor e a Lei Geral de Proteção de Dados Pessoais. Eventuais controvérsias serão submetidas ao foro do domicílio do consumidor, quando aplicável, ou ao foro da Comarca de São Paulo - SP.</p>
      </Section>

      <Section title="13. Contato">
        <p>Dúvidas sobre estes Termos podem ser enviadas para <a href={`mailto:${companyInfo.email}`} className="text-[#66142e] underline underline-offset-4">{companyInfo.email}</a>, pelos telefones {companyInfo.phones.join(" ou ")} ou pela página de <Link href="/contato" className="text-[#66142e] underline underline-offset-4">contato</Link>.</p>
      </Section>
    </div>
  </div>;
}
