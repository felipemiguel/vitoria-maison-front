import { requirePagePermission } from "@/features/access/server";
import { VistaExplorer } from "@/components/admin/vista-explorer";
import { getAuthorizedAdminServices } from "@/features/admin/properties/admin-property-service-factory";
import { enforceAdminVistaRateLimit } from "@/features/admin/auth/admin-operation-rate-limit";
import { parseExplorerFilters } from "@/features/admin/vista-explorer/validation";
import type { VistaExplorerFilters, VistaExplorerPage } from "@/features/admin/vista-explorer/types";
import { publicVistaExplorerError } from "@/features/admin/vista-explorer/public-error";

export const maxDuration = 60;

export default async function VistaExplorerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission("properties:read");
  const raw = await searchParams;
  let filters: VistaExplorerFilters;
  let validationError: string | undefined;
  try { filters = parseExplorerFilters(raw); }
  catch { filters = parseExplorerFilters({}); validationError = "Um ou mais filtros eram inválidos e foram desconsiderados."; }
  let data: VistaExplorerPage = { items: [], total: 0, pages: 0, page: filters.page, pageSize: filters.pageSize };
  let error: string | undefined;
  try {
    const { admin, vistaExplorer } = await getAuthorizedAdminServices("properties:read");
    await enforceAdminVistaRateLimit(admin.id);
    data = await vistaExplorer.list(filters);
  } catch (caught) { error = publicVistaExplorerError(caught); }
  return <div className="mx-auto max-w-[1600px] space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#9b6a2f]">Curadoria visual</p><h2 className="mt-2 font-serif text-3xl text-[#302724]">Explorar imóveis do Vista</h2><p className="mt-2 max-w-3xl text-sm text-[#746c67]">Consulte a base em tempo real, compare fotografias e importe somente os imóveis escolhidos. Nada é publicado automaticamente.</p></div><VistaExplorer data={data} filters={filters} error={error ?? validationError}/></div>;
}
