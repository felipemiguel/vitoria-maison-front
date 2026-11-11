import { VISTA_DETAIL_CORE_FIELDS, VISTA_DETAIL_FIELDS, VISTA_DETAIL_MINIMAL_FIELDS, VISTA_DETAIL_PHOTO_FIELDS } from "../../src/integrations/vista/vista-fields";
import { analyzePhotoFields, extractVistaDetail } from "../../src/integrations/vista/vista-response";
import { createVistaClient, readArgument, recordShape, runDiagnostic } from "./common";

void runDiagnostic(async () => {
  const code = readArgument("code");
  if (!code) throw new Error("Informe o código com --code=CODIGO.");
  const mode = readArgument("mode") ?? "core";
  const fieldsByMode = {
    minimal: VISTA_DETAIL_MINIMAL_FIELDS,
    core: VISTA_DETAIL_CORE_FIELDS,
    photos: VISTA_DETAIL_PHOTO_FIELDS,
    full: VISTA_DETAIL_FIELDS,
  } as const;
  if (!(mode in fieldsByMode)) throw new Error("Modo inválido. Use minimal, core, photos ou full.");
  const startedAt = Date.now();
  const response = await createVistaClient().getPropertyDetails(code, { fields: fieldsByMode[mode as keyof typeof fieldsByMode] });
  console.log(JSON.stringify({
    ok: true,
    test: "details",
    mode,
    durationMs: Date.now() - startedAt,
    recordShape: recordShape(extractVistaDetail(response)),
    photos: analyzePhotoFields(response),
  }, null, 2));
});
