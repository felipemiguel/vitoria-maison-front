"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

export function AdminLoadingScreen({ label = "Carregando…" }: { label?: string }) {
  return <div role="status" aria-live="polite" aria-busy="true" className="fixed inset-0 z-[200] grid place-items-center bg-[#f4f0ec]/55 backdrop-blur-md">
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-[#e4dcd5] bg-white/90 px-14 py-12 shadow-xl">
      <span aria-hidden className="relative block size-20">
        <span className="absolute inset-0 rounded-full border-[6px] border-[#66142e]/15"/>
        <span className="absolute inset-0 animate-spin rounded-full border-[6px] border-transparent border-t-[#66142e] [animation-duration:.8s]"/>
      </span>
      <p className="text-base font-semibold text-[#302724]">{label}</p>
    </div>
  </div>;
}

export function LoadingOverlay({ show, label }: { show: boolean; label?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!show || !mounted) return null;
  return createPortal(<AdminLoadingScreen label={label}/>, document.body);
}
