import { getDatabase } from "@/database/client";
import { getPublicationPolicyConfig } from "@/features/properties/config";
import { DrizzlePropertyPublicationStore } from "@/features/properties/publication/drizzle-property-publication-store";
import { PropertyPublicationService } from "@/features/properties/publication/property-publication-service";
import { DrizzlePropertySyncStore } from "@/features/properties/sync/drizzle-property-sync-store";
import { PropertySyncService } from "@/features/properties/sync/property-sync-service";
import { HttpVistaClient } from "@/integrations/vista/vista-client";
import { parseVistaConfig } from "@/integrations/vista/vista-config";
import { requireAllPermissions } from "@/features/access/server";
import type { Permission } from "@/features/access/permissions";
import type { SessionUser } from "@/features/access/session-user";
import { AdminCollectionService } from "../collections/admin-collection-service";
import { AdminCurationService } from "../curation/admin-curation-service";
import { revalidatePublicCatalog } from "../revalidation";
import { AdminPropertyService } from "./admin-property-service";
import { BulkPropertyImportService } from "../vista-explorer/bulk-property-import-service";
import { DrizzleBulkImportStore } from "../vista-explorer/drizzle-bulk-import-store";
import { VistaPropertyExplorerService } from "../vista-explorer/vista-property-explorer-service";
import { DrizzleVistaImportStatusStore } from "../vista-explorer/drizzle-vista-import-status-store";

type AdminServices = { property: AdminPropertyService; publication: PropertyPublicationService; sync: PropertySyncService; curation: AdminCurationService; collections: AdminCollectionService; vistaExplorer: VistaPropertyExplorerService; bulkImport: BulkPropertyImportService };
let sharedServices: AdminServices | undefined;

function services(): AdminServices {
  if (sharedServices) return sharedServices;
  const db = getDatabase();
  const policy = getPublicationPolicyConfig();
  const publication = new PropertyPublicationService(new DrizzlePropertyPublicationStore(db), policy, revalidatePublicCatalog);
  const vista = new HttpVistaClient(parseVistaConfig());
  const sync = new PropertySyncService(vista, new DrizzlePropertySyncStore(db), 2, process.env.VISTA_IMAGE_HOSTNAME);
  const property = new AdminPropertyService(db, publication, sync, policy);
  sharedServices = {
    publication, sync,
    property,
    curation: new AdminCurationService(db, policy, revalidatePublicCatalog),
    collections: new AdminCollectionService(db, revalidatePublicCatalog),
    vistaExplorer: new VistaPropertyExplorerService(vista, new DrizzleVistaImportStatusStore(db, policy), process.env.VISTA_IMAGE_HOSTNAME),
    bulkImport: new BulkPropertyImportService(property, new DrizzleBulkImportStore(db), 2),
  };
  return sharedServices;
}

/**
 * Únicos pontos de acesso aos serviços administrativos. A permissão é obrigatória e validada no
 * servidor a cada chamada (perfis lidos do banco); não há acesso implícito por estar logado.
 */
export async function getAuthorizedAdminPropertyService(...permissions: [Permission, ...Permission[]]): Promise<AdminPropertyService> {
  await requireAllPermissions(permissions);
  return services().property;
}

export async function getAuthorizedAdminServices(...permissions: [Permission, ...Permission[]]): Promise<{ admin: SessionUser } & AdminServices> {
  const admin = await requireAllPermissions(permissions);
  return { admin, ...services() };
}
