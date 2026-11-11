import { requirePagePermission } from "@/features/access/server";
import { PropertyImportForm } from "@/components/admin/property-import-form";

export const metadata = { title: "Importar imóvel" };
export default async function NewAdminPropertyPage(){await requirePagePermission("properties:import");return <div className="mx-auto max-w-5xl"><h2 className="text-2xl font-semibold">Importar imóvel</h2><p className="mt-2 text-sm text-[#746c67]">Consulte um código no Vista e confirme a inclusão na curadoria.</p><div className="mt-6"><PropertyImportForm/></div></div>}
