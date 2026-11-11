export type VistaField = string | Record<string, readonly string[]>;

export type VistaSearch = {
  fields: readonly VistaField[];
  filter?: Record<string, unknown>;
  advFilter?: Record<string, unknown>;
  order?: Record<string, "asc" | "desc">;
  paginacao?: { pagina: number; quantidade: number };
};

export type VistaListOptions = {
  fields: readonly VistaField[];
  page?: number;
  pageSize?: number;
  showTotal?: boolean;
  filter?: Record<string, unknown>;
  advFilter?: Record<string, unknown>;
  order?: Record<string, "asc" | "desc">;
};

export type VistaDetailsOptions = {
  fields: readonly VistaField[];
};

export interface VistaClient {
  listProperties(options: VistaListOptions): Promise<unknown>;
  getPropertyDetails(code: string, options: VistaDetailsOptions): Promise<unknown>;
}

export type VistaLogger = {
  info(event: string, details: Record<string, unknown>): void;
  warn(event: string, details: Record<string, unknown>): void;
  error(event: string, details: Record<string, unknown>): void;
};
