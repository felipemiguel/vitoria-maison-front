import { createHash } from "node:crypto";
import sharp from "sharp";

export const PHOTO_MAX_INPUT_BYTES = 5 * 1024 * 1024;
export const PHOTO_OUTPUT = { width: 960, height: 1200, quality: 82 } as const;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);
/** Limite de pixels decodificados (defesa contra "bombas" de descompressão). */
const MAX_INPUT_PIXELS = 50_000_000;

export class InvalidImageError extends Error { constructor(message: string) { super(message); this.name = "InvalidImageError"; } }

export type ProcessedImage = { bytes: Buffer; contentType: "image/webp"; width: number; height: number; sizeBytes: number; sha256: string };

/**
 * Foto profissional: valida pelo CONTEÚDO (não pela extensão ou tipo declarado), corrige a
 * orientação, recorta em 4:5 com foco no assunto, reduz para 960×1200 e regrava como WebP.
 * Metadados (EXIF, GPS, ICC de terceiros) são descartados na regravação.
 */
export async function processProfilePhoto(input: Buffer): Promise<ProcessedImage> {
  return processImage(input, PHOTO_OUTPUT);
}

/** Imagem de apresentação do site: mesmo tratamento, formato vertical maior (4:5, 1200×1500). */
export const PRESENTATION_OUTPUT = { width: 1200, height: 1500, quality: 82, minSide: 600 } as const;
export async function processPresentationImage(input: Buffer): Promise<ProcessedImage> {
  return processImage(input, PRESENTATION_OUTPUT);
}

async function processImage(input: Buffer, output: { width: number; height: number; quality: number; minSide?: number }): Promise<ProcessedImage> {
  const minSide = output.minSide ?? 400;
  if (!input.length) throw new InvalidImageError("Selecione uma imagem.");
  if (input.length > PHOTO_MAX_INPUT_BYTES) throw new InvalidImageError("A imagem deve ter no máximo 5 MB.");
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try { metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata(); }
  catch { throw new InvalidImageError("Arquivo inválido. Envie uma imagem JPEG, PNG ou WebP."); }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) throw new InvalidImageError("Formato não aceito. Envie uma imagem JPEG, PNG ou WebP.");
  if ((metadata.pages ?? 1) > 1) throw new InvalidImageError("Imagens animadas não são aceitas.");
  if (!metadata.width || !metadata.height || metadata.width < minSide || metadata.height < minSide) throw new InvalidImageError(`A imagem é pequena demais. Use pelo menos ${minSide} × ${minSide} pixels.`);
  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize(output.width, output.height, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: output.quality })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, contentType: "image/webp", width: info.width, height: info.height, sizeBytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
  } catch { throw new InvalidImageError("Não foi possível processar esta imagem. Tente outro arquivo."); }
}
