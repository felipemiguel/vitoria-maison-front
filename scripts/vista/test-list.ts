import { VISTA_LIST_FIELDS } from "../../src/integrations/vista/vista-fields";
import { extractVistaRecords } from "../../src/integrations/vista/vista-response";
import { createVistaClient, recordShape, runDiagnostic } from "./common";

void runDiagnostic(async () => {
  const startedAt = Date.now();
  const response = await createVistaClient().listProperties({ fields: VISTA_LIST_FIELDS, page: 1, pageSize: 5, showTotal: true });
  const records = extractVistaRecords(response);
  console.log(JSON.stringify({
    ok: true,
    test: "list",
    durationMs: Date.now() - startedAt,
    recordsReceived: records.length,
    firstCode: records[0]?.Codigo ?? null,
    firstRecordShape: recordShape(records[0] ?? null),
  }, null, 2));
});
