/** Number formatting shared by analysis text and UI. */

export function pct(x: number | null, digits = 1): string {
  if (x === null || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

export function ratio(x: number | null, digits = 2): string {
  if (x === null || !Number.isFinite(x)) return '—';
  return x.toFixed(digits);
}

export function per30(rate: number | null, digits = 1): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  return (rate * 30).toFixed(digits);
}

export function pValue(p: number | null): string {
  if (p === null) return '—';
  if (p < 0.001) return '< 0.001';
  return p.toFixed(3);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function duration(seconds: number | null): string {
  if (seconds === null) return 'not recorded';
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
