import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { InvalidImageError, PHOTO_MAX_INPUT_BYTES, processProfilePhoto } from "./image-processing";

/** Imagens geradas na hora (fictícias); nenhuma foto real. */
const solid = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: { r: 120, g: 40, b: 60 } } });

describe("processamento da foto profissional", () => {
  it("JPEG com EXIF/GPS: regrava como WebP 960×1200 sem metadados", async () => {
    const input = await solid(1600, 1600).jpeg().withExif({ IFD0: { Make: "CameraFicticia", Model: "X" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 33/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "46/1 38/1 0/1" } }).toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const result = await processProfilePhoto(input);
    expect(result).toMatchObject({ contentType: "image/webp", width: 960, height: 1200 });
    const output = await sharp(result.bytes).metadata();
    expect(output.format).toBe("webp");
    expect(output.exif).toBeUndefined();
    expect(result.bytes.includes(Buffer.from("CameraFicticia"))).toBe(false);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.sizeBytes).toBe(result.bytes.length);
  });

  it("aceita PNG e WebP (validação pelo conteúdo, não pela extensão)", async () => {
    for (const buffer of [await solid(800, 600).png().toBuffer(), await solid(600, 900).webp().toBuffer()]) {
      await expect(processProfilePhoto(buffer)).resolves.toMatchObject({ width: 960, height: 1200 });
    }
  });

  it("recusa arquivos que não são imagem, GIF, SVG e imagens pequenas", async () => {
    await expect(processProfilePhoto(Buffer.from("<?php echo 'não sou imagem'; ?>"))).rejects.toBeInstanceOf(InvalidImageError);
    await expect(processProfilePhoto(await solid(600, 600).gif().toBuffer())).rejects.toThrow(/Formato não aceito/);
    await expect(processProfilePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><script>alert(1)</script></svg>'))).rejects.toThrow(/Formato não aceito|inválido/);
    await expect(processProfilePhoto(await solid(200, 200).jpeg().toBuffer())).rejects.toThrow(/pequena demais/);
    await expect(processProfilePhoto(Buffer.alloc(0))).rejects.toThrow(/Selecione/);
  });

  it("recusa arquivos acima de 5 MB antes de decodificar", async () => {
    await expect(processProfilePhoto(Buffer.alloc(PHOTO_MAX_INPUT_BYTES + 1))).rejects.toThrow(/5 MB/);
  });

  it("corrige a orientação pelo EXIF antes de recortar", async () => {
    const portrait = await solid(1200, 800).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    await expect(processProfilePhoto(portrait)).resolves.toMatchObject({ width: 960, height: 1200 });
  });
});
