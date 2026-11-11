import { AdminLoadingScreen } from "@/components/admin/loading-overlay";

export default function VistaExplorerLoading() {
  return <><AdminLoadingScreen label="Consultando o Vista…"/><div className="mx-auto max-w-[1600px] animate-pulse space-y-6"><div className="h-9 w-80 rounded bg-[#e4ddd7]"/><div className="h-28 rounded-xl bg-white"/><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({length:8},(_,index)=><div key={index} className="overflow-hidden rounded-xl bg-white"><div className="aspect-[4/3] bg-[#e4ddd7]"/><div className="space-y-3 p-4"><div className="h-4 w-2/3 rounded bg-[#e4ddd7]"/><div className="h-4 w-1/2 rounded bg-[#eee8e3]"/></div></div>)}</div></div></>;
}
