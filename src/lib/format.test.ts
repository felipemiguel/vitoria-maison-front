import { describe,expect,it } from "vitest";import { formatPrice } from "./format";describe("formatPrice",()=>{it("formata em reais",()=>expect(formatPrice(1200000)).toMatch(/R\$\s*1\.200\.000/))});
