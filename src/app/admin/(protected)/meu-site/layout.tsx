import { requirePagePermission } from "@/features/access/server";
import { getBrokerSitesConfig } from "@/features/brokers/config";
import { loadMySite } from "@/features/brokers/my-site";
import { MySiteNav } from "@/components/admin/brokers/my-site-nav";

/** Área do corretor: perfil BROKER (inclusive MANAGER + BROKER). Cada página e ação revalida no servidor. */
export default async function MySiteLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePagePermission("broker-site:read-own");
  const { site } = await loadMySite(user);
  return <div className="mx-auto max-w-6xl space-y-6">
    <div><h2 className="text-2xl font-semibold">Meu site</h2><p className="mt-1 text-sm text-[#746c67]">Configure seu perfil, sua página e os imóveis da Maison que você quer apresentar.</p></div>
    {!getBrokerSitesConfig().enabled && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Os sites públicos de corretores ainda não estão ativos neste ambiente. Você já pode preparar tudo e usar a prévia.</p>}
    <MySiteNav hasSite={Boolean(site)}/>
    {children}
  </div>;
}
