const protectCell = value => {
  const text = value == null ? '' : String(value);
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function downloadFinanceCsv(filename, headers, rows) {
  const content = [headers, ...rows].map(row => row.map(protectCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printFinanceReport(setPrinting) {
  setPrinting(true);
  window.setTimeout(() => window.print(), 120);
}
