import { revalidatePath } from "next/cache";

export async function revalidatePublicCatalog(): Promise<void> {
  revalidatePath("/");
  revalidatePath("/imoveis");
  revalidatePath("/comprar");
  revalidatePath("/alugar");
  revalidatePath("/imoveis/[slug]", "page");
  revalidatePath("/colecoes");
  revalidatePath("/colecoes/[slug]", "page");
  revalidatePath("/sitemap.xml");
}
