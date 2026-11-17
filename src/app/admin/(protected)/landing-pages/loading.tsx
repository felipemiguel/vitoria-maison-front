import { AdminLoadingScreen } from "@/components/admin/loading-overlay";

/**
 * Limite de carregamento desta seção: sem ele, navegar entre páginas da mesma seção
 * (ex.: lista → detalhe) mantinha a página antiga na tela sem nenhum indicador.
 */
export default function SectionLoading() { return <AdminLoadingScreen/>; }
