// Cells starting with these run as formulas in Excel, so a reason like "=HYPERLINK(...)" must stay text.
const FORMULA_START = /^[=+\-@\t\r]/;

const escapeCell = (value: string | number) => {
  const text = String(value);
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const toCsv = (rows: readonly (readonly (string | number)[])[]) => rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');

export const downloadCsv = (filename: string, rows: readonly (readonly (string | number)[])[]) => {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
};
