"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type AdminConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function AdminConfirmDialog({open,title,description,confirmLabel,cancelLabel="Cancelar",tone="primary",onConfirm,onCancel}:AdminConfirmDialogProps) {
  const titleId=useId();
  const descriptionId=useId();
  const panelRef=useRef<HTMLDivElement>(null);
  const confirmRef=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    if(!open)return;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    confirmRef.current?.focus();
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();onCancel();return}
      if(event.key!=="Tab")return;
      const focusable=panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if(!focusable?.length)return;
      const first=focusable[0];const last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    document.addEventListener("keydown",handleKeyDown);
    return ()=>{document.removeEventListener("keydown",handleKeyDown);document.body.style.overflow=previousOverflow;previousFocus?.focus()};
  },[open,onCancel]);

  if(!open||typeof document==="undefined")return null;
  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center bg-[#211a18]/65 p-4 backdrop-blur-[2px]" onMouseDown={(event)=>{if(event.target===event.currentTarget)onCancel()}}>
    <div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-md rounded-2xl border border-white/20 bg-[#fffdf9] p-6 text-[#302724] shadow-2xl">
      <div className="flex items-start gap-4"><span className={`grid size-11 shrink-0 place-items-center rounded-full ${tone==="danger"?"bg-red-100 text-red-700":"bg-[#f4e5cc] text-[#8a5a20]"}`}><AlertTriangle size={21}/></span><div className="min-w-0 flex-1"><h2 id={titleId} className="font-serif text-2xl leading-tight">{title}</h2><p id={descriptionId} className="mt-2 text-sm leading-6 text-[#6f6762]">{description}</p></div><button type="button" aria-label="Fechar confirmação" onClick={onCancel} className="-mr-2 -mt-2 grid size-9 shrink-0 place-items-center rounded-full text-[#746c67] outline-none hover:bg-[#eee7e1] focus-visible:ring-2 focus-visible:ring-[#66142e]"><X size={18}/></button></div>
      <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-[#d8ccc3] px-5 text-sm font-semibold outline-none hover:bg-[#f4f0ec] focus-visible:ring-2 focus-visible:ring-[#66142e] focus-visible:ring-offset-2">{cancelLabel}</button><button ref={confirmRef} type="button" onClick={onConfirm} className={`min-h-11 rounded-lg px-5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${tone==="danger"?"bg-red-700 hover:bg-red-800 focus-visible:ring-red-700":"bg-[#66142e] hover:bg-[#541026] focus-visible:ring-[#66142e]"}`}>{confirmLabel}</button></div>
    </div>
  </div>,document.body);
}
