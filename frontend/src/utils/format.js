/** "2026-03-15" → "15/03/2026" */
export function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-03-15" → "15/03" (para eixos de gráfico) */
export function fmtDateShort(s) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}
