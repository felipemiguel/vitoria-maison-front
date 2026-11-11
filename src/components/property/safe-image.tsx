"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * next/image com tratamento de falha: se a fotografia remota não carregar, a imagem é
 * removida e o fundo neutro do contêiner (com proporção fixa) permanece, sem layout shift.
 */
export function SafeImage(props: ImageProps) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  if (failedSrc === props.src) return <span role="img" aria-label={props.alt} className="absolute inset-0 grid place-items-center text-[10px] uppercase tracking-[.15em] text-[#69635f]">Fotografia indisponível</span>;
  // Mídia do banco já chega tratada (WebP no tamanho final): entregue sem o otimizador.
  // eslint-disable-next-line jsx-a11y/alt-text -- alt é repassado em props
  return <Image {...props} unoptimized={props.unoptimized ?? (typeof props.src === "string" && props.src.startsWith("/media/"))} onError={() => setFailedSrc(props.src)}/>;
}
