import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getBrokerSitesConfig } from "@/features/brokers/config";
import { routeRequest } from "@/features/brokers/routing";

type ProxyHandler = (request: NextRequest, event: NextFetchEvent) => Promise<Response | undefined> | Response | undefined;
const authProxy = auth as unknown as ProxyHandler;

/**
 * 1. Sites de corretores: resolve o subdomínio pelo cabeçalho Host e reescreve para a rota interna.
 *    O caminho interno direto e o painel/APIs em hosts de corretores respondem 404.
 * 2. Painel: mantém a integração do Auth.js (que não é a barreira de acesso; páginas e actions validam permissões).
 */
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const decision = routeRequest(request.headers.get("host"), request.nextUrl.pathname, getBrokerSitesConfig());
  if (decision.type === "notFound") return new NextResponse("Not Found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow", "Content-Type": "text/plain; charset=utf-8" } });
  if (decision.type === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    const response = NextResponse.rewrite(url);
    response.headers.set("Vary", "Host");
    // Indexação decidida por página (metadata), conforme o status do site e a política de SEO.
    return response;
  }
  if (request.nextUrl.pathname.startsWith("/admin")) return authProxy(request, event);
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
