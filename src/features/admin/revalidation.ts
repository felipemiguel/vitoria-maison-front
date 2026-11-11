import { revalidatePath } from "next/cache";
import { revalidateBrokerSites } from "@/features/brokers/revalidation";

export async function revalidatePublicCatalog(): Promise<void> {
  revalidatePath("/");
  revalidatePath("/imoveis");
  revalidatePath("/comprar");
  revalidatePath("/alugar");
  revalidatePath("/imoveis/[slug]", "page");
  revalidatePath("/colecoes");
  revalidatePath("/colecoes/[slug]", "page");
  revalidatePath("/sitemap.xml");
  // Imóveis publicados/despublicados também mudam o que aparece nos sites dos corretores.
  await revalidateBrokerSites();
}
