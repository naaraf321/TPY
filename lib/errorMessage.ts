export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const parts = [value.message, value.details, value.hint].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    const code = typeof value.code === 'string' ? ` [${value.code}]` : '';
    if (parts.length) return [...new Set(parts)].join(' — ') + code;
    try { return JSON.stringify(value); } catch { return 'An unknown database error occurred.'; }
  }
  return String(error ?? 'Unknown error');
}
