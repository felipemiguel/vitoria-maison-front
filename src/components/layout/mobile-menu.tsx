"use client";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";

export function MobileMenu({ links, logo }: { links: [string, string][]; logo: React.ReactNode }){return <Dialog.Root><Dialog.Trigger className="lg:hidden" aria-label="Abrir menu"><Menu/></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/30"/><Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[88%] max-w-sm bg-[#f8f6f2] p-7 text-[#181817]" aria-describedby={undefined}><Dialog.Title className="sr-only">Menu</Dialog.Title><div className="mb-16 flex items-center justify-between">{logo}<Dialog.Close aria-label="Fechar menu"><X/></Dialog.Close></div><nav className="flex flex-col gap-6">{links.map(([label,href])=><Dialog.Close asChild key={href}><Link href={href} className="serif text-4xl">{label}</Link></Dialog.Close>)}<Dialog.Close asChild><Link href="/contato" className="btn mt-5">Fale conosco</Link></Dialog.Close></nav></Dialog.Content></Dialog.Portal></Dialog.Root>}
