import { afterEach, describe, expect, it } from "vitest";
import { collectionInputSchema, editorialInputSchema, featuredInputSchema, optionalSafeImageUrl } from "./validation";

const originalHosts=process.env.ADMIN_ALLOWED_IMAGE_HOSTNAMES;
afterEach(()=>{process.env.ADMIN_ALLOWED_IMAGE_HOSTNAMES=originalHosts});
describe("validação da curadoria administrativa",()=>{
  it("aceita somente imagem HTTPS em domínio autorizado",()=>{process.env.ADMIN_ALLOWED_IMAGE_HOSTNAMES="images.example.test";expect(optionalSafeImageUrl("https://images.example.test/cover.jpg")).toContain("cover.jpg");expect(()=>optionalSafeImageUrl("http://images.example.test/cover.jpg")).toThrow(/HTTPS/);expect(()=>optionalSafeImageUrl("https://evil.example/cover.jpg")).toThrow(/autorizado/)});
  it("normaliza campos editoriais vazios sem tocar dados comerciais",()=>{const result=editorialInputSchema.parse({id:"00000000-0000-4000-8000-000000000001",version:0,title:" ",description:" ",purpose:"SALE",coverUrl:""});expect(result).toMatchObject({title:null,description:null,purpose:"SALE",coverUrl:null})});
  it("exige ordem ao marcar destaque",()=>expect(()=>featuredInputSchema.parse({id:"00000000-0000-4000-8000-000000000001",version:0,featured:true,order:null})).toThrow());
  it("valida slug e estado da coleção",()=>expect(collectionInputSchema.parse({name:"Jardins",slug:"jardins-especiais",description:"",coverImageUrl:"",published:true,sortOrder:10})).toMatchObject({slug:"jardins-especiais",published:true}));
});
