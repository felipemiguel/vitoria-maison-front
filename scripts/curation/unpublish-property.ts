import { initializeDatabaseBackend, runBackend } from "../backend/common";
import { requiredCode } from "./arguments";

void runBackend(async () => initializeDatabaseBackend().publication.unpublish(requiredCode()));
