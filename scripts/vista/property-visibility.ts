import { readFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { z } from "zod";
import { HttpVistaClient } from "../../src/integrations/vista/vista-client";
import { parseVistaConfig } from "../../src/integrations/vista/vista-config";
import { readArgument, runDiagnostic } from "./common";
import { classifyVisibilityComparison, compareVisibilityReports, DiagnosticVistaLogger, formatVisibilityReport, runVisibilityProbe, type VisibilityReport } from "./property-visibility-core";

const codeSchema = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}._-]+$/u, "Código Vista inválido.");

void runDiagnostic(async () => {
  if (process.argv.includes("--help")) {
    console.log("Uso: npm run poc:vista-visibility -- --code=CODIGO [--json] [--compare=ARQUIVO_JSON]");
    return;
  }
  const code = codeSchema.parse(readArgument("code"));
  loadEnvConfig(process.cwd());
  const logger = new DiagnosticVistaLogger();
  const client = new HttpVistaClient(parseVistaConfig(), { logger });
  const report = await runVisibilityProbe(client, logger, code);
  const comparePath = readArgument("compare");
  if (comparePath) {
    const baseline = JSON.parse(await readFile(comparePath, "utf8")) as VisibilityReport;
    if (baseline.schemaVersion !== 2 || baseline.code !== code || !Array.isArray(baseline.scenarios)) {
      throw new Error("Baseline incompatível ou referente a outro código.");
    }
    report.comparison = { baselineGeneratedAt: baseline.generatedAt, differences: compareVisibilityReports(baseline, report) };
    report.classification = classifyVisibilityComparison(baseline, report) ?? report.classification;
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatVisibilityReport(report));
});
