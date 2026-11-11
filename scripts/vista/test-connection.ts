import { VISTA_CONNECTION_FIELDS } from "../../src/integrations/vista/vista-fields";
import { extractVistaRecords } from "../../src/integrations/vista/vista-response";
import { createVistaClient, runDiagnostic } from "./common";

void runDiagnostic(async () => {
  const startedAt = Date.now();
  const response = await createVistaClient().listProperties({ fields: VISTA_CONNECTION_FIELDS, page: 1, pageSize: 1 });
  console.log(JSON.stringify({ ok: true, test: "connection", durationMs: Date.now() - startedAt, recordsReceived: extractVistaRecords(response).length }, null, 2));
});
