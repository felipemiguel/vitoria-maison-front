import { initializeBackend, runBackend } from "../backend/common";

void runBackend(async () => {
  const { sync } = initializeBackend();
  return sync.syncAll();
});
