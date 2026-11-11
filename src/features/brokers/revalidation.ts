import { revalidatePath } from "next/cache";

/** Invalida todas as páginas de sites de corretores (rota interna com o subdomínio no caminho). */
export async function revalidateBrokerSites(): Promise<void> {
  revalidatePath("/broker-site/[subdomain]", "layout");
}
