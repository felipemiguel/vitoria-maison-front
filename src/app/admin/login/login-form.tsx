"use client";
import { LoadingOverlay } from "@/components/admin/loading-overlay";

import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [show, setShow] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false });
      if (result?.error) { setError("E-mail ou senha inválidos."); return; }
      router.replace("/admin"); router.refresh();
    } catch { setError("Não foi possível entrar. Tente novamente em instantes."); }
    finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="mt-8 space-y-5"><LoadingOverlay show={loading} label="Entrando…"/>
    <label className="block text-sm font-medium text-[#443a35]">E-mail<input name="email" type="email" autoComplete="email" required className="mt-2 h-12 w-full rounded-lg border border-[#d8ccc3] bg-white px-4 outline-none focus:border-[#66142e]"/></label>
    <label className="block text-sm font-medium text-[#443a35]">Senha<span className="relative mt-2 block"><input name="password" type={show?"text":"password"} autoComplete="current-password" required className="h-12 w-full rounded-lg border border-[#d8ccc3] bg-white px-4 pr-12 outline-none focus:border-[#66142e]"/><button type="button" onClick={()=>setShow(!show)} aria-label={show?"Ocultar senha":"Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#746c67]">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
    {error&&<p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#66142e] px-5 text-sm font-semibold text-white disabled:opacity-60">{loading&&<Loader2 className="animate-spin" size={17}/>} Entrar</button>
  </form>;
}
