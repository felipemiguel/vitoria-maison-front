import { argument, initializeBackend, runBackend } from "../backend/common";

void runBackend(async () => {
  const code = argument("code");
  if (!code) throw new Error("Informe --code=CODIGO.");
  const { sync } = initializeBackend();
  return sync.syncOne(code);
});
