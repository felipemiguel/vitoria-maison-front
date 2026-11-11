import { z } from "zod";
import { argument } from "../backend/common";

const codeSchema = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}._-]+$/u, "Código Vista inválido.");
const operatorSchema = z.string().trim().min(2).max(160);

export function requiredCode(): string {
  return codeSchema.parse(argument("code"));
}

export function requiredOperator(): string {
  return operatorSchema.parse(argument("operator"));
}
