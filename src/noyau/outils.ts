// Petits outils numériques partagés par tous les modules
// ---------------------------------------------------------------- utils
export function rng(seed: number): () => number { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); // octets sRGB, pour les textures dessinées sur canvas
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const dist2 = (p: number[], q: number[]) => Math.hypot(q[0] - p[0], q[1] - p[1]);
export const lerp2 = (p: number[], q: number[], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
