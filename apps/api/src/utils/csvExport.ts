/**
 * Converts an array of flat objects to CSV. Escapes quotes and commas.
 */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) {
    return columns?.join(',') ?? '';
  }

  const keys = columns ?? Object.keys(rows[0] ?? {});
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = keys.join(',');
  const body = rows.map((row) => keys.map((k) => escape(row[k])).join(',')).join('\n');
  return `${header}\n${body}`;
}
