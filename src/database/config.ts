import { z } from "zod";

const databaseConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const result = databaseConfigSchema.safeParse(env);
  if (!result.success) throw new Error("DATABASE_URL não configurada. Consulte .env.example.");
  return result.data.DATABASE_URL;
}
