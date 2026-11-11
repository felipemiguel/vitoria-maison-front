import { initializeDatabaseBackend, runBackend } from "../backend/common";

void runBackend(async () => {
  const { store } = initializeDatabaseBackend();
  return store.listRuns(20);
});
