import { initializeDatabaseBackend, runBackend } from "../backend/common";
import { requiredCode, requiredOperator } from "./arguments";

void runBackend(async () => initializeDatabaseBackend().publication.confirmAvailability(requiredCode(), requiredOperator()));
