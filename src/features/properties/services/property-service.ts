import { cache } from "react";
import { MockPropertyRepository } from "../repositories/mock-property-repository";
import { DatabasePropertyRepository } from "../repositories/database-property-repository";
import { getPropertyDataSource, getPublicationPolicyConfig } from "../config";
import { getDatabase } from "@/database/client";

export const propertyRepository = getPropertyDataSource() === "database"
  ? new DatabasePropertyRepository(getDatabase(), getPublicationPolicyConfig())
  : new MockPropertyRepository();

/**
 * Leituras deduplicadas por requisição (React `cache`): `generateMetadata` e a página
 * compartilham a mesma consulta. Não há cache entre requisições — a elegibilidade depende
 * do horário (expiração de confirmação e idade do snapshot) e precisa ser recalculada.
 */
export const getPublishedPropertyBySlug = cache((slug: string) => propertyRepository.findBySlug(slug));
export const getPropertiesByCollection = cache((collectionSlug: string) => propertyRepository.findByCollection(collectionSlug));
