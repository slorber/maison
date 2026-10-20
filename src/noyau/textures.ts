// Textures dessinées sur canvas (enduits, sols, toiture, végétation…) et finitions de sol au choix
import * as THREE from 'three';
import { rng, hex, clamp } from './outils';
import { EUR } from '../maison/plan';
import type { Textures } from '../types';
// RAL 7016 gris anthracite : valeur nominale #383E42, affichée un peu plus claire pour compenser la courbe de rendu et rendre la teinte
// telle qu'on la voit en vrai (calée sur les photos de Sébastien) ; peinture thermolaquée satinée, non métallique
export const RAL7016 = '#4d5459';

export const MAX_ANISO = { v: 8 };
export function makeTex(size: number, meters: number, draw: (g: CanvasRenderingContext2D, size: number, w: number, h: number) => void,
  opts: { w?: number; h?: number; metersV?: number; srgb?: boolean } = {}) {
  const c = document.createElement('canvas'); c.width = opts.w || size; c.height = opts.h || size;
  const g = c.getContext('2d'); draw(g, size, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / meters, 1 / (opts.metersV || meters));
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO.v;
  return t;
}
function lowNoise(n, r) { const a = []; for (let i = 0; i < n * n; i++) a.push(r() * 2 - 1); return (u, v) => { const x = u * n, y = v * n; const x0 = Math.floor(x), y0 = Math.floor(y); const fx = x - x0, fy = y - y0; const s = (i, j) => a[((j % n + n) % n) * n + ((i % n + n) % n)]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (s(x0, y0) * (1 - sx) + s(x0 + 1, y0) * sx) * (1 - sy) + (s(x0, y0 + 1) * (1 - sx) + s(x0 + 1, y0 + 1) * sx) * sy; }; }
export function pixelNoise(g: CanvasRenderingContext2D, size: number, base: string, amp: number, lowAmp: number, lowN: number, seed: number,
  extra?: (f: number, r: () => number, u: number, v: number) => number) {
  const r = rng(seed); const ln = lowNoise(lowN, r); const ln2 = lowNoise(lowN * 4, r);
  const img = g.createImageData(size, size); const d = img.data; const [br, bg, bb] = hex(base);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let f = 1 + lowAmp * ln(u, v) + lowAmp * 0.5 * ln2(u, v) + amp * (r() * 2 - 1);
    if (extra) f = extra(f, r, u, v);
    const i = (y * size + x) * 4; d[i] = clamp(br * f, 0, 255); d[i + 1] = clamp(bg * f, 0, 255); d[i + 2] = clamp(bb * f, 0, 255); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- textures
export const TEX: Textures = {};
export function buildTextures() {
  // Enduit monocouche gratté fin, ton pierre PRB 015 ; modénatures lissées à l'éponge, ton 015 éclairci (photo Castelord fournie)
  TEX.enduit = makeTex(512, 0.8, (g, s) => pixelNoise(g, s, '#e3dac8', 0.055, 0.012, 6, 11, (f, r) => r() < 0.03 ? f * 0.93 : (r() < 0.03 ? f * 1.035 : f)));
  TEX.lisse = makeTex(512, 1.2, (g, s) => pixelNoise(g, s, '#ede8de', 0.008, 0.022, 28, 12));
  TEX.paint = makeTex(256, 2, (g, s) => pixelNoise(g, s, '#f2f0eb', 0.012, 0.01, 4, 13));
  TEX.roof = makeTex(512, 1, (g, s) => {
    const r = rng(21); g.fillStyle = '#2b2c2f'; g.fillRect(0, 0, s, s);
    const rows = 3, cols = 3, th = s / rows, tw = s / cols;
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * tw / 2;
      for (let i = -1; i <= cols; i++) {
        const x = i * tw + off, y = j * th; const l = 60 + r() * 14;
        const grd = g.createLinearGradient(0, y, 0, y + th);
        grd.addColorStop(0, `rgb(${l * 0.82},${l * 0.84},${l * 0.9})`); grd.addColorStop(0.85, `rgb(${l},${l * 1.02},${l * 1.08})`); grd.addColorStop(1, `rgb(${l * 0.55},${l * 0.56},${l * 0.6})`);
        g.fillStyle = grd; g.fillRect(x + 2, y + 1, tw - 4, th - 3);
      }
    }
    const img = g.getImageData(0, 0, s, s); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
  });
  TEX.grass = makeTex(512, 2.5, (g, s) => {
    pixelNoise(g, s, '#7b8c5a', 0.10, 0.10, 5, 31);
    const r = rng(32);
    for (let i = 0; i < 9000; i++) { const x = r() * s, y = r() * s, l = r(); g.strokeStyle = l < 0.5 ? `rgba(${70 + r() * 40},${110 + r() * 40},${40 + r() * 20},0.55)` : `rgba(${40 + r() * 30},${70 + r() * 30},${25},0.45)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4); g.stroke(); }
  });
  TEX.gravel = makeTex(512, 1, (g, s) => {
    g.fillStyle = '#b9ae9a'; g.fillRect(0, 0, s, s); const r = rng(41);
    for (let i = 0; i < 6000; i++) { const x = r() * s, y = r() * s, rad = 1.5 + r() * 3.5, l = 150 + r() * 80; g.fillStyle = 'rgba(60,50,40,0.35)'; g.beginPath(); g.ellipse(x + 1, y + 1.2, rad, rad * 0.8, r() * 3, 0, 7); g.fill(); g.fillStyle = `rgb(${l},${l * 0.95},${l * 0.86})`; g.beginPath(); g.ellipse(x, y, rad, rad * 0.8, r() * 3, 0, 7); g.fill(); }
  });
  TEX.asphalt = makeTex(512, 3, (g, s) => pixelNoise(g, s, '#6f7173', 0.12, 0.06, 6, 51, (f, r) => r() < 0.02 ? f * 1.5 : f));
  TEX.curb = makeTex(512, 2, (g, s) => { pixelNoise(g, s, '#b3afa7', 0.06, 0.05, 5, 61); g.strokeStyle = 'rgba(70,65,60,0.30)'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); });
  // tissu tissé gris clair (canapé)
  TEX.sofa = makeTex(256, 0.12, (g, s) => pixelNoise(g, s, '#c4c3bf', 0.07, 0.03, 5, 91, (f, r, u, v) => f * (((Math.floor(u * 64) + Math.floor(v * 64)) & 1) ? 0.95 : 1.04)));
  // dalles de terrasse 60 × 60 grès cérame gris clair (indicatif), joints fins
  TEX.terrace = makeTex(512, 1.2, (g, s) => pixelNoise(g, s, '#cfccc5', 0.04, 0.04, 6, 133, (f, r, u, v) => ((u * 2) % 1 < 0.006 || (v * 2) % 1 < 0.006) ? f * 0.78 : f));
  // marches en chêne massif clair (lamellé-collé, lames de 7 cm, vernis mat) : fil le long de la marche (axe Z de la volée)
  TEX.stairTile = makeTex(512, 1.12, (g, s) => {
    const r = rng(73), lw = s / 16; g.fillStyle = '#d9c4a0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) {
      const t = (r() - 0.5) * 0.10; g.fillStyle = `rgba(${t > 0 ? '255,244,222' : '150,112,70'},${Math.abs(t) * 2.2})`; g.fillRect(i * lw, 0, lw, s);
      for (let k = 0; k < 9; k++) { // fil du bois, légèrement ondulé
        const x0 = i * lw + r() * lw, a = 0.6 + r() * 1.4, ph = r() * 6.28; g.strokeStyle = `rgba(140,100,60,${0.06 + r() * 0.10})`; g.lineWidth = 0.6 + r() * 1.1; g.beginPath();
        for (let y = 0; y <= s; y += 8) { const x = Math.min(i * lw + lw - 0.5, Math.max(i * lw + 0.5, x0 + a * Math.sin(y / s * 6.28 * 2 + ph))); y ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      g.fillStyle = 'rgba(120,90,55,0.18)'; g.fillRect(i * lw, 0, 1, s); // joint de lamelle
    }
  });
  TEX.concrete = makeTex(512, 2, (g, s) => pixelNoise(g, s, '#a8a49d', 0.05, 0.08, 6, 71, (f, r) => r() < 0.01 ? f * 0.8 : f));
  TEX.mulch = makeTex(512, 1.5, (g, s) => {
    pixelNoise(g, s, '#4e3b2a', 0.15, 0.1, 6, 81); const r = rng(82);
    for (let i = 0; i < 2600; i++) { const l = 0.6 + r() * 0.7; g.fillStyle = `rgb(${120 * l},${88 * l},${60 * l})`; g.beginPath(); g.ellipse(r() * s, r() * s, 2 + r() * 7, 1 + r() * 2.5, r() * 3, 0, 7); g.fill(); }
  });
  // faïence blanche 30×60 posée horizontalement
  TEX.faience = makeTex(512, 0.6, (g, s) => {
    g.fillStyle = '#c9c9c6'; g.fillRect(0, 0, s, s); const r = rng(91); const th = s / 2, j = 3;
    for (let row = 0; row < 2; row++) { const l = 240 + r() * 8; g.fillStyle = `rgb(${l},${l},${l - 2})`; g.fillRect(j, row * th + j, s - 2 * j, th - 2 * j); }
  });
  TEX.slats = makeTex(256, 0.5, (g, s) => { g.fillStyle = RAL7016; g.fillRect(0, 0, s, s); for (let i = 0; i < 12; i++) { const y = i * s / 12; g.fillStyle = '#3f464b'; g.fillRect(0, y, s, 3); g.fillStyle = '#5b6368'; g.fillRect(0, y + 3, s, 2); } });
  TEX.mesh = makeTex(128, 0.1, (g, s) => { g.clearRect(0, 0, s, s); g.strokeStyle = '#2f4a32'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke(); });
  // aluminium 7016 sablé (texturé) de la porte Bel'M
  TEX.sable = makeTex(256, 0.25, (g, s) => pixelNoise(g, s, RAL7016, 0.08, 0.02, 4, 141));
  TEX.hedge = makeTex(256, 0.8, (g, s) => {
    pixelNoise(g, s, '#3f5a2f', 0.25, 0.15, 6, 151); const r = rng(152);
    for (let i = 0; i < 1600; i++) { const l = r(); g.fillStyle = l < 0.5 ? `rgba(${90 + r() * 40},${120 + r() * 40},${50},0.6)` : `rgba(${20},${35 + r() * 20},${15},0.55)`; g.beginPath(); g.ellipse(r() * s, r() * s, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, 7); g.fill(); }
  });
  // vitrage sablé de la porte Eurielle (d'après la photo Bel'M) : demi-lune côté serrure, filets sérigraphiés noirs
  {
    const { w, h, r, o } = EUR, k = 200 / w, W = 200, Hc = Math.round(h * k);
    TEX.eurielle = makeTex(W, 1, (g) => {
      const rr = rng(161); g.fillStyle = '#eef1f0'; g.fillRect(0, 0, W, Hc);
      const img = g.getImageData(0, 0, W, Hc); const d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (rr() - 0.5) * 8; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
      const X = x => x * k, Y = y => (h - y) * k; // repères du vitrage (m) : x depuis le bord gauche, y depuis le bas
      g.strokeStyle = '#121314'; g.lineCap = 'butt';
      // filet intérieur parallèle au contour, ouvert sur le bord droit
      g.lineWidth = 0.007 * k; g.beginPath();
      g.arc(X(w), Y(h - r), (r - o) * k, -Math.PI / 2, -Math.PI, true);
      g.lineTo(X(o), Y(r));
      g.arc(X(w), Y(r), (r - o) * k, Math.PI, Math.PI / 2, true);
      g.stroke();
      // barre verticale épaisse et ses deux retours vers le bord gauche
      const yb = EUR.barB, yt = EUR.barT;
      g.lineWidth = 0.014 * k; g.beginPath(); g.moveTo(X(o - 0.004), Y(yb)); g.lineTo(X(o - 0.004), Y(yt)); g.stroke();
      g.lineWidth = 0.006 * k; g.beginPath(); g.moveTo(0, Y(yt + 0.006)); g.lineTo(X(o), Y(yt + 0.006)); g.moveTo(0, Y(yb - 0.006)); g.lineTo(X(o), Y(yb - 0.006)); g.stroke();
    }, { w: W, h: Hc });
    TEX.eurielle.repeat.set(1, 1);
  }
}

// Carrelage 60×60 (RDC et pièces d'eau de l'étage, notice) : finitions au choix
export const TILE_OPTIONS = {
  beige: { label: 'Grès cérame pierre beige 60×60', base: '#d6ccbc', grout: '#b7ad9e', vein: 0.05, size: 0.6, rough: 0.42 },
  gris: { label: 'Grès cérame gris perle 60×60', base: '#c8c7c2', grout: '#9e9c97', vein: 0.04, size: 0.6, rough: 0.38 },
  blanc: { label: 'Grès cérame blanc cassé 60×60', base: '#e7e4dd', grout: '#c3bfb6', vein: 0.03, size: 0.6, rough: 0.3 },
  anthracite: { label: 'Grès cérame anthracite 60×60', base: '#5d5e5f', grout: '#4a4b4c', vein: 0.05, size: 0.6, rough: 0.45 },
};
// Parquet de l'étage (à la charge des clients, notice) : finitions au choix
export const PARQUET_OPTIONS = {
  clair: { label: 'Parquet chêne clair', base: '#d6c2a2' },
  naturel: { label: 'Parquet chêne naturel', base: '#bb966c' },
  grise: { label: 'Parquet chêne grisé', base: '#a89f92' },
  carrelage: { label: 'Carrelage, comme les pièces d\'eau' },
};
export function tileTexture(key: string) {
  const o = TILE_OPTIONS[key];
  return makeTex(1024, o.size * 2, (g, s) => {
    const r = rng(111); const t = s / 2, gw = 3;
    g.fillStyle = o.grout; g.fillRect(0, 0, s, s);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const [br, bg, bb] = hex(o.base); const f = 0.97 + r() * 0.06;
      g.fillStyle = `rgb(${br * f},${bg * f},${bb * f})`; g.fillRect(i * t + gw, j * t + gw, t - 2 * gw, t - 2 * gw);
      g.save(); g.beginPath(); g.rect(i * t + gw, j * t + gw, t - 2 * gw, t - 2 * gw); g.clip();
      for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,250' : '120,110,100'},${o.vein * (0.5 + r())})`; g.lineWidth = 2 + r() * 10; g.beginPath(); const x = i * t + r() * t, y = j * t + r() * t; g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * t, y + (r() - 0.5) * t, x + (r() - 0.5) * t, y + (r() - 0.5) * t, x + (r() - 0.5) * t * 1.5, y + (r() - 0.5) * t * 1.5); g.stroke(); }
      g.restore();
    }
    const img = g.getImageData(0, 0, s, s); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 6; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
  });
}
export function parquetTexture(key: string) {
  const o = PARQUET_OPTIONS[key];
  // lames de 18 cm de large, longueurs aléatoires ; 1 texture = 1,08 m
  return makeTex(1024, 1.08, (g, s) => {
    const r = rng(121); const rows = 6, rh = s / rows; const [br, bg, bb] = hex(o.base);
    for (let j = 0; j < rows; j++) {
      let x = -r() * s * 0.8;
      while (x < s) {
        const len = s * (0.55 + r() * 0.6); const f = 0.86 + r() * 0.22;
        for (const off of [0, -s, s]) {
          g.fillStyle = `rgb(${br * f},${bg * f},${bb * f})`; g.fillRect(x + off, j * rh, len, rh);
          for (let i = 0; i < 14; i++) { const yy = j * rh + r() * rh; g.strokeStyle = `rgba(70,48,25,${0.05 + r() * 0.10})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x + off, yy); g.bezierCurveTo(x + off + len * 0.3, yy + (r() - 0.5) * 6, x + off + len * 0.6, yy + (r() - 0.5) * 6, x + off + len, yy + (r() - 0.5) * 5); g.stroke(); }
          g.fillStyle = 'rgba(60,42,25,0.55)'; g.fillRect(x + off, j * rh, 2, rh);
        }
        x += len;
      }
      g.fillStyle = 'rgba(60,42,25,0.6)'; g.fillRect(0, j * rh, s, 2);
    }
  });
}
