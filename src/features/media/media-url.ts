/** Caminho público de uma mídia armazenada no banco (servida por app/media/[id]/route.ts). */
export function mediaPath(id: string): string { return `/media/${id}`; }
export function isMediaPath(value: string | null | undefined): value is string { return typeof value === "string" && /^\/media\/[0-9a-f-]{36}$/i.test(value); }
