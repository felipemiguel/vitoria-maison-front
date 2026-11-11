"use client";

import { useActionState } from "react";
import { LoadingOverlay } from "@/components/admin/loading-overlay";
import { AdminActionFeedback } from "@/components/admin/admin-action-feedback";
import { createUserAction, updateUserAction, type UserFormState } from "@/app/admin/(protected)/usuarios/actions";
import { ROLE_CODES, ROLE_LABELS, type RoleCode } from "@/features/access/permissions";

const ROLE_HELP: Record<RoleCode, string> = {
  ADMIN: "Acesso completo, incluindo usuários e permissões.",
  MANAGER: "Imóveis, importação, publicação, sincronização, coleções e leads.",
  BROKER: "Área pessoal. Base para o futuro site do corretor.",
};

type Props = {
  mode: "create" | "edit";
  user?: { id: string; version: number; name: string; email: string; active: boolean; roles: RoleCode[] };
  canEditProfile: boolean;
  canAssignRoles: boolean;
  canToggleActive: boolean;
  isSelf?: boolean;
};

const initial: UserFormState = {};

export function UserForm({ mode, user, canEditProfile, canAssignRoles, canToggleActive, isSelf = false }: Props) {
  const [state, action, pending] = useActionState(mode === "create" ? createUserAction : updateUserAction, initial);
  const input = "mt-2 w-full rounded-lg border border-[#d8ccc3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#66142e] focus:ring-2 focus:ring-[#66142e]/10 disabled:bg-[#f4f0ec] disabled:text-[#8b817b]";
  return <form action={action} className="space-y-6 rounded-xl border border-[#ded5cd] bg-white p-5 sm:p-6">
    <LoadingOverlay show={pending} label={mode === "create" ? "Criando usuário…" : "Salvando alterações…"}/>
    {user && <><input type="hidden" name="id" value={user.id}/><input type="hidden" name="version" value={user.version}/></>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Nome<input name="name" required minLength={2} maxLength={160} defaultValue={user?.name} readOnly={!canEditProfile} className={input}/></label>
      <label className="text-sm font-medium">E-mail<input name="email" type="email" required maxLength={320} defaultValue={user?.email} readOnly={!canEditProfile} autoComplete="off" className={input}/>
        {mode === "edit" && <span className="mt-1 block text-xs font-normal text-[#817872]">Alterar o e-mail encerra as sessões abertas e invalida links pendentes.</span>}</label>
    </div>
    <fieldset>
      <legend className="text-sm font-medium">Perfis</legend>
      <p className="mt-1 text-xs text-[#817872]">Um usuário pode acumular perfis. As permissões são a soma dos perfis atribuídos.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{ROLE_CODES.map((role) => {
        const lockedSelfAdmin = isSelf && role === "ADMIN" && user?.roles.includes("ADMIN");
        const disabled = !canAssignRoles || lockedSelfAdmin;
        const checked = user?.roles.includes(role) ?? false;
        return <label key={role} className="flex gap-3 rounded-lg border border-[#e4dcd5] p-3 text-sm has-[:checked]:border-[#66142e] has-[:checked]:bg-[#fbf7f4]">
          <input type="checkbox" name="roles" value={role} defaultChecked={checked} disabled={disabled} className="mt-0.5 accent-[#66142e]"/>
          {disabled && checked && <input type="hidden" name="roles" value={role}/>}
          <span><span className="block font-medium">{ROLE_LABELS[role]}</span><span className="mt-0.5 block text-xs text-[#817872]">{lockedSelfAdmin ? "Você não pode remover o próprio perfil de administrador." : ROLE_HELP[role]}</span></span>
        </label>;
      })}</div>
    </fieldset>
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name="active" defaultChecked={user?.active ?? true} disabled={!canToggleActive || isSelf} className="mt-0.5 accent-[#66142e]"/>
      {(!canToggleActive || isSelf) && (user?.active ?? true) && <input type="hidden" name="active" value="on"/>}
      <span><span className="block font-medium">Acesso ativo</span><span className="block text-xs text-[#817872]">{isSelf ? "Você não pode desativar o próprio acesso." : mode === "create" ? "Contas ativas recebem convite por e-mail para definir a senha." : "Desativar encerra imediatamente as sessões e invalida convites pendentes."}</span></span>
    </label>
    <AdminActionFeedback state={state}/>
    <button disabled={pending} className="rounded-lg bg-[#66142e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{mode === "create" ? "Criar usuário e enviar convite" : "Salvar alterações"}</button>
  </form>;
}
