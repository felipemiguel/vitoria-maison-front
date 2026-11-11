export function toggleSelection(current: string[], code: string, maximum = 20): string[] {
  if (current.includes(code)) return current.filter((item) => item !== code);
  return current.length >= maximum ? current : [...current, code];
}

export function togglePageSelection(current: string[], pageCodes: string[], maximum = 20): string[] {
  const uniquePageCodes = [...new Set(pageCodes)];
  if (uniquePageCodes.every((code) => current.includes(code))) return current.filter((code) => !uniquePageCodes.includes(code));
  return [...new Set([...current, ...uniquePageCodes])].slice(0, maximum);
}
