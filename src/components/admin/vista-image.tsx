"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export function VistaImage({ src, alt, sizes, priority = false }: { src: string | null; alt: string; sizes: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="grid size-full place-items-center bg-[#e9e4df] text-[#817872]"><div className="text-center"><ImageOff className="mx-auto mb-2" size={25}/><span className="text-xs font-medium">Sem fotografia</span></div></div>;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" onError={()=>setFailed(true)}/>;
}
