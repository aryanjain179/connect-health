/**
 * Small exact tests used for exploratory comparisons. Deterministic; no external dependencies.
 * These p-values are descriptive aids for clinicians, not proof of an effect.
 */

const logFactCache: number[] = [0];

export function logFactorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error(`logFactorial requires a non-negative integer, got ${n}`);
  for (let i = logFactCache.length; i <= n; i++) logFactCache[i] = logFactCache[i - 1] + Math.log(i);
  return logFactCache[n];
}

function logChoose(n: number, k: number): number {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

const REL_TOL = 1 + 1e-7;

/**
 * Two-sided Fisher's exact test for the 2×2 table
 *   [a b]   exposed:   a = with outcome, b = without
 *   [c d]   reference: c = with outcome, d = without
 * Two-sided p = sum of probabilities of tables (same margins) no more likely than the observed one.
 */
export function fisherExactTwoSided(a: number, b: number, c: number, d: number): number {
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  if (n === 0) return 1;
  const logDenom = logChoose(n, c1);
  const prob = (x: number) => Math.exp(logChoose(r1, x) + logChoose(r2, c1 - x) - logDenom);
  const pObs = prob(a);
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  let p = 0;
  for (let x = lo; x <= hi; x++) {
    const px = prob(x);
    if (px <= pObs * REL_TOL) p += px;
  }
  return Math.min(1, p);
}

export function binomialPmf(k: number, n: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/**
 * Two-sided exact binomial test of k successes in n trials against p0.
 * Used as the conditional test for comparing two Poisson event rates: given n total events,
 * events in group A ~ Binomial(n, daysA / (daysA + daysB)) under equal rates.
 */
export function binomialTwoSided(k: number, n: number, p0: number): number {
  if (n === 0) return 1;
  const pObs = binomialPmf(k, n, p0);
  let p = 0;
  for (let i = 0; i <= n; i++) {
    const pi = binomialPmf(i, n, p0);
    if (pi <= pObs * REL_TOL) p += pi;
  }
  return Math.min(1, p);
}

export function safeRatio(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return num / den;
}
