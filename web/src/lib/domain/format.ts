export function percent(p: number) {
  return `${Math.round(p * 100)}%`;
}

/** "85% (72–93%)" */
export function percentWithBand(p: number, lo: number, hi: number) {
  return `${percent(p)} (${Math.round(lo * 100)}–${Math.round(hi * 100)}%)`;
}

export function kgPerHaNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function kgPerHa(value: number) {
  return `${kgPerHaNumber(value)} kg/ha`;
}

export const SOIL_LABELS = { 1: "Sandy", 2: "Medium", 3: "Clayey" } as const;
export const REGIME_LABELS = { rainfed: "Rainfed", irrigated: "Irrigated" } as const;
export const CONFIDENCE_LABELS = { high: "High", medium: "Medium", low: "Low" } as const;
