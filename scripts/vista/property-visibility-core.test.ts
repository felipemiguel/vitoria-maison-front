import { describe, expect, it } from "vitest";
import { classifyVisibility, classifyVisibilityComparison, compareVisibilityReports, type VisibilityReport, type VisibilityScenario } from "./property-visibility-core";

const scenario = (id: VisibilityScenario["id"], found: boolean | null, httpStatus = 200): VisibilityScenario => ({
  id, label: id, endpoint: id === "DIRECT_DETAILS" || id === "EXPANDED_DETAILS" ? "/imoveis/detalhes" : "/imoveis/listar", httpStatus, found,
  observation: "teste", request: {}, recordsReceived: found ? 1 : 0, total: found ? 1 : 0, receivedFields: [], returnedCodes: [],
});

describe("property visibility diagnostic", () => {
  it("confirma o comportamento da API quando os parâmetros ampliados liberam listagem e detalhes", () => {
    expect(classifyVisibility([
      scenario("CURRENT_LIST", false), scenario("INTERNAL_LIST", true), scenario("SUSPENDED_LIST", false),
      scenario("EXPANDED_LIST", true), scenario("DIRECT_DETAILS", false), scenario("EXPANDED_DETAILS", true),
      scenario("MINIMAL_EXPANDED_LIST", true),
    ])).toMatchObject({ code: "B" });
  });

  it("mantém conclusão inconclusiva quando o imóvel aparece normalmente", () => {
    expect(classifyVisibility([
      scenario("CURRENT_LIST", true), scenario("INTERNAL_LIST", true), scenario("SUSPENDED_LIST", true),
      scenario("EXPANDED_LIST", true), scenario("DIRECT_DETAILS", true), scenario("EXPANDED_DETAILS", true),
      scenario("MINIMAL_EXPANDED_LIST", true),
    ])).toMatchObject({ code: "D" });
  });

  it("compara execuções antes e depois sem depender de payload bruto", () => {
    const report = (found: boolean): VisibilityReport => ({
      schemaVersion: 2, generatedAt: found ? "depois" : "antes", code: "31", readOnly: true,
      applicationInspection: { explicitPublicationFilter: false, productionFilters: [], note: "" },
      scenarios: [scenario("CURRENT_LIST", found), scenario("INTERNAL_LIST", found), scenario("SUSPENDED_LIST", found), scenario("EXPANDED_LIST", found), scenario("DIRECT_DETAILS", true), scenario("EXPANDED_DETAILS", true), scenario("MINIMAL_EXPANDED_LIST", found)],
      evidence: {
        finalidade: { state: "ABSENT" }, valorVenda: { state: "ABSENT" }, valorLocacao: { state: "ABSENT" },
        availability: { state: "NOT_CONFIRMED", note: "" }, publication: { state: "NOT_ACCESSIBLE", note: "" },
      },
      classification: { code: "D", title: "Resultado inconclusivo", justification: "" },
    });
    expect(compareVisibilityReports(report(false), report(true))).toEqual(expect.arrayContaining([
      expect.stringContaining("CURRENT_LIST: encontrado Não → Sim"),
    ]));
    expect(classifyVisibilityComparison(report(false), report(true))).toMatchObject({ code: "B" });
  });
});
