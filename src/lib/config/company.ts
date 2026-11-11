/** Dados públicos da imobiliária responsável, fornecidos pela empresa. */
export const companyInfo = {
  group: "Grupo Vitória Flats",
  creci: "38157-J",
  phones: ["(11) 3085-1381", "(11) 3382-7077"],
  email: "atendimento@vitoriaflats.com.br",
  address: { street: "Alameda Santos, 1.165, Sala 11", neighborhood: "Cerqueira César", city: "São Paulo", state: "SP", postalCode: "01419-002" },
} as const;

export function phoneHref(phone: string): string { return `tel:+55${phone.replace(/\D/g, "")}`; }
