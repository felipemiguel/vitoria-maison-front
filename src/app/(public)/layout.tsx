import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

/** Layout do site institucional. Painel e sites de corretores têm layouts próprios. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><Header/><main>{children}</main><Footer/></>;
}
