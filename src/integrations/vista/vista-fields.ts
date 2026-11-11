import type { VistaField } from "./vista-types";

// Confirmados na documentação pública oficial consultada em 06/11/2026.
export const VISTA_LIST_FIELDS = [
  "Codigo",
  "Categoria",
  "Cidade",
  "Bairro",
  "ValorVenda",
  "ValorLocacao",
  "Dormitorios",
  "Suites",
  "Vagas",
  "AreaTotal",
  "AreaPrivativa",
  "Caracteristicas",
  "InfraEstrutura",
  "FotoDestaque",
] as const satisfies readonly VistaField[];

export const VISTA_CONNECTION_FIELDS = ["Codigo"] as const satisfies readonly VistaField[];

export const VISTA_DETAIL_MINIMAL_FIELDS = ["Codigo"] as const satisfies readonly VistaField[];

export const VISTA_DETAIL_CORE_FIELDS = [
  ...VISTA_LIST_FIELDS,
  "TituloSite",
  "DescricaoWeb",
  "Finalidade",
  "DataAtualizacao",
] as const satisfies readonly VistaField[];

export const VISTA_DETAIL_PHOTO_FIELDS = [
  "Codigo",
  "FotoDestaque",
] as const satisfies readonly VistaField[];

export const VISTA_DETAIL_FIELDS = VISTA_DETAIL_CORE_FIELDS;

export const VISTA_CONFIRMED_FIELD_NAMES = [
  "Codigo", "Categoria", "Cidade", "Bairro", "ValorVenda", "ValorLocacao",
  "Dormitorios", "Suites", "Vagas", "AreaTotal", "AreaPrivativa",
  "Caracteristicas", "InfraEstrutura", "FotoDestaque",
  "TituloSite", "DescricaoWeb",
  "Finalidade", "DataAtualizacao",
] as const;
