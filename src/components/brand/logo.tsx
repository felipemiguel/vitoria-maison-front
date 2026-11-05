import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return <Image
    src="/images/brand/vitoria-maison-logo-horizontal.png"
    alt="Vitória Maison"
    width={2172}
    height={724}
    priority={priority}
    className={cn("h-auto object-contain", className)}
  />;
}
