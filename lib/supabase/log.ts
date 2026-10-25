// A failed query must never look like "no results": log it on the server so
// an empty page can be traced (e.g. an ambiguous embed, PGRST201).
export function logQueryError(where: string, error: { code?: string; message: string } | null | undefined) {
  if (error) console.error(`[${where}] query failed${error.code ? ` (${error.code})` : ""}: ${error.message}`);
}
