import { loadEnvConfig } from "@next/env";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, closeDatabase } from "../../src/database/client";
import { adminUsers, roles, userAuditEvents, userRoles } from "../../src/database/schema";
import { hashAdminPassword } from "../../src/features/admin/auth/password";

const inputSchema = z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().toLowerCase().email().max(320) });
const passwordStdin = process.argv.includes("--password-stdin");

void (async () => {
  loadEnvConfig(process.cwd());
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    const name = process.env.ADMIN_CREATE_NAME ?? await terminal.question("Nome: ");
    const email = process.env.ADMIN_CREATE_EMAIL ?? await terminal.question("E-mail: ");
    terminal.close();
    const password = passwordStdin ? await readPasswordFromStdin() : await readHidden("Senha: ");
    const confirmation = passwordStdin ? password : await readHidden("Confirme a senha: ");
    if (password !== confirmation) throw new Error("As senhas não coincidem.");
    const parsed = inputSchema.parse({ name, email });
    const db = getDatabase();
    const existing = (await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, parsed.email)).limit(1))[0];
    if (existing) throw new Error("Já existe um usuário com este e-mail.");
    const passwordHash = await hashAdminPassword(password);
    // Usuário e perfil ADMIN na mesma transação: nunca existe administrador sem perfil.
    const created = await db.transaction(async (tx) => {
      const adminRole = (await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, "ADMIN")).limit(1))[0];
      if (!adminRole) throw new Error("Perfil ADMIN não encontrado. Execute npm run db:migrate.");
      const user = (await tx.insert(adminUsers).values({ ...parsed, passwordHash, active: true, invitationAcceptedAt: new Date() }).returning({ id: adminUsers.id, email: adminUsers.email }))[0];
      await tx.insert(userRoles).values({ userId: user.id, roleId: adminRole.id });
      await tx.insert(userAuditEvents).values({ actorUserId: null, targetUserId: user.id, action: "USER_CREATED", metadata: { roles: ["ADMIN"], active: true, source: "CLI" } });
      return user;
    });
    stdout.write(`Administrador criado: ${created.email}\n`);
  } catch (error) {
    terminal.close();
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Falha ao criar administrador.";
    process.stderr.write(`${message}\n`); process.exitCode = 1;
  } finally { await closeDatabase(); }
})();

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error("Terminal seguro indisponível. Use --password-stdin com um secret manager.");
  stdout.write(prompt); stdin.setRawMode(true); stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      const input = chunk.toString("utf8");
      if (input === "\u0003") { cleanup(); reject(new Error("Operação cancelada.")); return; }
      if (input === "\r" || input === "\n") { cleanup(); stdout.write("\n"); resolve(value); return; }
      if (input === "\u007f") { value = value.slice(0,-1); return; }
      if (/^[\x20-\x7E]+$/.test(input)) value += input;
    };
    const cleanup = () => { stdin.off("data", onData); stdin.setRawMode(false); stdin.pause(); };
    stdin.on("data", onData);
  });
}

async function readPasswordFromStdin(): Promise<string> {
  if (stdin.isTTY) throw new Error("--password-stdin exige entrada redirecionada por um secret manager.");
  let value = ""; for await (const chunk of stdin) value += chunk.toString();
  return value.replace(/[\r\n]+$/, "");
}
