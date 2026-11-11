import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Com banco de teste, os arquivos rodam em série: os testes de integração compartilham o mesmo PostgreSQL.
  test: { environment: "node", fileParallelism: !process.env.TEST_DATABASE_URL },
});
