export function fmt(n: number | string): string {
  const v = parseFloat(n as string) || 0;
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  if (v > 0 && v < 0.001) return '$' + v.toPrecision(3);
  return '$' + v.toFixed(2);
}

export function fmtD(n: number | string): string {
  const v = Math.round(parseFloat(n as string) || 0);
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toLocaleString();
}
