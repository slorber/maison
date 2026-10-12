// Maquette 3D V2 — maison Lorber / Vaz, rue des Merlettes, Deuil-la-Barre
// Sources : plans travaux v3 (22/09/2026, vectoriel), notice signée (15/12/2025), avenant 1 (08/07/2026),
// plan de masse PCMI 2, principe de clôture PCMI 5 et façades PCMI 5, plan de bornage altimétrique.
// Repère : X = longueur 12,90 m (du nord vers le sud), Z = profondeur 7,90 m (de l'est vers l'ouest), Y = hauteur.
// Origine = angle nord-est extérieur de la maison (mur en limite de propriété). RDC fini = 0,00 (NGF 55,70).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildEnvironment, envGround } from './env.js';
import { buildRue } from './rue.js';
import { buildEquipment } from './equip.js';
import { initNav } from './nav.js';
import { buildBains } from './bains.js';
import { buildMobilier } from './mobilier.js';
import { buildSousEscalier } from './sousEscalier.js';
import { buildChambre1 } from './chambre1.js';
import { buildVoiture } from './voiture.js';
import { buildOuvrants, initOuvrants } from './ouvrants.js';
// RAL 7016 gris anthracite : valeur nominale #383E42, affichée un peu plus claire pour compenser la courbe de rendu et rendre la teinte
// telle qu'on la voit en vrai (calée sur les photos de Sébastien) ; peinture thermolaquée satinée, non métallique
export const RAL7016 = '#4d5459';

// ---------------------------------------------------------------- utils
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); // octets sRGB, pour les textures dessinées sur canvas
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist2 = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

const MAX_ANISO = { v: 8 };
function makeTex(size, meters, draw, opts = {}) {
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
function pixelNoise(g, size, base, amp, lowAmp, lowN, seed, extra) {
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
const TEX = {};
function buildTextures() {
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
const TILE_OPTIONS = {
  beige: { label: 'Grès cérame pierre beige 60×60', base: '#d6ccbc', grout: '#b7ad9e', vein: 0.05, size: 0.6, rough: 0.42 },
  gris: { label: 'Grès cérame gris perle 60×60', base: '#c8c7c2', grout: '#9e9c97', vein: 0.04, size: 0.6, rough: 0.38 },
  blanc: { label: 'Grès cérame blanc cassé 60×60', base: '#e7e4dd', grout: '#c3bfb6', vein: 0.03, size: 0.6, rough: 0.3 },
  anthracite: { label: 'Grès cérame anthracite 60×60', base: '#5d5e5f', grout: '#4a4b4c', vein: 0.05, size: 0.6, rough: 0.45 },
};
// Parquet de l'étage (à la charge des clients, notice) : finitions au choix
const PARQUET_OPTIONS = {
  clair: { label: 'Parquet chêne clair', base: '#d6c2a2' },
  naturel: { label: 'Parquet chêne naturel', base: '#bb966c' },
  grise: { label: 'Parquet chêne grisé', base: '#a89f92' },
  carrelage: { label: 'Carrelage, comme les pièces d\'eau' },
};
function tileTexture(key) {
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
function parquetTexture(key) {
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

// ---------------------------------------------------------------- materials
const M = {};
function std(o) { return new THREE.MeshStandardMaterial(o); }
function buildMaterials() {
  M.enduit = std({ map: TEX.enduit, bumpMap: TEX.enduit, bumpScale: 0.9, roughness: 0.95 });
  M.lisse = std({ map: TEX.lisse, roughness: 0.8 });
  M.paint = std({ map: TEX.paint, roughness: 0.92 });
  M.stairPaint = std({ color: '#f4f3ef', roughness: 0.8 });
  M.garageWall = std({ color: '#d9d6cf', roughness: 0.95 });
  M.ceiling = std({ color: '#f6f5f1', roughness: 0.95 });
  M.cut = std({ color: '#5b5651', roughness: 0.9 });
  M.insul = std({ color: '#e9dfc4', roughness: 1 });
  M.alu = std({ color: RAL7016, roughness: 0.5 }); // RAL 7016 thermolaqué satiné (peinture : non métallique)
  M.sable = std({ map: TEX.sable, roughness: 0.78 });
  M.garage = std({ color: RAL7016, roughness: 0.5 });
  M.bbi = std({ color: '#dcd3c2', roughness: 0.55 }); // alu laqué ton pierre : caches (sous-faces) des coffres de volets roulants encastrés (choix client du 11/10)
  M.appui = std({ color: '#efede6', roughness: 0.6 });
  M.galet = std({ color: '#9a948b', roughness: 0.8 });
  M.terrace = std({ map: TEX.terrace, roughness: 0.75 }); M.terraceEdge = std({ color: '#bdb9b1', roughness: 0.85 });
  M.pergola = std({ color: RAL7016, roughness: 0.5 });
  M.curbStone = std({ color: '#b3b0aa', roughness: 0.9 });
  M.spotLed = std({ color: '#ffffff', emissive: '#fff4e0', emissiveIntensity: 1.2, roughness: 0.4 });
  M.glass = std({ color: '#9fb4bd', roughness: 0.03, metalness: 0.25, transparent: true, opacity: 0.26, envMapIntensity: 1.6, depthWrite: false });
  M.glassOpaque = std({ color: '#eef2f2', roughness: 0.55, transparent: true, opacity: 0.9 });
  M.glassShower = std({ color: '#dfe9ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  M.eurielle = std({ map: TEX.eurielle, roughness: 0.45, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: TEX.eurielle, emissiveIntensity: 0.22 }); // verre sablé : diffuse la lumière
  M.slats = std({ map: TEX.slats, roughness: 0.5 });
  M.roof = std({ map: TEX.roof, bumpMap: TEX.roof, bumpScale: 2, roughness: 0.78 });
  M.ridge = std({ color: '#3b3d41', roughness: 0.7 });
  M.soffit = std({ color: RAL7016, roughness: 0.6 });
  M.grass = std({ map: TEX.grass, roughness: 1 });
  M.gravel = std({ map: TEX.gravel, bumpMap: TEX.gravel, bumpScale: 2, roughness: 1 });
  M.asphalt = std({ map: TEX.asphalt, roughness: 0.95 });
  M.curb = std({ map: TEX.curb, roughness: 0.95 });
  M.concrete = std({ map: TEX.concrete, roughness: 0.9 });
  M.stair = std({ map: TEX.concrete, color: '#e2ded6', roughness: 0.85 });
  M.stairTile = std({ map: TEX.stairTile, roughness: 0.5 }); // marches en chêne clair verni mat
  M.garageFloor = std({ map: TEX.concrete, color: '#f2efe9', roughness: 0.7 });
  M.mulch = std({ map: TEX.mulch, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.faience = std({ map: TEX.faience, roughness: 0.15 });
  M.mesh = std({ map: TEX.mesh, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  M.meshPost = std({ color: '#2f4a32', roughness: 0.6 });
  M.oldWall = std({ map: TEX.enduit, color: '#d8d3c8', roughness: 0.95 });
  M.coping = std({ color: '#e8e2d4', roughness: 0.75 });
  M.fenceAlu = std({ color: RAL7016, roughness: 0.5 });
  M.hedge = std({ map: TEX.hedge, roughness: 1 });
  M.tileR = std({ roughness: 0.4 }); M.tileW = std({ roughness: 0.4 }); M.parquet = std({ roughness: 0.55 });
  // mobilier, équipements
  M.wood = std({ color: '#b48a5c', roughness: 0.6 });
  M.woodDark = std({ color: '#6e5038', roughness: 0.6 });
  M.oak = std({ color: '#cdb594', roughness: 0.6 });
  M.fabric = std({ color: '#8e9195', roughness: 1 });
  M.sofa = std({ map: TEX.sofa, bumpMap: TEX.sofa, bumpScale: 0.6, roughness: 1 });
  M.fabricWarm = std({ color: '#b9a48a', roughness: 1 });
  M.linen = std({ color: '#ece7dd', roughness: 1 });
  M.white = std({ color: '#f3f2ee', roughness: 0.55 });
  M.front = std({ color: '#e9e6df', roughness: 0.45 });
  M.plinth = std({ color: '#55534f', roughness: 0.6 });
  M.worktop = std({ color: '#4a4744', roughness: 0.35 });
  M.black = std({ color: '#141414', roughness: 0.15 });
  M.blackMatte = std({ color: '#1c1d1f', roughness: 0.55, metalness: 0.2 });
  M.inox = std({ color: '#c8cbce', roughness: 0.3, metalness: 0.9 });
  M.ceramic = std({ color: '#ffffff', roughness: 0.12 });
  M.mirror = std({ color: '#dfe7ea', roughness: 0.08, metalness: 0.15, envMapIntensity: 2 });
  M.rug = std({ color: '#c2b8a6', roughness: 1 });
  M.leaf = std({ color: '#4f7a35', roughness: 0.9 });
  M.leaf2 = std({ color: '#6c8f3e', roughness: 0.9 });
  M.flower = std({ color: '#7d5fa6', roughness: 0.8 });
  // plantes hautes du jardin de pluie : joncs, calamagrostis (feuillage, épis paille), massettes (épis bruns), salicaires (épis pourpres), iris des marais (fleurs jaunes)
  M.reed = std({ color: '#4d6e3a', roughness: 0.85, side: THREE.DoubleSide }); M.reed2 = std({ color: '#71894a', roughness: 0.85, side: THREE.DoubleSide });
  M.plume = std({ color: '#cdb98e', roughness: 0.95 }); M.typha = std({ color: '#5a3b22', roughness: 0.9 }); M.lythrum = std({ color: '#b44c94', roughness: 0.8 }); M.iris = std({ color: '#e6c534', roughness: 0.7 });
  M.foliage = std({ vertexColors: true, roughness: 0.85 });
  M.trunk = std({ color: '#6a5641', roughness: 1 });
  M.door = std({ color: '#f5f4f0', roughness: 0.5 });
  M.doorLeaf = std({ color: '#f7f7f4', roughness: 0.28 }); // laqué blanc
  M.doorFrame = std({ color: '#f4f4f1', roughness: 0.35 });
  M.doorGroove = std({ color: '#b9bcbf', roughness: 0.35, metalness: 0.6 });
  M.handle = std({ color: RAL7016, roughness: 0.38, metalness: 0.15 }); // gris anthracite RAL 7016
  M.closetDoor = std({ color: '#bcbfc1', roughness: 0.4 }); // gris clair, pour repérer les placards
  M.closetRail = std({ color: '#a7aaad', roughness: 0.35, metalness: 0.6 });
  M.radiator = std({ color: '#f4f4f1', roughness: 0.35, metalness: 0.1 });
  M.pac = std({ color: '#e4e5e3', roughness: 0.45, metalness: 0.1 });
  M.grille = std({ color: RAL7016, roughness: 0.55 });
  M.lamp = std({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0.0, roughness: 0.3 });
  M.neighbour = std({ map: TEX.lisse, color: '#ebe7df', roughness: 0.95 });
  M.roofN = std({ color: '#4d4a48', roughness: 0.85 });
  setTile('R', 'beige'); setTile('W', 'beige'); setParquet('clair');
}
const finish = { R: 'beige', W: 'beige', P: 'clair' };
function setTile(level, key) {
  finish[level] = key;
  const m = level === 'R' ? M.tileR : M.tileW; const o = TILE_OPTIONS[key];
  if (m.map) m.map.dispose();
  m.map = tileTexture(key); m.roughness = o.rough; m.needsUpdate = true; if (renderer) requestRender(false);
  if (level === 'W' && finish.P === 'carrelage') setParquet('carrelage');
}
function setParquet(key) {
  finish.P = key; const m = M.parquet;
  if (m.map) m.map.dispose();
  if (key === 'carrelage') { m.map = tileTexture(finish.W); m.roughness = TILE_OPTIONS[finish.W].rough; }
  else { m.map = parquetTexture(key); m.roughness = 0.5; }
  m.needsUpdate = true; if (renderer) requestRender(false);
}

// ---------------------------------------------------------------- accumulateur de géométrie
class Acc {
  constructor() { this.b = new Map(); }
  bucket(layer, mat) { const k = layer + '|' + mat; let b = this.b.get(k); if (!b) { b = { layer, mat, pos: [], nor: [], uv: [], idx: [] }; this.b.set(k, b); } return b; }
  quad(layer, mat, p, n) {
    if (!mat) return; const b = this.bucket(layer, mat); const i = b.pos.length / 3;
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    for (const q of p) {
      b.pos.push(q[0], q[1], q[2]); b.nor.push(n[0], n[1], n[2]);
      if (ax >= ay && ax >= az) b.uv.push(n[0] > 0 ? -q[2] : q[2], q[1]);
      else if (ay >= az) b.uv.push(q[0], -q[2]);
      else b.uv.push(n[2] > 0 ? q[0] : -q[0], q[1]);
    }
    b.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  // quadrilatère quelconque : l'ordre des sommets est corrigé selon la normale voulue
  quadN(layer, mat, p, n) {
    const a = p[0], b = p[1], c = p[2];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) p = [p[0], p[3], p[2], p[1]];
    this.quad(layer, mat, p, n);
  }
  // polygone convexe (éventail), sommets réordonnés selon la normale voulue
  polyN(layer, mat, p, n) {
    if (!mat || p.length < 3) return;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; cx += (a[1] - b[1]) * (a[2] + b[2]); cy += (a[2] - b[2]) * (a[0] + b[0]); cz += (a[0] - b[0]) * (a[1] + b[1]); }
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) p = [...p].reverse();
    const b = this.bucket(layer, mat), i0 = b.pos.length / 3;
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    for (const q of p) {
      b.pos.push(q[0], q[1], q[2]); b.nor.push(n[0], n[1], n[2]);
      if (ax >= ay && ax >= az) b.uv.push(n[0] > 0 ? -q[2] : q[2], q[1]);
      else if (ay >= az) b.uv.push(q[0], -q[2]);
      else b.uv.push(n[2] > 0 ? q[0] : -q[0], q[1]);
    }
    for (let i = 1; i < p.length - 1; i++) b.idx.push(i0, i0 + i, i0 + i + 1);
  }
  // m : nom de matériau ou {px,nx,py,ny,pz,nz,def}
  box(layer, x0, x1, y0, y1, z0, z1, m) {
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0]; if (z1 < z0) [z0, z1] = [z1, z0];
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    const f = k => typeof m === 'string' ? m : (k in m ? m[k] : m.def);
    this.quad(layer, f('px'), [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
    this.quad(layer, f('nx'), [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
    this.quad(layer, f('py'), [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
    this.quad(layer, f('ny'), [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
    this.quad(layer, f('pz'), [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
    this.quad(layer, f('nz'), [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
  }
  build(groups) {
    for (const b of this.b.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setIndex(b.idx);
      const mesh = new THREE.Mesh(g, M[b.mat]);
      const transp = M[b.mat].transparent;
      mesh.castShadow = !transp && b.mat !== 'mesh'; mesh.receiveShadow = true;
      groups[b.layer].add(mesh);
    }
  }
}
const A = new Acc();

// [perf] fusion de petits maillages statiques (touffes, quincaillerie, sanitaires…) : un seul maillage, donc un seul appel de dessin,
// par matériau, réglage d'ombre et jeu d'attributs ; les transformations sont appliquées aux sommets (rendu identique).
// roots : objets (maillages ou groupes) déjà enfants de dst ou détachés ; les sous-arbres contenant autre chose que des maillages
// et des groupes (lumières, lignes…) ou masqués sont laissés tels quels ; les maillages transparents, instanciés, multi-matériaux
// ou à renderOrder sont rattachés à dst sans fusion (tri par profondeur conservé). Renvoie les maillages fusionnés.
function mergeStatic(roots, dst) {
  dst.updateWorldMatrix(true, false);
  const inv = dst.matrixWorld.clone().invert(), B = new Map(), loose = [], used = [], out = [];
  for (const r of roots) {
    let ok = r.visible; r.traverse(o => { if ((!o.isMesh && !o.isGroup && o.type !== 'Object3D') || o.userData.noMerge) ok = false; }); // userData.noMerge : sous-arbre laissé intact (objet animé ou retrouvé plus tard)
    if (!ok) continue;
    r.updateWorldMatrix(true, true); used.push(r);
    r.traverse(o => {
      if (!o.isMesh) return; const mt = o.material, g = o.geometry;
      if (Array.isArray(mt) || o.isInstancedMesh || o.isSkinnedMesh || mt.transparent || o.renderOrder || !o.visible || g.morphAttributes.position) { loose.push(o); return; }
      const key = [mt.uuid, o.castShadow, o.receiveShadow, Object.keys(g.attributes).sort().join()].join('|');
      let b = B.get(key); if (!b) B.set(key, b = { mt, cast: o.castShadow, recv: o.receiveShadow, items: [] });
      b.items.push({ g, m: inv.clone().multiply(o.matrixWorld) });
    });
  }
  for (const o of loose) dst.attach(o);
  for (const r of used) if (loose.indexOf(r) < 0) r.removeFromParent(); // un maillage racine non fusionné reste rattaché à dst
  for (const b of B.values()) {
    const allIdx = b.items.every(it => it.g.index);
    const geos = b.items.map(({ g, m }) => {
      const c = allIdx ? g.clone() : (g.index ? g.toNonIndexed() : g.clone()); c.applyMatrix4(m);
      if (m.determinant() < 0) { // repère miroir : on retourne l'ordre des sommets pour garder les faces avant
        if (c.index) { const a = c.index.array; for (let i = 0; i + 2 < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } }
        else for (const at of Object.values(c.attributes)) { const s = at.itemSize, a = at.array; for (let i = 0; i + 2 < at.count; i += 3) for (let k = 0; k < s; k++) { const t = a[(i + 1) * s + k]; a[(i + 1) * s + k] = a[(i + 2) * s + k]; a[(i + 2) * s + k] = t; } }
      }
      return c;
    });
    const mg = geos.length > 1 ? mergeGeometries(geos, false) : geos[0]; if (!mg) continue;
    const m = new THREE.Mesh(mg, b.mt); m.castShadow = b.cast; m.receiveShadow = b.recv; m.userData.merged = b.items.length; dst.add(m); out.push(m);
  }
  return out;
}

// prisme le long d'un segment p0→p1 (plan XZ), épaisseur t0..t1 côté droit du sens de parcours,
// base yb0 (en p0) → yb1 (en p1), hauteur h : sert aux murets et lames qui suivent la pente ; acc : accumulateur (par défaut A, sinon celui d'un élément mobile)
function sbox(layer, mat, p0, p1, t0, t1, yb0, yb1, h, acc = A) {
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1], len = Math.hypot(dx, dz); if (len < 1e-4) return;
  const ux = dx / len, uz = dz / len, nx = uz, nz = -ux;
  const P = (s, t, y) => [(s ? p1[0] : p0[0]) + nx * t, y, (s ? p1[1] : p0[1]) + nz * t];
  const a = P(0, t0, yb0), b = P(1, t0, yb1), c = P(1, t0, yb1 + h), d = P(0, t0, yb0 + h);
  const e = P(0, t1, yb0), f = P(1, t1, yb1), g = P(1, t1, yb1 + h), k = P(0, t1, yb0 + h);
  const sg = Math.sign(t1 - t0) || 1;
  acc.quadN(layer, mat, [a, b, c, d], [-nx * sg, 0, -nz * sg]);
  acc.quadN(layer, mat, [e, f, g, k], [nx * sg, 0, nz * sg]);
  const sl = (yb1 - yb0) / len; const tn = new THREE.Vector3(-ux * sl, 1, -uz * sl).normalize();
  acc.quadN(layer, mat, [d, c, g, k], [tn.x, tn.y, tn.z]);
  acc.quadN(layer, mat, [a, b, f, e], [-tn.x, -tn.y, -tn.z]);
  acc.quadN(layer, mat, [a, d, k, e], [-ux, 0, -uz]);
  acc.quadN(layer, mat, [b, c, g, f], [ux, 0, uz]);
}

// mur droit avec ouvertures. axis 'x' : court selon X, épaisseur selon Z (c0..c1)
// Les tableaux ne sont dessinés qu'au droit des ouvertures (pas de faces internes entre tronçons, qui créaient des filets parasites).
function wall(layer, axis, c0, c1, a0, a1, y0, y1, openings, mats) {
  const cuts = new Set([a0, a1]);
  for (const o of openings) { if (o.a0 > a0 && o.a0 < a1) cuts.add(o.a0); if (o.a1 > a0 && o.a1 < a1) cuts.add(o.a1); }
  const xs = [...cuts].sort((p, q) => p - q);
  const top = 'top' in mats ? mats.top : 'cut', bot = 'bottom' in mats ? mats.bottom : mats.end;
  for (let i = 0; i < xs.length - 1; i++) {
    const s = xs[i], e = xs[i + 1], mid = (s + e) / 2;
    const os = openings.filter(o => o.a0 <= mid && o.a1 >= mid).sort((p, q) => p.y0 - q.y0);
    const spans = []; let cy = y0;
    for (const o of os) { spans.push([cy, Math.max(cy, o.y0)]); cy = Math.max(cy, o.y1); }
    spans.push([cy, y1]);
    const eS = s === a0 ? mats.end : null, eE = e === a1 ? mats.end : null;
    for (const [p, q] of spans) {
      if (q - p < 1e-3) continue;
      const s2 = s - (s > a0 ? 0.002 : 0), e2 = e + (e < a1 ? 0.002 : 0);
      const py = q < y1 - 1e-3 ? mats.end : top; // tableau bas d'une baie : même finition que les tableaux
      const ny = p > y0 + 1e-3 ? mats.end : bot;
      if (axis === 'x') A.box(layer, s2, e2, p, q, c0, c1, { nz: mats.neg, pz: mats.pos, nx: eS, px: eE, py, ny });
      else A.box(layer, c0, c1, p, q, s2, e2, { nx: mats.neg, px: mats.pos, nz: eS, pz: eE, py, ny });
    }
  }
  // tableaux des ouvertures
  if (!mats.end) return;
  for (const o of openings) {
    const oy0 = Math.max(o.y0, y0), oy1 = Math.min(o.y1, y1); if (oy1 - oy0 < 1e-3) continue;
    for (const [a, sg] of [[o.a0 + 0.002, 1], [o.a1 - 0.002, -1]]) {
      if (a <= a0 + 0.003 || a >= a1 - 0.003) continue;
      if (axis === 'x') A.quadN(layer, mats.end, [[a, oy0, c0], [a, oy0, c1], [a, oy1, c1], [a, oy1, c0]], [sg, 0, 0]);
      else A.quadN(layer, mats.end, [[c0, oy0, a], [c1, oy0, a], [c1, oy1, a], [c0, oy1, a]], [0, 0, sg]);
    }
  }
}

// ---------------------------------------------------------------- données du plan (plans travaux v3, relevés en vectoriel)
const H = { rdcCeil: 2.50, r1Floor: 2.87, r1Ceil: 5.37, wallTop: 5.60, eave: 5.67, ridge: 8.54 };
const L = 12.90, D = 7.90, T = 0.36, SH = 0.22; // longueur, profondeur, murs 36 cm (brique 20 + enduit, doublage 14)
const E1 = H.r1Floor;
// faces : axis, F (plan extérieur), s (sens sortant)
const FACE = { W: { axis: 'x', F: D, s: 1 }, E: { axis: 'x', F: 0, s: -1 }, N: { axis: 'z', F: 0, s: -1 }, S: { axis: 'z', F: L, s: 1 } };
// a0/a1 : position le long de la façade (X pour l'ouest, Z pour nord et sud) ; vr : volet roulant BBI ; gc : garde-corps
const OPEN = {
  W: [
    { a0: 2.04, a1: 3.44, y0: 1.10, y1: 2.15, t: 'win', n: 2, lvl: 0, vr: 1 }, // cuisine
    { a0: 5.55, a1: 7.35, y0: 0, y1: 2.15, t: 'baie', n: 2, lvl: 0, vr: 1 }, // porte-fenêtre 2 vantaux du séjour, serrure barillet
    { a0: 9.45, a1: 10.85, y0: 1.10, y1: 2.15, t: 'win', n: 2, lvl: 0, vr: 1 },
    { a0: 2.24, a1: 3.24, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
    { a0: 5.95, a1: 6.95, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
    { a0: 9.66, a1: 10.66, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
  ],
  N: [
    { a0: 0.66, a1: 1.06, y0: 1.20, y1: 2.15, t: 'win', n: 1, lvl: 0, opaque: 1 }, // WC, verre opaque retardateur 44.2
    { a0: 1.82, a1: 2.72, y0: 0, y1: 2.15, t: 'entry', lvl: 0 }, // porte Bel'M Eurielle
    { a0: 3.47, a1: 3.87, y0: 1.20, y1: 2.15, t: 'win', n: 1, lvl: 0 },
    { a0: 5.18, a1: 6.58, y0: 1.10, y1: 2.15, t: 'win', n: 2, lvl: 0, vr: 1 }, // cuisine
    { a0: 1.04, a1: 1.84, y0: 3.87, y1: 5.02, t: 'win', n: 1, lvl: 1, vr: 1, opaque: 1 }, // bains
    { a0: 3.37, a1: 3.97, y0: 3.87, y1: 5.02, t: 'win', n: 0, lvl: 1 }, // fixe escalier
    { a0: 5.48, a1: 6.28, y0: 3.87, y1: 5.02, t: 'win', n: 1, lvl: 1, vr: 1 },
  ],
  S: [
    { a0: 0.43, a1: 2.93, y0: -0.13, y1: 2.12, t: 'garage', lvl: 0 }, // Novoferm ISO 45 lisse 2,50 × 2,25
    { a0: 4.65, a1: 6.05, y0: 0, y1: 2.15, t: 'baie', n: 2, lvl: 0, vr: 1 }, // porte-fenêtre 2 vantaux du séjour (sud)
    { a0: 1.08, a1: 2.28, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
    { a0: 4.75, a1: 5.95, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
  ],
  E: [],
};

// boîte en coordonnées locales de façade : a (le long), y, d (profondeur depuis le nu extérieur, + vers l'intérieur)
function LB(face, layer, a0, a1, y0, y1, d0, d1, mat) {
  const f = FACE[face];
  const w0 = f.F - f.s * d0, w1 = f.F - f.s * d1;
  if (f.axis === 'x') A.box(layer, a0, a1, y0, y1, w0, w1, mat); else A.box(layer, w0, w1, y0, y1, a0, a1, mat);
}
// clé de face d'une boîte LB tournée vers l'extérieur / l'intérieur
const outKey = face => { const f = FACE[face]; return f.axis === 'x' ? (f.s > 0 ? 'pz' : 'nz') : (f.s > 0 ? 'px' : 'nx'); };
const inKey = face => { const f = FACE[face]; return f.axis === 'x' ? (f.s > 0 ? 'nz' : 'pz') : (f.s > 0 ? 'nx' : 'px'); };

function buildShell() {
  for (const lv of [0, 1]) {
    const layer = lv ? 'r1' : 'rdc';
    const y0 = lv ? H.r1Floor : -0.6, y1 = lv ? H.wallTop : H.r1Floor;
    const ops = k => OPEN[k].filter(o => o.lvl === lv);
    const top = lv ? 'enduit' : 'cut';
    // brique + enduit ; le parement extérieur est une peau continue (plus bas)
    wall(layer, 'z', 0, SH, 0, D, y0, y1, ops('N'), { neg: null, pos: 'garageWall', end: 'lisse', top });
    wall(layer, 'z', L - SH, L, 0, D, y0, y1, ops('S'), { neg: 'garageWall', pos: null, end: 'lisse', top });
    wall(layer, 'x', D - SH, D, SH, L - SH, y0, y1, ops('W'), { neg: 'garageWall', pos: null, end: 'lisse', top });
    wall(layer, 'x', 0, SH, SH, L - SH, y0, lv ? H.eave : y1, [], { neg: null, pos: 'garageWall', end: 'lisse', top });
    // doublage 14 cm des pièces chauffées (pas de doublage côté garage)
    const iy0 = lv ? H.r1Floor : 0, iy1 = lv ? H.r1Ceil : H.r1Floor;
    const P = { neg: 'paint', pos: 'paint', end: 'paint', top: 'cut' };
    wall(layer, 'z', SH, T, SH, D - SH, iy0, iy1, ops('N'), P);
    wall(layer, 'x', D - T, D - SH, T, L - T, iy0, iy1, ops('W'), P);
    if (lv) {
      wall(layer, 'z', L - T, L - SH, SH, D - SH, iy0, iy1, ops('S'), P);
      wall(layer, 'x', SH, T, T, L - T, iy0, iy1, [], P);
    } else {
      wall(layer, 'z', L - T, L - SH, 3.30, D - SH, iy0, iy1, ops('S'), P);
      wall(layer, 'x', SH, T, T, 5.16, iy0, iy1, [], P);
    }
  }
  // peau d'enduit continue sur toute la hauteur (et version coupée à +2,87 pour la vue du RDC)
  for (const [layer, top] of [['skinU', null], ['skinR', H.r1Floor]]) {
    const ops = k => top ? OPEN[k].filter(o => o.lvl === 0) : OPEN[k];
    const t = top || H.wallTop, e = 0.008; // peau légèrement en saillie pour masquer les arêtes des tableaux
    wall(layer, 'z', -e, 0, -e, D + e, -0.6, t, ops('N'), { neg: 'enduit', pos: null, end: null, top: null, bottom: null });
    wall(layer, 'z', L, L + e, -e, D + e, -0.6, t, ops('S'), { neg: null, pos: 'enduit', end: null, top: null, bottom: null });
    wall(layer, 'x', D, D + e, -e, L + e, -0.6, t, ops('W'), { neg: null, pos: 'enduit', end: null, top: null, bottom: null });
    wall(layer, 'x', -e, 0, -e, L + e, -0.6, top || H.eave, [], { neg: 'enduit', pos: null, end: null, top: null, bottom: null });
  }
  // 4 chaînes d'angle droites lissées à l'éponge (30 cm sur chaque face)
  const q = 0.30, p = 0.02, yb = -0.6, yt = H.wallTop;
  for (const [face, a0, a1] of [['W', 0, q], ['W', L - q, L], ['E', 0, q], ['E', L - q, L], ['N', 0, q], ['N', D - q, D], ['S', 0, q], ['S', D - q, D]]) {
    LB(face, 'rdc', a0, a1, yb, H.r1Floor, -p, 0, 'lisse');
    LB(face, 'r1', a0, a1, H.r1Floor, face === 'E' ? H.eave : yt, -p, 0, 'lisse');
  }
  // 17 encadrements d'ouvertures lissés, appuis, menuiseries
  for (const face of ['W', 'N', 'S']) for (const o of OPEN[face]) { encadrement(face, o); menuiserie(face, o); }
}

function encadrement(face, o) {
  const layer = o.lvl ? 'r1' : 'rdc'; const bw = 0.15, p = 0.028; // modénatures de 15 cm partout
  const isDoor = o.t !== 'win';
  const yb = isDoor ? -0.6 : o.y0 - bw;
  LB(face, layer, o.a0 - bw, o.a0, yb, o.y1 + bw, -p, 0, 'lisse');
  LB(face, layer, o.a1, o.a1 + bw, yb, o.y1 + bw, -p, 0, 'lisse');
  // traverses légèrement en retrait des montants (1,5 mm) : leurs abouts restent cachés, sans filet à la jonction
  LB(face, layer, o.a0 - 0.002, o.a1 + 0.002, o.y1, o.y1 + bw, -p + 0.0015, 0, 'lisse');
  if (!isDoor) LB(face, layer, o.a0 - 0.002, o.a1 + 0.002, yb, o.y0 - 0.055, -p + 0.0015, 0, 'lisse');
}

// vantail mobile : calque propre (groupe rempli par A.build ou à la main), accroché et animé par ouvrants.js ; inf = géométrie du vantail en repère de façade
function leafLayer(face, o, inf) { o.leaves = o.leaves || []; const k = `ouv${face}${OPEN[face].indexOf(o)}_${o.leaves.length}`; groups[k] = new THREE.Group(); o.leaves.push({ key: k, g: groups[k], ...inf }); return k; }
function menuiserie(face, o) {
  const lv = o.lvl, layer = lv ? 'r1' : 'rdc', vol = lv ? 'volets1' : 'volets0';
  const { a0, a1, y0, y1 } = o;
  const isDoor = o.t !== 'win';
  const w = 0.055, dd0 = 0.20, dd1 = 0.27;
  if (o.t === 'garage') return garageDoor(face, o, layer);
  if (o.t === 'entry') return entryDoor(face, o, layer);
  // cache (sous-face) du coffre BBI encastré en alu ton pierre ; coulisses du volet en alu RAL 7016 collées au dormant (bloc-baie : aucun tableau ton pierre visible entre les deux)
  if (o.vr) {
    LB(face, layer, a0, a1, y1 - 0.025, y1, 0.02, dd0, 'bbi');
    LB(face, layer, a0, a0 + 0.035, y0, y1 - 0.025, dd0 - 0.07, dd0, 'alu');
    LB(face, layer, a1 - 0.035, a1, y0, y1 - 0.025, dd0 - 0.07, dd0, 'alu');
  }
  const yTop = y1 - (o.vr ? 0.025 : 0);
  // dormant
  LB(face, layer, a0, a0 + w, y0, yTop, dd0, dd1, 'alu');
  LB(face, layer, a1 - w, a1, y0, yTop, dd0, dd1, 'alu');
  LB(face, layer, a0, a1, yTop - w, yTop, dd0, dd1, 'alu');
  if (!isDoor) LB(face, layer, a0, a1, y0, y0 + w, dd0, dd1, 'alu');
  // appui Opti'one blanc tradition / seuil Opti'one gris galet
  if (!isDoor) LB(face, layer, a0 - 0.03, a1 + 0.03, y0 - 0.05, y0 + 0.004, -0.045, 0.21, 'appui');
  else LB(face, layer, a0 - 0.02, a1 + 0.02, y0 - 0.06, y0 + 0.005, -0.045, 0.21, 'galet');
  const glassMat = o.opaque ? 'glassOpaque' : 'glass';
  const n = o.n, sp = isDoor ? 0.075 : 0.06;
  const ia0 = a0 + w, ia1 = a1 - w, iy0 = isDoor ? y0 + 0.01 : y0 + w, iy1 = yTop - w;
  if (n === 0) {
    LB(face, layer, ia0, ia1, iy0, iy1, 0.232, 0.238, glassMat);
  } else {
    const swd = (ia1 - ia0) / n;
    for (let i = 0; i < n; i++) {
      const s0 = ia0 + i * swd, s1 = s0 + swd;
      const sd0 = n === 2 && i === 1 && o.t !== 'baie' ? 0.212 : 0.205, sd1 = sd0 + 0.05; // portes-fenêtres : deux vantaux battants dans le même plan
      const ly = leafLayer(face, o, { i, s0, s1, d0: sd0, d1: sd1, y0: iy0, y1: iy1 }); // ouvrant (battant ou coulissant) : calque propre
      LB(face, ly, s0, s0 + sp, iy0, iy1, sd0, sd1, 'alu');
      LB(face, ly, s1 - sp, s1, iy0, iy1, sd0, sd1, 'alu');
      LB(face, ly, s0, s1, iy0, iy0 + sp, sd0, sd1, 'alu');
      LB(face, ly, s0, s1, iy1 - sp, iy1, sd0, sd1, 'alu');
      LB(face, ly, s0 + sp, s1 - sp, iy0 + sp, iy1 - sp, sd0 + 0.022, sd0 + 0.028, glassMat);
      // poignée côté intérieur
      const hx = (n === 2 && i === 0) || n === 1 ? s1 - sp / 2 : null;
      const hy = isDoor ? 1.05 : (iy0 + iy1) / 2;
      if (hx !== null) LB(face, ly, hx - 0.012, hx + 0.012, hy - 0.09, hy + 0.05, sd1, sd1 + 0.03, 'alu');
    }
  }
  // tablier de volet roulant (affiché si « volets fermés »)
  if (o.vr) LB(face, vol, a0 + 0.02, a1 - 0.02, y0 + (isDoor ? 0.005 : 0), yTop, dd0 - 0.045, dd0 - 0.03, 'slats'); // dans les coulisses
  // garde-corps des fenêtres d'étage (allège 0,70 m), modèle des photos de Sébastien, acier RAL 7016 scellé dans les tableaux :
  // lisses plates 35 × 10 en haut (à 1,05 m du sol fini) et en bas (à 10 cm de l'appui), 2 barreaux 14 × 14 de chaque côté, croix de Saint-André centrale avec rosace
  if (o.gc) gardeCorps(face, o, layer);
}

function gardeCorps(face, o, layer) {
  const { a0, a1, y0 } = o, W = a1 - a0, f = FACE[face];
  const yb0 = y0 + 0.100, yb1 = yb0 + 0.010, yt1 = E1 + 1.05, yt0 = yt1 - 0.010, d0 = 0.025, d1 = 0.060, dm = 0.043;
  LB(face, layer, a0 - 0.01, a1 + 0.01, yb0, yb1, d0, d1, 'alu'); LB(face, layer, a0 - 0.01, a1 + 0.01, yt0, yt1, d0, d1, 'alu');
  const fr = [0.100, 0.197, 0.295, 0.705, 0.803, 0.900];
  for (const t of fr) { const a = a0 + t * W; LB(face, layer, a - 0.007, a + 0.007, yb1, yt0, dm - 0.007, dm + 0.007, 'alu'); }
  // croix et rosace : géométries tournées dans le plan de la façade, posées directement dans le calque
  const p0 = a0 + fr[2] * W + 0.007, p1 = a0 + fr[3] * W - 0.007, w = f.F - f.s * dm, ac = (p0 + p1) / 2, yc = (yb1 + yt0) / 2;
  const toW = g => { if (f.axis === 'z') g.rotateY(-Math.PI / 2); return g.translate(f.axis === 'x' ? ac : w, yc, f.axis === 'x' ? w : ac); };
  const dx = p1 - p0, dy = yt0 - yb1, len = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
  for (const sg of [1, -1]) { const m = new THREE.Mesh(toW(new THREE.BoxGeometry(len, 0.022, 0.006).rotateZ(sg * th)), M.alu); m.castShadow = m.receiveShadow = true; groups[layer].add(m); }
  const disc = new THREE.Mesh(toW(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 28).rotateX(Math.PI / 2)), M.alu); disc.castShadow = disc.receiveShadow = true; groups[layer].add(disc);

}

// Porte d'entrée Bel'M Eurielle, alu 80 mm, gris anthracite 7016 sablé extérieur / blanc intérieur (avenant 1, photo Bel'M fournie)
// Vitrage : largeur 18,3 cm, haut du vitrage à 1,76 m, bas à 0,40 m, arrondis de rayon égal à la largeur côté charnières.
const EUR = { w: 0.183, h: 1.359, r: 0.183, o: 0.045, barB: 0.220, barT: 1.089, fromLock: 0.142, y0: 0.398 };
function entryDoor(face, o, layer) {
  const { a0, a1, y1 } = o; const fw = 0.065, d0 = 0.19, d1 = 0.28;
  const f = FACE[face], s = f.s;
  // dormant bicolore
  const fm = { def: 'sable', [inKey(face)]: 'white' };
  LB(face, layer, a0, a0 + fw, 0, y1, d0, d1, fm);
  LB(face, layer, a1 - fw, a1, 0, y1, d0, d1, fm);
  LB(face, layer, a0, a1, y1 - fw, y1, d0, d1, fm);
  LB(face, layer, a0 - 0.02, a1 + 0.02, -0.06, 0.005, -0.045, 0.21, 'galet'); // seuil Opti'one gris galet
  // ouvrant monobloc : charnières côté WC (a0), serrure côté a1 ; panneau percé du vitrage en demi-lune
  const l0 = a0 + fw, l1 = a1 - fw, b = 0.012, t = y1 - fw - 0.004;
  const ly = leafLayer(face, o, { s0: l0, s1: l1, d0: 0.20, d1: 0.28, y0: b, y1: t }); // ouvrant (panneau, vitrage, béquilles) : calque propre
  const gA1 = l1 - EUR.fromLock, gA0 = gA1 - EUR.w, gY0 = EUR.y0, gY1 = gY0 + EUR.h, r = EUR.r;
  // repère local : x = s·a, y = hauteur, z = profondeur d depuis le nu extérieur (rotation pure vers le monde)
  const mtx = f.axis === 'z' ? new THREE.Matrix4().set(0, 0, -s, f.F, 0, 1, 0, 0, s, 0, 0, 0, 0, 0, 0, 1)
    : new THREE.Matrix4().set(s, 0, 0, 0, 0, 1, 0, 0, 0, 0, -s, f.F, 0, 0, 0, 1);
  const pts = [[gA1, gY0], [gA1, gY1]];
  for (let i = 1; i <= 16; i++) { const th = Math.PI / 2 + i / 16 * Math.PI / 2; pts.push([gA1 + r * Math.cos(th), gY1 - r + r * Math.sin(th)]); }
  for (let i = 0; i < 16; i++) { const th = Math.PI + i / 16 * Math.PI / 2; pts.push([gA1 + r * Math.cos(th), gY0 + r + r * Math.sin(th)]); }
  const leaf = (dA, dB, mat) => {
    const sh = new THREE.Shape([[l0, b], [l1, b], [l1, t], [l0, t]].map(([a, y]) => new THREE.Vector2(s * a, y)));
    sh.holes.push(new THREE.Path(pts.map(([a, y]) => new THREE.Vector2(s * a, y))));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: dB - dA, bevelEnabled: false });
    geo.translate(0, 0, dA); geo.applyMatrix4(mtx);
    const m = new THREE.Mesh(geo, [mat, mat]); m.castShadow = m.receiveShadow = true; groups[ly].add(m);
  };
  leaf(0.20, 0.24, M.sable); leaf(0.24, 0.28, M.white);
  // vitrage sablé (les parties du plan hors de la découpe restent noyées dans l'épaisseur du panneau)
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(EUR.w, EUR.h), M.eurielle);
  const wc = f.F - s * 0.24, ac = (gA0 + gA1) / 2;
  if (f.axis === 'z') { pl.position.set(wc, (gY0 + gY1) / 2, ac); pl.rotation.y = s < 0 ? -Math.PI / 2 : Math.PI / 2; }
  else { pl.position.set(ac, (gY0 + gY1) / 2, wc); pl.rotation.y = s < 0 ? Math.PI : 0; }
  pl.receiveShadow = true; groups[ly].add(pl);
  // béquille noire sur rosace ronde, rosace de cylindre en dessous (extérieur et intérieur)
  const ha = l1 - 0.045, hy = 1.05;
  const P = (a, y, d) => f.axis === 'z' ? new THREE.Vector3(f.F - s * d, y, a) : new THREE.Vector3(a, y, f.F - s * d);
  const disc = (rad, a, y, dA, dB, mat) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, Math.abs(dB - dA), 24), M[mat]);
    c.position.copy(P(a, y, (dA + dB) / 2)); if (f.axis === 'z') c.rotation.z = Math.PI / 2; else c.rotation.x = Math.PI / 2;
    c.castShadow = true; groups[ly].add(c);
  };
  for (const [dr, sg] of [[0.20, -1], [0.28, 1]]) {
    disc(0.026, ha, hy, dr, dr + sg * 0.009, 'blackMatte');
    disc(0.009, ha, hy, dr + sg * 0.009, dr + sg * 0.05, 'blackMatte');
    LB(face, ly, ha - 0.13, ha + 0.01, hy - 0.0095, hy + 0.0095, dr + sg * 0.04, dr + sg * 0.06, 'blackMatte');
    disc(0.021, ha, hy - 0.10, dr, dr + sg * 0.008, 'blackMatte');
  }
  LB(face, ly, ha - 0.004, ha + 0.004, hy - 0.112, hy - 0.088, 0.190, 0.1925, 'inox'); // entrée de clé
  LB(face, ly, ha - 0.004, ha + 0.004, hy - 0.118, hy - 0.082, 0.288, 0.300, 'blackMatte'); // bouton moleté intérieur
}

// Porte de garage sectionnelle Novoferm ISO 45 sans nervure, lisse givré gris proche 7016, huisserie noire (avenant 1)
function garageDoor(face, o, layer) {
  const { a0, a1, y0, y1 } = o;
  // 4 sections (calques propres, roulées sous le plafond par ouvrants.js) ; chaque joint noir est partagé en deux demi-joints
  for (let k = 0; k < 4; k++) { const ya = y0 + (y1 - y0) * k / 4, yb = y0 + (y1 - y0) * (k + 1) / 4, ly = leafLayer(face, o, { k, y0: ya, y1: yb, d0: 0.235, d1: 0.275 });
    LB(face, ly, a0, a1, ya, yb, 0.235, 0.275, 'garage');
    if (k > 0) LB(face, ly, a0 + 0.01, a1 - 0.01, ya, ya + 0.004, 0.231, 0.235, 'black');
    if (k < 3) LB(face, ly, a0 + 0.01, a1 - 0.01, yb - 0.004, yb, 0.231, 0.235, 'black'); }
  LB(face, layer, a0, a0 + 0.04, y0, y1, 0.20, 0.235, 'blackMatte');
  LB(face, layer, a1 - 0.04, a1, y0, y1, 0.20, 0.235, 'blackMatte');
  LB(face, layer, a0, a1, y1 - 0.04, y1, 0.20, 0.235, 'blackMatte');
  LB(face, layer, a0, a1, y0 - 0.02, y0, -0.03, 0.24, 'galet');
}

// ---------------------------------------------------------------- planchers, cloisons, escalier
function buildInterior() {
  // RDC : carrelage (entrée, WC, cuisine, séjour, sous l'escalier), garage béton à -0,13
  A.box('rdc', T, 5.16, -0.25, 0, T, 3.30, { py: 'tileR', def: 'concrete' });
  A.box('rdc', T, L - T, -0.25, 0, 3.30, D - T, { py: 'tileR', def: 'concrete' });
  A.box('rdc', 5.31, L - SH, -0.38, -0.13, SH, 3.15, { py: 'garageFloor', def: 'concrete' });
  // dalle étage, trémie escalier x 0,36→3,91 / z 3,17→4,17
  const yS = H.r1Floor - 0.008;
  const sl = { py: 'ceiling', ny: 'ceiling', def: 'ceiling' };
  A.box('slab1', SH, L - SH, H.rdcCeil, yS, SH, 3.17, sl);
  A.box('slab1', SH, L - SH, H.rdcCeil, yS, 4.17, D - SH, sl);
  A.box('slab1', 3.91, L - SH, H.rdcCeil, yS, 3.17, 4.17, sl);
  // jour de 10 cm laissé vide entre la cloison de la salle de bains (z 3,17) et la joue de l'escalier (z 3,27)
  // parquet partout à l'étage, carrelage 60×60 dans les pièces d'eau (posé par-dessus)
  const pq = { py: 'parquet', def: 'ceiling' };
  A.box('slab1', T, L - T, yS, yS + 0.004, T, 3.17, pq);
  A.box('slab1', T, L - T, yS, yS + 0.004, 4.17, D - T, pq);
  A.box('slab1', 3.91, L - T, yS, yS + 0.004, 3.17, 4.17, pq);
  const tw = { py: 'tileW', def: 'ceiling' };
  A.box('slab1', T, 3.86, yS + 0.004, H.r1Floor, T, 3.10, tw); // bains
  A.box('slab1', 3.93, 4.83, yS + 0.004, H.r1Floor, T, 2.11, tw); // WC
  A.box('slab1', 4.90, 6.29, yS + 0.004, H.r1Floor, T, 3.10, tw); // douche
  // plafond étage + isolant
  A.box('ceil1', T, L - T, H.r1Ceil, H.r1Ceil + 0.12, T, D - T, { ny: 'ceiling', py: 'insul', def: 'ceiling' });

  const P = { neg: 'paint', pos: 'paint', end: 'paint', top: 'cut' };
  const d0 = 2.04;
  // cloisons RDC
  wall('rdc', 'x', 1.36, 1.43, T, 2.43, 0, H.rdcCeil, [{ a0: 1.38, a1: 2.11, y0: 0, y1: d0 }], P); // WC / entrée
  wall('rdc', 'z', 2.36, 2.43, T, 1.43, 0, H.rdcCeil, [], P); // WC / placard
  A.box('rdc', 2.43, 2.65, 0, H.rdcCeil, 0.99, 1.43, 'paint'); // gaine colonnes WC et bains
  wall('rdc', 'z', 5.16, 5.31, SH, 3.30, -0.13, H.rdcCeil, [{ a0: 1.42, a1: 2.30, y0: 0, y1: d0 }], { neg: 'paint', pos: 'garageWall', end: 'paint', top: 'cut' }); // entrée / garage
  wall('rdc', 'x', 3.15, 3.30, 5.31, L - SH, -0.13, H.rdcCeil, [], { neg: 'garageWall', pos: 'paint', end: 'paint', top: 'cut' }); // garage / séjour
  // cloison 7 cm à 1,70 m de la porte entrée / garage, juste après le lave-linge : local technique (PAC, lave-linge, nourrice, tableau) / garage,
  // porte de service côté conducteur de la voiture, tableau ouest à 60 cm de la cloison du séjour (z 3,15) : passage 1,67 → 2,55 (client, 12/10)
  wall('rdc', 'z', 7.01, 7.08, SH, 3.15, -0.13, H.rdcCeil, [{ a0: 1.67, a1: 2.55, y0: -0.13, y1: -0.13 + d0 }], { neg: 'garageWall', pos: 'garageWall', end: 'garageWall', top: 'cut' });
  // poteaux BA 25 × 25 du garage (plan travaux v3 p. 9), contre la cloison du séjour sous la poutre BA : à l'angle du local technique et
  // au droit du garage ; le troisième est noyé dans le jambage de la porte de garage (mur sud)
  for (const x0 of [5.31, 8.43]) A.box('rdc', x0, x0 + 0.25, -0.13, H.rdcCeil, 2.90, 3.15, 'garageWall');
  wall('rdc', 'x', 4.17, 4.24, T, 3.86, 0, H.rdcCeil, [], P); // escalier / cuisine
  wall('rdc', 'z', 3.79, 3.86, 4.24, 4.89, 0, H.rdcCeil, [], P); // retour cuisine
  // cloisons étage
  const e = E1, c = H.r1Ceil, d1 = e + d0;
  wall('r1', 'x', 3.10, 3.17, T, 3.86, e, c, [], P); // bains / escalier
  wall('r1', 'z', 3.86, 3.93, T, 3.17, e, c, [{ a0: 2.28, a1: 3.03, y0: e, y1: d1 }], P); // bains / WC
  wall('r1', 'z', 4.83, 4.90, T, 3.17, e, c, [], P); // WC / douche
  wall('r1', 'x', 2.11, 2.18, 3.93, 4.83, e, c, [{ a0: 4.03, a1: 4.75, y0: e, y1: d1 }], P);
  wall('r1', 'z', 6.29, 6.37, T, 3.10, e, c, [{ a0: 1.62, a1: 2.42, y0: e, y1: d1 }], P); // douche / dressing (passage, plan p. 10 : z 1,62 → 2,42)
  wall('r1', 'x', 3.10, 3.17, 4.90, 9.14, e, c, [], P);
  wall('r1', 'z', 8.38, 8.45, T, 3.10, e, c, [{ a0: 1.65, a1: 2.38, y0: e, y1: d1 }], P); // dressing / chambre 1
  wall('r1', 'z', 9.07, 9.14, 3.17, 4.17, e, c, [{ a0: 3.35, a1: 4.10, y0: e, y1: d1 }], P); // palier / chambre 1
  wall('r1', 'x', 4.17, 4.24, T, L - T, e, c, [{ a0: 4.19, a1: 4.94, y0: e, y1: d1 }, { a0: 7.25, a1: 7.98, y0: e, y1: d1 }, { a0: 8.26, a1: 8.98, y0: e, y1: d1 }], P);
  wall('r1', 'z', 5.02, 5.09, 4.24, D - T, e, c, [], P); // chambre 3 / bureau
  wall('r1', 'z', 8.07, 8.14, 4.24, D - T, e, c, [], P); // bureau / chambre 2
  A.box('r1', 3.93, 4.08, e, c, T, 0.57, 'paint'); // décompression WC
  A.box('r1', 8.21, 8.38, e, c, 2.50, 3.10, 'paint'); // coffre vide garage → combles (plan p. 10 : x 8,21 → cloison, z 2,50 → 3,10), joue contre le placard du dressing côté palier

  // portes intérieures Righini Graphik (choix client) : [calque, axe du mur, milieu du mur, charnière, autre montant, sol, sens d'ouverture, épaisseur du mur]
  buildDoors([
    ['rdc', 'x', 1.395, 2.11, 1.38, 0, 1, 0.07], ['rdc', 'z', 5.235, 1.42, 2.30, 0, -1, 0.15], ['rdc', 'z', 7.045, 1.67, 2.55, -0.13, -1, 0.07], // porte de service, ouvrant côté local technique
    ['r1', 'z', 3.895, 3.03, 2.28, e, -1, 0.07], ['r1', 'x', 2.145, 4.75, 4.03, e, 1, 0.07], ['r1', 'z', 8.415, 1.65, 2.38, e, 1, 0.07],
    ['r1', 'z', 9.105, 4.10, 3.35, e, 1, 0.07], ['r1', 'x', 4.205, 4.94, 4.19, e, 1, 0.07], ['r1', 'x', 4.205, 7.98, 7.25, e, 1, 0.07], ['r1', 'x', 4.205, 8.26, 8.98, e, 1, 0.07],
  ]);
  buildClosets();

  buildStair();
}

// ---------------------------------------------------------------- portes intérieures et placards
// Righini Graphik : vantail laqué blanc à 4 rainures horizontales (photo client), huisserie et chambranles blancs,
// béquilles et rosaces gris anthracite. Les vantaux sont des groupes pivotants : un clic ouvre ou ferme la porte.
function buildDoors(list) {
  const hd = 2.04, t = 0.04, jb = 0.02, gap = 0.003, grooves = [0.43, 0.86, 1.29, 1.71];
  const mesh = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, M[m]); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  for (const [ly, ax, cc, h, o, y, side, tw] of list) {
    const sg = Math.sign(o - h), fl = ly; // portes rangées avec les murs de leur niveau (pas avec le mobilier)
    const UB = (u0, u1, y0, y1, w0, w1, m) => { const [a0, a1] = [Math.min(u0, u1), Math.max(u0, u1)], [b0, b1] = [Math.min(w0, w1), Math.max(w0, w1)];
      if (ax === 'x') A.box(fl, a0, a1, y0, y1, b0, b1, m); else A.box(fl, b0, b1, y0, y1, a0, a1, m); };
    // huisserie dans l'épaisseur du mur, chambranles de 6 cm sur les deux faces
    UB(h, h + sg * jb, y, y + hd, cc - tw / 2 - 0.002, cc + tw / 2 + 0.002, 'doorFrame');
    UB(o - sg * jb, o, y, y + hd, cc - tw / 2 - 0.002, cc + tw / 2 + 0.002, 'doorFrame');
    UB(h, o, y + hd - jb, y + hd, cc - tw / 2 - 0.002, cc + tw / 2 + 0.002, 'doorFrame');
    for (const sf of [1, -1]) { const f = cc + sf * tw / 2, f1 = f + sf * 0.012;
      UB(h - sg * 0.045, h + sg * 0.015, y, y + hd + 0.045, f, f1, 'doorFrame'); UB(o - sg * 0.015, o + sg * 0.045, y, y + hd + 0.045, f, f1, 'doorFrame');
      UB(h + sg * 0.015, o - sg * 0.015, y + hd - 0.015, y + hd + 0.045, f, f1, 'doorFrame'); }
    // vantail : repère local x = largeur (de la charnière vers la serrure), z = vers le côté d'ouverture, pivot sur l'arête de la charnière
    const U = ax === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), Wv = ax === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const pu = h + sg * (jb + gap), pw = cc + side * tw / 2;
    const outer = new THREE.Group(); const mtx = new THREE.Matrix4().makeBasis(U.clone().multiplyScalar(sg), new THREE.Vector3(0, 1, 0), Wv.clone().multiplyScalar(side));
    mtx.setPosition(ax === 'x' ? new THREE.Vector3(pu, y, pw) : new THREE.Vector3(pw, y, pu)); mtx.decompose(outer.position, outer.quaternion, outer.scale);
    const g = new THREE.Group(); outer.add(g); groups[fl].add(outer);
    const wd = Math.abs(o - h) - 2 * (jb + gap), lh = hd - jb - 0.012, meshes = [];
    // rainures dessinées dans une texture mipmappée des deux faces du vantail : les filets en relief (5 mm de haut, métalliques, 0,8 mm devant la laque)
    // tombaient sous le pixel et scintillaient au moindre mouvement de la vue ; chants du vantail renvoyés sur une zone unie de la texture
    if (!M.doorLeaf.map) { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 2048; const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, 4, 2048);
      for (const gy of grooves) { const py = Math.round((1 - (gy - 0.008) / lh) * 2048); cx.fillStyle = '#a3a6aa'; cx.fillRect(0, py - 2, 4, 1); cx.fillStyle = '#c4c7ca'; cx.fillRect(0, py - 1, 4, 3); cx.fillStyle = '#e9ebec'; cx.fillRect(0, py + 2, 4, 1); }
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = MAX_ANISO.v; M.doorLeaf.map = tx; M.doorLeaf.needsUpdate = true; }
    const lg = new THREE.BoxGeometry(wd, lh, t); for (let i = 0; i < 16; i++) lg.attributes.uv.setXY(i, 0.5, 0.01);
    meshes.push(mesh(g, lg, 'doorLeaf', wd / 2, 0.008 + lh / 2, -t / 2));
    for (const hy of [0.35, 1.08, 1.80]) mesh(g, new THREE.CylinderGeometry(0.0075, 0.0075, 0.10, 12), 'inox', 0, hy, 0.004);
    // béquilles sur rosaces rondes et rosaces de clé, gris anthracite, des deux côtés ; la béquille pointe vers la charnière
    const hx = wd - 0.065, hy = 1.02, rosG = new THREE.CylinderGeometry(0.026, 0.026, 0.009, 28), keyG = new THREE.CylinderGeometry(0.019, 0.019, 0.007, 24);
    const neckG = new THREE.CylinderGeometry(0.009, 0.009, 0.05, 16), levG = new THREE.CylinderGeometry(0.0095, 0.0095, 0.13, 16);
    for (const [zf, s] of [[0, 1], [-t, -1]]) {
      const r = mesh(g, rosG, 'handle', hx, hy, zf + s * 0.0045); r.rotation.x = Math.PI / 2;
      const k = mesh(g, keyG, 'handle', hx, hy - 0.075, zf + s * 0.0035); k.rotation.x = Math.PI / 2;
      mesh(g, new THREE.BoxGeometry(0.004, 0.012, 0.002), 'blackMatte', hx, hy - 0.075, zf + s * 0.0075);
      const n = mesh(g, neckG, 'handle', hx, hy, zf + s * 0.034); n.rotation.x = Math.PI / 2;
      const l = mesh(g, levG, 'handle', hx - 0.056, hy, zf + s * 0.052); l.rotation.z = Math.PI / 2;
      meshes.push(r, n, l);
    }
    // [perf] pièces du vantail fusionnées par matériau (22 maillages → 5) ; vantail, rainures et béquilles restent cliquables (charnières et entrées de clé non, comme avant)
    meshes.length = 0; for (const m of mergeStatic([...g.children], g)) if (m.material !== M.inox && m.material !== M.blackMatte) meshes.push(m);
    const d = { g, meshes, open: 0, target: 0 }; for (const m of meshes) m.userData.door = d;
    g.rotation.y = 0; DOORS.push(d); // fermées par défaut
  }
}
function animateDoors(dt) { // [perf] renvoie true si un ouvrant a bougé
  let mv = false;
  for (const d of DOORS) if (d.open !== d.target) { mv = true; d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * (d.speed ?? 1.6)); if (d.apply) d.apply(d.open); else d.g.rotation.y = -Math.PI / 2 * d.open; }
  return mv;
}
// Emplacements de placards des plans travaux v3 (p. 9 et 10), portes coulissantes gris clair pour les repérer :
// [calque, axe de la façade, nu de la façade (nez des retours), début, fin, sol, plafond, sens vers la pièce, profondeur jusqu'au fond, aménagement, début de l'intérieur]
// Façade logée dans l'emplacement, derrière le nu des retours (rails et vantaux ne débordent plus devant les retours ni dans les murs, 3 mm de jeu) ;
// chaque vantail (panneau pris dans deux montants alu, sans face coplanaire) est un groupe qui coulisse au clic devant ou derrière son voisin pour dégager
// sa travée (DOORS, kind 'placard' : pas d'ouverture automatique en balade), un seul vantail ouvert par placard. Intérieur ouvert en mélaminé blanc
// (murs en fond et en joues) : E étagères, P penderie (tablette à 1,80 m, tringle chromée dessous), M colonne d'étagères dans la première travée et penderie à côté.
function buildClosets() {
  const e = E1, c = H.r1Ceil, P = { neg: 'paint', pos: 'paint', end: 'paint', top: 'cut' };
  // retours de 65 cm dessinés aux plans pour les placards des chambres 2 et 3
  wall('r1', 'x', 5.22, 5.29, 8.14, 8.79, e, c, [], P);
  wall('r1', 'x', 5.22, 5.29, 4.37, 5.02, e, c, [], P);
  // dressing et chambre 1 (plan p. 10) : deux placards de 62 cm face à face de part et d'autre d'une allée de 80 cm, placard de la chambre 1
  // dans l'angle nord-est, chacun fermé côté ouest par un retour de 7 cm (plan p. 10 : z 1,50 → 1,57)
  wall('r1', 'x', 1.50, 1.57, 6.37, 6.99, e, c, [], P); wall('r1', 'x', 1.50, 1.57, 7.79, 8.38, e, c, [], P); wall('r1', 'x', 1.50, 1.57, 8.45, 9.10, e, c, [], P);
  const list = [
    ['rdc', 'z', 1.09, 2.65, 5.16, 0, H.rdcCeil, 1, 0.73, 'E', 2.43], // entrée : 2,73 × 0,65 (z 0,36 → 1,01) derrière le coffrage des colonnes WC / bains, façade de 8 cm devant, entre le coffrage et la cloison du garage
    ['r1', 'x', 9.10, 0.36, 1.50, e, c, 1, 0.65, 'P'], // chambre 1, dans l'angle contre le dressing
    ['r1', 'x', 7.79, 0.36, 1.50, e, c, -1, 0.59, 'P'], // dressing, placard côté chambre 1
    ['r1', 'x', 6.99, 0.36, 1.50, e, c, 1, 0.62, 'P'], // dressing, placard côté salle d'eau
    ['r1', 'z', 2.50, 6.37, 8.21, e, c, -1, 0.60, 'M'], // dressing, côté palier : 1,84 × 0,60 jusqu'au coffre du garage (plan : nu à z 2,50)
    ['r1', 'x', 8.79, 5.29, D - T, e, c, 1, 0.65, 'M'], // chambre 2
    ['r1', 'x', 4.37, 5.29, D - T, e, c, -1, 0.65, 'M'], // chambre 3
  ];
  const ov = 0.02, cl = 0.003, th = 0.019, dF = 0.102, sm = v => smooth(0, 1, v);
  M.closetChrome = std({ color: '#e1e4e7', metalness: 0.5, roughness: 0.2 }); // tringles chromées (métallicité modérée : peu d'environnement à refléter dans un placard)
  for (const [ly, ax, f, a0, a1, y0, y1, s, dp, kind, i0 = a0] of list) {
    const fl = ly === 'rdc' ? 'furn0' : 'furn1', U = ax === 'z' ? 'x' : 'z', yF = ly === 'rdc' ? y0 : y0 - 0.004; // dessus du parquet à l'étage
    // boîte en (u le long de la façade, y, d profondeur comptée depuis le nu vers le fond)
    const box = (acc, k, u0, u1, yy0, yy1, d0, d1, m) => ax === 'z' ? acc.box(k, u0, u1, yy0, yy1, f - s * d0, f - s * d1, m) : acc.box(k, f - s * d0, f - s * d1, yy0, yy1, u0, u1, m);
    const B = (...a) => box(A, fl, ...a);
    // rails haut et bas de 75 mm, de 3 à 78 mm derrière le nu, entre les retours
    B(a0 + cl, a1 - cl, y1 - 0.06, y1, 0.003, 0.078, 'closetRail');
    B(a0 + cl, a1 - cl, yF, y0 + 0.012, 0.003, 0.078, 'closetRail');
    // vantaux (≈ 0,90 m maxi) recouvrement 2 cm, course = travée − 2 recouvrements (jamais dans un retour ni dans le vantail voisin du même rail)
    const n = Math.max(2, Math.ceil((a1 - a0) / 0.92 - 1e-6)), A0 = a0 + cl, w = (a1 - a0 - 2 * cl) / n, tr = w - 2 * ov, yb = y0 + 0.016, yt = y1 - 0.064, sib = [];
    for (let i = 0; i < n; i++) {
      const u0 = A0 + i * w - (i > 0 ? ov : 0), u1 = A0 + (i + 1) * w + (i < n - 1 ? ov : 0), d0 = i % 2 ? 0.006 : 0.036; // vantaux impairs sur le rail avant
      const acc = new Acc(), g = new THREE.Group(); g.name = 'vantail de placard';
      box(acc, 'v', u0 + 0.010, u1 - 0.010, yb + 0.002, yt - 0.002, d0 + 0.004, d0 + 0.016, 'closetDoor'); // panneau 12 mm engagé dans les montants
      for (const uu of [u0, u1 - 0.016]) box(acc, 'v', uu, uu + 0.016, yb, yt, d0, d0 + 0.020, 'closetRail'); // montants alu 16 × 20
      acc.build({ v: g }); groups[fl].add(g);
      const dir = i < (n - 1) / 2 ? 1 : -1, meshes = g.children.slice();
      const d = { g, meshes, open: 0, speed: 1.1, kind: 'placard', apply: v => { g.position[U] = dir * tr * sm(v); } };
      let tg = 0; Object.defineProperty(d, 'target', { enumerable: true, get: () => tg, set: v => { tg = v; if (v > 0.5) for (const q of sib) if (q !== d) q.target = 0; } });
      for (const m of meshes) m.userData.door = d; sib.push(d); DOORS.push(d);
    }
    // intérieur : tablettes de 19 mm entre murs et séparations (1 mm de jeu), de 10 cm derrière le nu jusqu'à 2 mm du fond
    const I0 = i0 + 0.002, I1 = a1 - 0.002, dB = dp - 0.002, dm = (dF + dB) / 2, bk = k => A0 + k * w;
    const shelf = (u0, u1, h) => B(u0 + 0.001, u1 - 0.001, y0 + h - th, y0 + h, dF, dB, 'white');
    const sep = (u, h) => B(u - th / 2, u + th / 2, yF, y0 + h - th, dF, dB, 'white');
    const tube = (u0, u1, yc) => { const r = 0.0125; for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4, b = a + Math.PI / 4, am = a + Math.PI / 8; // tringle Ø 25 octogonale
      const Q = (u, an) => { const yy = yc + r * Math.sin(an), wv = f - s * (dm + r * Math.cos(an)); return ax === 'z' ? [u, yy, wv] : [wv, yy, u]; }, nw = -s * Math.cos(am), ny = Math.sin(am);
      A.quadN(fl, 'closetChrome', [Q(u0, a), Q(u1, a), Q(u1, b), Q(u0, b)], ax === 'z' ? [0, ny, nw] : [nw, ny, 0]); } };
    if (kind === 'E') { // entrée : une colonne d'étagères par vantail, tablette haute filante à 2,00 m
      for (let k = 1; k < n; k++) sep(bk(k), 2.00);
      for (let k = 0; k < n; k++) for (const h of [0.40, 0.80, 1.20, 1.60]) shelf(k ? bk(k) + th / 2 : I0, k < n - 1 ? bk(k + 1) - th / 2 : I1, h);
      shelf(I0, I1, 2.00);
    } else {
      shelf(I0, I1, 1.80); // tablette chapelière filante
      let r0 = I0;
      if (kind === 'M') { sep(bk(1), 1.80); for (const h of [0.36, 0.72, 1.08, 1.44]) shelf(I0, bk(1) - th / 2, h); r0 = bk(1) + th / 2; }
      tube(r0, I1, y0 + 1.80 - th - 0.055); // tringle 5,5 cm sous la tablette, au milieu de la profondeur utile
    }
  }
}

// ---------------------------------------------------------------- escalier
// Béton 1/4 tournant bas des plans travaux v3 (16 hauteurs de 17,9 cm, nez de la marche 1 à 31 cm du tableau de porte,
// arrivée +2,87) dans la version retenue par les clients : marche 1 débordante à angle arrondi, marches 2 à 5 légèrement
// balancées, marches en chêne clair, contremarches, joue et sous-face peintes, plinthe à crémaillère.
function buildStair() {
  const rise = H.r1Floor / 16, xs = 1.31, z0 = 3.03, zs = 3.27, zf = 4.17, xE = 3.91, go = (xE - xs) / 11, rw = 0.45;
  const tt = 0.03, ov = 0.02; // marche bois de 30 mm, nez de marche de 2 cm sur la contremarche peinte
  // ligne de foulée à 45 cm du jour
  const W = j => { if (j <= 1) return [xs - rw, z0 + j * (zs - z0)]; if (j <= 4) { const a = Math.PI - (j - 1) * Math.PI / 6; return [xs + rw * Math.cos(a), zs + rw * Math.sin(a)]; } return [xs + (j - 4) * go, zs + rw]; };
  // départs des nez côté jour : 4,5 / 5,3 / 6,3 / 7,5 cm d'emmarchement au jour pour les marches 2 à 5
  const U = [0, 0.24, 0.285, 0.338, 0.401];
  const I = j => { const u = j <= 4 ? U[j] : 0.24 + (j - 4) * go; return u <= 0.24 ? [xs, z0 + u] : [xs + u - 0.24, zs]; };
  const O = j => { const i = I(j), w = W(j), dx = w[0] - i[0], dz = w[1] - i[1];
    if (dx < -1e-6) { const t = (T - i[0]) / dx, z = i[1] + t * dz; if (z <= zf) return [T, z]; }
    const t = (zf - i[1]) / dz; return [i[0] + t * dx, zf]; };
  const vOut = p => Math.abs(p[0] - T) < 1e-6 ? p[1] - z0 : (zf - z0) + p[0] - T;
  const sof = x => Math.max(0, rise * (4 + (x - xs) / go) - 0.19); // paillasse de 15 cm sous la volée droite
  const sn = new THREE.Vector3(rise, -go, 0).normalize();
  const steps = [];
  // marche 1 débordante (15 cm, angle arrondi R 12 cm) : [point, nature de l'arête qui en part]
  { const d = 0.15, rc = 0.12, pts = [[[T, z0], 'nose']];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push([[xs + d - rc + rc * Math.cos(a), z0 + rc + rc * Math.sin(a)], 'nose']); }
    pts.push([[xs + d, zs], 'back'], [[T, zs], 'wall']); steps.push(pts); }
  for (let k = 2; k <= 15; k++) {
    const pts = [[I(k - 1), 'nose']]; const o0 = O(k - 1), o1 = O(k);
    pts.push([o0, 'wall']); if (vOut(o0) < zf - z0 - 1e-6 && vOut(o1) > zf - z0 + 1e-6) pts.push([[T, zf], 'wall']);
    pts.push([o1, 'back'], [I(k), 'side']);
    steps.push(pts.filter((q, i, arr) => dist2(q[0], arr[(i + 1) % arr.length][0]) > 1e-6));
  }
  const V = (p, y) => [p[0], y, p[1]];
  const outN = (pts, i) => { // normale horizontale sortante de l'arête i
    const a = pts[i][0], b = pts[(i + 1) % pts.length][0]; let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    const c = pts.reduce((m, q) => [m[0] + q[0][0] / pts.length, m[1] + q[0][1] / pts.length], [0, 0]);
    if ((c[0] - a[0]) * nx + (c[1] - a[1]) * nz > 0) { nx = -nx; nz = -nz; } return [nx, nz]; };
  const offsetPoly = (pts, off) => pts.map((q, i) => { // décalage des arêtes (onglets)
    const n = pts.length, ip = (i - 1 + n) % n;
    const L1 = (j) => { const a = pts[j][0], b = pts[(j + 1) % n][0], nn = outN(pts, j), o = off(pts[j][1]); return [[a[0] + nn[0] * o, a[1] + nn[1] * o], [b[0] - a[0], b[1] - a[1]]]; };
    const [p1, d1] = L1(ip), [p2, d2] = L1(i); const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) { const nn = outN(pts, i), o = off(pts[i][1]); return [q[0][0] + nn[0] * o, q[0][1] + nn[1] * o]; }
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den; return [p1[0] + d1[0] * t, p1[1] + d1[1] * t]; });
  steps.forEach((pts, idx) => {
    const k = idx + 1, top = k * rise, massif = k <= 5, n = pts.length;
    const bot = p => massif ? 0 : sof(p[0]);
    // noyau béton peint en blanc (contremarches, joue au jour, sous-face) ; marches habillées de chêne clair
    for (let i = 0; i < n; i++) {
      const [a, kind] = pts[i], b = pts[(i + 1) % n][0];
      const mat = kind === 'nose' || kind === 'side' || (kind === 'back' && k === 5) ? 'stairPaint' : null;
      if (!mat) continue; const nn = outN(pts, i);
      A.quadN('rdc', mat, [V(a, bot(a)), V(b, bot(b)), V(b, top - tt), V(a, top - tt)], [nn[0], 0, nn[1]]);
    }
    if (!massif) A.polyN('rdc', 'stairPaint', pts.map(q => V(q[0], bot(q[0]))), [sn.x, sn.y, 0]);
    // marche en chêne avec nez débordant
    const tp = offsetPoly(pts, kind => kind === 'nose' ? ov : 0);
    A.polyN('rdc', 'stairTile', tp.map(q => V(q, top)), [0, 1, 0]);
    A.polyN('rdc', 'stairTile', tp.map(q => V(q, top - tt)), [0, -1, 0]);
    for (let i = 0; i < n; i++) {
      if (pts[i][1] === 'wall' || pts[i][1] === 'back') continue;
      const a = tp[i], b = tp[(i + 1) % n], nn = outN(pts, i);
      A.quadN('rdc', 'stairTile', [V(a, top - tt), V(b, top - tt), V(b, top), V(a, top)], [nn[0], 0, nn[1]]);
    }
    // plinthe à crémaillère (7 cm) peinte en blanc le long des murs
    for (let i = 0; i < n; i++) {
      if (pts[i][1] !== 'wall') continue; const a = pts[i][0], b = pts[(i + 1) % n][0], nn = outN(pts, i), e = 0.009;
      const a2 = [a[0] - nn[0] * e, a[1] - nn[1] * e], b2 = [b[0] - nn[0] * e, b[1] - nn[1] * e];
      A.quadN('rdc', 'stairPaint', [V(a2, top), V(b2, top), V(b2, top + 0.07), V(a2, top + 0.07)], [-nn[0], 0, -nn[1]]);
      A.quadN('rdc', 'stairPaint', [V(a, top + 0.07), V(b, top + 0.07), V(b2, top + 0.07), V(a2, top + 0.07)], [0, 1, 0]);
    }
  });
}

// ---------------------------------------------------------------- toiture 4 pans 35°
function hipRoof(layer, x0, x1, z0, z1, ye, pitch, mat) {
  const t = Math.tan(pitch * Math.PI / 180);
  const run = Math.min(x1 - x0, z1 - z0) / 2; const yr = ye + run * t;
  const zr = (z0 + z1) / 2, rx0 = x0 + run, rx1 = x1 - run;
  const faces = [
    [[x0, ye, z0], [x1, ye, z0], [rx1, yr, zr], [rx0, yr, zr]],
    [[x1, ye, z1], [x0, ye, z1], [rx0, yr, zr], [rx1, yr, zr]],
    [[x0, ye, z1], [x0, ye, z0], [rx0, yr, zr]],
    [[x1, ye, z0], [x1, ye, z1], [rx1, yr, zr]],
  ];
  const pos = [], uv = [];
  const V = a => new THREE.Vector3(...a);
  for (const f of faces) {
    const p0 = V(f[0]), p1 = V(f[1]); const e = p1.clone().sub(p0).normalize();
    const c = f.length === 4 ? V(f[3]) : V(f[2]); const up = c.clone().sub(p0); up.sub(e.clone().multiplyScalar(up.dot(e))).normalize();
    const tri = f.length === 4 ? [[0, 2, 1], [0, 3, 2]] : [[0, 2, 1]];
    for (const tr of tri) for (const i of tr) { const p = V(f[i]); pos.push(p.x, p.y, p.z); const r = p.clone().sub(p0); uv.push(r.dot(e), r.dot(up)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M[mat]); m.castShadow = m.receiveShadow = true; groups[layer].add(m);
  return { yr, zr, rx0, rx1 };
}
function buildRoof() {
  // débords 30 cm au nord, au sud et à l'ouest ; gouttière havraise en limite (est) ; égout +5,67, faîtage +8,54
  const x0 = -0.30, x1 = L + 0.30, z0 = 0, z1 = D + 0.30, ye = H.eave;
  const { yr, zr, rx0, rx1 } = hipRoof('roof', x0, x1, z0, z1, ye, 35, 'roof');
  const V = a => new THREE.Vector3(...a);
  // faîtage et arêtiers en tuiles demi-rondes
  const lines = [[[rx0, yr, zr], [rx1, yr, zr]], [[rx0, yr, zr], [x0, ye, z0]], [[rx0, yr, zr], [x0, ye, z1]], [[rx1, yr, zr], [x1, ye, z0]], [[rx1, yr, zr], [x1, ye, z1]]];
  for (const [a, b] of lines) {
    const va = V(a), vb = V(b); const len = va.distanceTo(vb);
    const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, len, 10), M.ridge);
    cm.position.copy(va).add(vb).multiplyScalar(0.5); cm.position.y += 0.03;
    cm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()); cm.castShadow = true; groups.roof.add(cm);
  }
  // sous-faces, cache-moineaux PVC anthracite
  A.box('roof', x0, 0, 5.47, 5.49, z0, z1, 'soffit');
  A.box('roof', L, x1, 5.47, 5.49, z0, z1, 'soffit');
  A.box('roof', 0, L, 5.47, 5.49, D, z1, 'soffit');
  A.box('roof', x0, x0 + 0.025, 5.47, ye + 0.02, z0, z1, 'soffit');
  A.box('roof', x1 - 0.025, x1, 5.47, ye + 0.02, z0, z1, 'soffit');
  A.box('roof', x0, x1, 5.47, ye + 0.02, z1 - 0.025, z1, 'soffit');
  // gouttières moulurées alu 7016
  const gut = (bx0, bx1, bz0, bz1) => { A.box('roof', bx0, bx1, ye - 0.10, ye + 0.03, bz0, bz1, 'alu'); };
  gut(x0 - 0.13, x0, z0, z1 + 0.13); gut(x1, x1 + 0.13, z0, z1 + 0.13); gut(x0, x1, z1, z1 + 0.13);
  A.box('roof', 0, L, ye, ye + 0.11, -0.02, 0.18, 'alu'); // gouttière havraise en limite (+5,78)
  // descentes rectangulaires alu 7016 : NO et SO (façade ouest), NE (pignon nord), SE (pignon sud)
  const dp = (x, z, yTop) => A.box('rdc', x - 0.04, x + 0.04, -0.6, yTop, z - 0.03, z + 0.03, 'alu');
  dp(0.42, D + 0.05, ye - 0.15); A.box('roof', 0.38, 0.46, ye - 0.25, ye - 0.10, D + 0.02, z1 + 0.07, 'alu');
  dp(L - 0.42, D + 0.05, ye - 0.15); A.box('roof', L - 0.46, L - 0.38, ye - 0.25, ye - 0.10, D + 0.02, z1 + 0.07, 'alu');
  A.box('rdc', -0.08, -0.02, -0.6, ye + 0.05, 0.08, 0.16, 'alu');
  A.box('rdc', L + 0.02, L + 0.08, -0.6, ye + 0.05, 0.20, 0.28, 'alu');
}

// ---------------------------------------------------------------- équipements et mobilier (indicatif hors plans)
function buildFurniture() {
  const f0 = 'furn0', f1 = 'furn1', e = E1;
  const B = (l, x0, x1, y0, y1, z0, z1, m) => A.box(l, x0, x1, y0, y1, z0, z1, m);

  // cuisine, séjour, chambres, bureau, radiateurs et lave-linge : mobilier.js ; PAC : equip.js ; salles de bains et WC : bains.js
  // --- Local technique et garage : tableau, accès VS
  B(f0, 5.31, 5.43, 0.95, 1.85, 2.42, 2.88, 'white'); // tableau électrique, entre la porte ISO 83 et le poteau BA (nourrice : equip.js)
  B(f0, 10.60, 11.20, -0.13, -0.122, 1.50, 2.10, 'inox');

  // placards : intérieurs (tablettes, séparations, tringles) et façades coulissantes dans buildClosets (les blocs blancs pleins d'avant débordaient de 17 cm devant les retours des chambres 2 et 3)

  // --- Salle de bains commune (« Bains ») : douche 160×90 Geberit Olona dans l'angle ; sèche-serviettes Atlantic Adélis des deux salles d'eau : bains.js
  // faïence 12,25 m² (notice) : murs des deux douches sur 2,10 m
  B(f1, 2.26, 3.86, e, e + 2.10, T, T + 0.008, 'faience'); B(f1, 3.852, 3.86, e, e + 2.10, T, 1.26, 'faience');
}

// ---------------------------------------------------------------- terrain et abords
// Limites (plan de masse PCMI 2) : B angle de muret nord-est, A nord-ouest (rue), D sud-ouest (angle des rues), C sud-est
const BND = { A: [-11.53, 12.50], B: [-11.46, 0], C: [19.41, 0], D: [19.52, 13.70] };
const zWest = x => BND.A[1] + (BND.D[1] - BND.A[1]) * (x - BND.A[0]) / (BND.D[0] - BND.A[0]);
const xSouth = z => BND.C[0] + (BND.D[0] - BND.C[0]) * z / BND.D[1];
// points altimétriques (plan de bornage + plan de masse), relatifs au RDC 55,70
const PTS = [
  [-10.4, 0.85, -0.15], [-9.9, 6.2, -0.06], [-10.6, 11.7, 0.08], [-11.6, 12.6, 0.37],
  [17.9, 0.8, -0.76], [17.5, 6.2, -0.54], [1.3, 12.0, -0.21], [10.6, 12.0, -0.36], [18.5, 12.3, -0.46], [19.5, 13.7, -0.50], [19.9, 10.2, -0.75],
  [0, 0, -0.47], [0, D, -0.29], [L, D, -0.44], [L, 0, -0.65],
  [-11.0, 13.3, 0.24], [-3.9, 13.0, 0.13], [-3.9, 13.7, 0.03], [-11.0, 14.6, 0.23], [-4.4, 15.5, 0.07], [4.6, 14.4, -0.16], [4.0, 16.0, -0.13], [4.0, 17.3, -0.17], [4.0, 18.3, -0.14],
  [17.3, 14.6, -0.67], [16.6, 16.0, -0.65], [17.0, 17.4, -0.70], [18.4, 19.8, -0.57], [18.6, 15.5, -0.72], [-12.6, 16.5, 0.18], [-12.5, 18.0, 0.27],
  [21.4, 0.0, -0.88], [24.7, 0.4, -0.91], [21.9, 9.0, -0.85], [23.6, 8.8, -0.88], [24.6, 8.7, -0.78], [21.0, 14.6, -0.76], [23.9, 16.0, -0.73],
];
let PLANE = [0, 0, 0];
function fitPlane() {
  let s = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
  for (const [x, z, h] of PTS) { const v = [x, z, 1]; for (let i = 0; i < 3; i++) { r[i] += v[i] * h; for (let j = 0; j < 3; j++) s[i][j] += v[i] * v[j]; } }
  // Cramer
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(s); PLANE = [0, 1, 2].map(k => det(s.map((row, i) => row.map((v, j) => j === k ? r[i] : v))) / d);
}
const planeAt = (x, z) => PLANE[0] * clamp(x, -45, 45) + PLANE[1] * clamp(z, -35, 40) + PLANE[2];
// jardin de pluie 14 m² en haricot, plus épais dans l'angle sud-ouest (demande des clients du 11/10/2026), pourtour à 55,20, fond 30 cm plus bas (54,90)
const RAIN = [[18.35, 5.3], [18.35, 6.25], [18.35, 7.2], [18.35, 8.15], [18.35, 9.1], [18.35, 10.05], [18.35, 11.0], [18.34, 11.21], [18.3, 11.41], [18.23, 11.61], [18.14, 11.8], [18.02, 11.97], [17.88, 12.13], [17.72, 12.27], [17.55, 12.39], [17.36, 12.48], [17.16, 12.55], [16.96, 12.59], [16.75, 12.6], [16.39, 12.6], [16.03, 12.6], [15.68, 12.6], [15.32, 12.6], [14.96, 12.6], [14.6, 12.6], [14.42, 12.56], [14.26, 12.46], [14.16, 12.31], [14.12, 12.12], [14.16, 11.94], [14.26, 11.79], [14.42, 11.69], [14.6, 11.65], [14.84, 11.57], [15.08, 11.46], [15.3, 11.33], [15.51, 11.17], [15.71, 10.99], [15.9, 10.79], [16.08, 10.56], [16.25, 10.3], [16.4, 10.02], [16.55, 9.72], [16.68, 9.39], [16.81, 9.03], [16.92, 8.65], [17.02, 8.25], [17.11, 7.82], [17.19, 7.36], [17.26, 6.89], [17.32, 6.38], [17.36, 5.85], [17.4, 5.3], [17.44, 5.12], [17.54, 4.96], [17.69, 4.86], [17.88, 4.83], [18.06, 4.86], [18.21, 4.96], [18.31, 5.12]]; // haricot de 14 m², plus épais dans l'angle sud-ouest
function polyInfo(poly, x, z) {
  let inside = false, dmin = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    const dx = xj - xi, dz = zj - zi, l2 = dx * dx + dz * dz; const t = clamp(((x - xi) * dx + (z - zi) * dz) / l2, 0, 1);
    dmin = Math.min(dmin, Math.hypot(x - xi - t * dx, z - zi - t * dz));
  }
  return { inside, d: dmin };
}
function baseH(x, z) {
  let sw = 0, sv = 0;
  for (const [px, pz, v] of PTS) { const d2 = (x - px) ** 2 + (z - pz) ** 2; const w = 1 / (d2 + 1.5) ** 1.6; sw += w; sv += w * (v - planeAt(px, pz)); }
  return planeAt(x, z) + sv / sw;
}
// Terrain fini (clients, 11/10/2026) : 55,53 (−0,17) au pied de la maison et sur toute la partie ouest et sud,
// pente douce jusqu'au pourtour du jardin de pluie à 55,20 (−0,50), palier de 1 m à 55,53 devant la porte-fenêtre sud,
// descente de garage du seuil du garage (−0,13) au seuil du portail coulissant (−0,80, niveau de la rue)
const TF = -0.17, TF_RAIN = -0.50;
const driveH = x => -0.13 + (-0.80 + 0.13) * clamp((x - L) / (19.25 - L), 0, 1);
const surfAllee = x => driveH(x) + 0.025; // dessus fini de l'allée : le gravillon est posé 2,5 cm au-dessus du terrain
// Allée du garage, jardin et portail coulissant (demandes de Sébastien du 11/10/2026) :
// - muret allée / jardin déplacé de 20 cm vers l'allée : nu côté allée à z 3,77, épaisseur 15 cm (porte de garage, z 0,43 → 2,93, dégagée) ;
// - seuil du portail coulissant en béton enduit ton pierre, de la limite + 0,20 à + 0,62 (+ 0,80 dans la niche du moteur), sur toute la course du vantail ;
//   muret de soutènement le long du seuil (t 0,62 → 0,80), décroché en niche derrière le moteur (t 0,80 → 0,98, s 9,25 → angle des murets)
//   et retourné jusqu'à la clôture au bout de la course (retour z 7,80 → 8,00), dessus horizontal à la hauteur du bout du muret allée / jardin ;
// Reprise du muret et de la marche (Sébastien, 12/10/2026) :
// - muret allée / jardin du nu de l'enduit de la façade sud jusqu'à la niche du moteur du portail ; dessus et chaperon rectilignes,
//   à pente constante de 6,5 % (+0,03 au nu de la façade, −0,33 au bout), sans suivre le terrain : 10 cm au moins au-dessus du sol
//   le plus haut de part et d'autre (allée près de la maison, pelouse ensuite), 18 cm au plus ; c'est le pied qui s'adapte au sol ;
// - marche dans le muret : passage de 0,80 m centré à 2,00 m de la façade sud, contremarche au nu côté allée (aucun débord sur le gravillon),
//   giron de 25 cm (épaisseur du muret + 10 cm côté jardin) au niveau de la pelouse, presque à plat (2 % vers le portail, juste pour l'eau ;
//   choix du client du 12/10), 10 cm sous le dessus du muret au milieu du passage.
const MUR = { z: 3.77, e: 0.15, y0: 0.03, k: -0.065 };
const murY = x => MUR.y0 + MUR.k * (x - L); // dessus du muret allée / jardin (sous le chaperon de 3 cm)
const SEUIL = { t0: 0.20, t1: 0.62, tn: 0.80, tm: 0.98, zRet: 8.00, zNiche: 4.45 }; // profondeurs t depuis la limite sud ; zNiche : bout de la niche (s 9,25)
const MARCHE = { x0: L + 1.60, x1: L + 2.40, zB: MUR.z + 0.25, dJ: 0.10 };
MARCHE.xc = (MARCHE.x0 + MARCHE.x1) / 2;
// dessus du giron, pente de 2 % vers le portail : contremarche de 8 cm côté maison à 15 cm côté portail au-dessus du gravillon (l'allée descend de 10,5 %)
const marcheY = x => murY(MARCHE.xc) - MARCHE.dJ - 0.02 * (x - MARCHE.xc);
function gardenH(x, z) {
  const ri = polyInfo(RAIN, x, z);
  if (ri.inside) return TF_RAIN - 0.30 * smooth(0, 0.40, ri.d); // cuvette d'infiltration : fond 30 cm sous le pourtour (demande client du 12/10), talus de 40 cm
  const h = TF_RAIN + (TF - TF_RAIN) * smooth(0, 3.4, ri.d);
  const dH = Math.hypot(Math.max(-x, 0, x - L), Math.max(-z, 0, z - D));
  return h + (TF - h) * (1 - smooth(1.0, 1.5, dH));
}
function hAt0(x, z) {
  let h = baseH(x, z);
  // voisin est : jardin surélevé derrière son mur de soutènement en limite
  if (z < -0.18) h += 0.85 * smooth(-0.18, -0.4, z) * smooth(-28, -26, x) * (1 - smooth(19.0, 19.3, x));
  h = envGround(x, z, h); // fosse de son allée de garage en sous-sol, le long de la limite (env.js)
  const dS = Math.min(zWest(x) - z, xSouth(z) - x), dN = x - BND.A[0];
  if (dS > 0 && z > -0.05 && dN > 0) {
    // seuil du portail coulissant et zone de refoulement, jusqu'au nu côté jardin du muret de soutènement (niche du moteur comprise) ;
    // allée jusqu'au nu côté jardin du muret allée / jardin : les ressauts du maillage du terrain restent dans l'épaisseur des murets
    const slide = z < SEUIL.zRet && x > xSouth(z) - (z < SEUIL.zNiche ? SEUIL.tm : SEUIL.tn);
    let tf;
    if (x > L - 0.01 && (z < MUR.z + MUR.e || slide)) tf = driveH(x);
    else { // jardin ; pelouse au niveau du giron de la marche à son bord arrière et sur ses côtés, raccordée sur 50 cm ; sous le giron : 3 cm plus bas
      tf = gardenH(x, z);
      const dm = Math.hypot(Math.max(0, Math.abs(x - MARCHE.xc) - (MARCHE.x1 - MARCHE.x0) / 2), Math.max(0, z - MARCHE.zB));
      tf = dm > 0 ? tf + (marcheY(x) - tf) * (1 - smooth(0, 0.5, dm)) : marcheY(x) - 0.03;
    }
    tf += (h - tf) * smooth(-2.5, -7.5, x); // jardin nord : raccord au terrain naturel
    if (x > -2.6 && x < -0.4) tf += (h - tf) * (1 - smooth(0.2, 2.2, dS)); // abords de l'allée : rampe douce vers le portillon
    const pocket = slide && dS > 0.01; // seuil du portail et poche de refoulement : terrain au niveau du seuil jusqu'à la limite (le raccord au trottoir se fait au nu de la limite)
    h += (tf - h) * (pocket ? 1 : smooth(0, 0.22, dS)) * smooth(-0.05, 0.05, z) * smooth(0, 0.3, dN);
  }
  return h;
}
// allée piétonne bordurée (choix client) : NGF 55,60 (−0,10) près de l'entrée, légère pente montant vers le portillon (trottoir plus haut)
const PATH = { x0: -2.0, x1: -1.01, xd: -0.80, z0: 1.79, z1: 2.79, top: -0.10 };
let PATH_END = null;
function pathTop(z) {
  if (PATH_END === null) PATH_END = hAt0(-1.5, zWest(-1.5));
  const zf = zWest(-1.5); return PATH.top + (PATH_END - PATH.top) * clamp((z - (PATH.z1 + 0.05)) / (zf - PATH.z1 - 0.05), 0, 1);
}
function hAt(x, z) {
  const inLeg = x > PATH.x0 - 0.06 && x < PATH.x1 + 0.06 && z > PATH.z0 - 0.06 && z < zWest(x) - 0.02;
  const inBranch = x > PATH.x0 - 0.06 && x < PATH.xd && z > PATH.z0 - 0.06 && z < PATH.z1 + 0.06;
  if (inLeg || inBranch) return pathTop(z) - 0.03;
  return hAt0(x, z);
}

function overlayQuad(layer, mat, c, lift, nu, nv) { // c : [[x,z]x4] p00 p10 p11 p01
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    const x = (c[0][0] * (1 - u) + c[1][0] * u) * (1 - v) + (c[3][0] * (1 - u) + c[2][0] * u) * v;
    const z = (c[0][1] * (1 - u) + c[1][1] * u) * (1 - v) + (c[3][1] * (1 - u) + c[2][1] * u) * v;
    pos.push(x, hAt(x, z) + lift, z); uv.push(x, -z);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, cc = a + nu + 2, d = a + nu + 1; idx.push(a, d, cc, a, cc, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // orientation : les normales doivent pointer vers le haut
  const n = g.attributes.normal; if (n.count && n.getY(0) < 0) { g.setIndex(idx.map((v, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); g.computeVertexNormals(); }
  const m = new THREE.Mesh(g, M[mat]); m.receiveShadow = true; groups[layer].add(m); return m;
}
function overlayPoly(layer, mat, poly, lift, res, snap = false) { // polygone quelconque, découpé sur une grille fine ; snap : sommets extérieurs ramenés sur le contour (bord lisse, sans dents de scie)
  const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res);
  const pos = [], uv = [], idx = []; const id = new Map();
  const near = (x, z) => { let b = null, bd = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))), px = ax + t * dx, pz = az + t * dz, d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; b = [px, pz]; } } return b; };
  const vtx = (i, j) => { const k = i + ',' + j; if (id.has(k)) return id.get(k); let x = x0 + i * res, z = z0 + j * res; if (snap && !polyInfo(poly, x, z).inside) [x, z] = near(x, z); pos.push(x, hAt(x, z) + lift, z); uv.push(x, -z); id.set(k, pos.length / 3 - 1); return id.get(k); };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * res, cz = z0 + (j + 0.5) * res;
    if (!polyInfo(poly, cx, cz).inside) continue;
    const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i + 1, j + 1), d = vtx(i, j + 1); idx.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M[mat]); m.receiveShadow = true; groups[layer].add(m); return m;
}

function buildSite() {
  fitPlane();
  // sol
  for (const [size, seg, drop] of [[600, 150, 0.08], [72, 360, 0.01]]) {
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2); g.translate(4, 0, 5);
    const p = g.attributes.position; const uv = g.attributes.uv;
    // maillage du lointain (mailles de 4 m) abaissé autour de la fosse du voisin est, et de 80 cm sous l'emprise du maillage fin : sinon, dans les creux (poche du portail, jardin de pluie), il le traverse ;
    // maillage fin (pas de 20 cm) : 7 cm sous le paillage dans la cuvette du jardin de pluie, dont les cordes des talus raides perceraient le paillage
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), sous = size > 100 && Math.abs(x - 4) < 35 && Math.abs(z - 5) < 35; const pluie = seg === 360 && x > 14 && x < 18.4 && z > 4.7 && z < 12.7 && polyInfo(RAIN, x, z).inside;
      p.setY(i, (seg === 150 ? envGround(x, z, hAt(x, z), 4.5) : hAt(x, z)) - drop - (sous ? 0.8 : 0) - (pluie ? 0.07 : 0)); uv.setXY(i, x, -z); }
    g.computeVertexNormals(); const ground = new THREE.Mesh(g, M.grass); ground.receiveShadow = true; groups.site.add(ground);
  }
  // rue des Merlettes, branche ouest le long de la limite A–D (profil, bordures, trottoir, carrefour, mobilier) : rue.js ; rue des Fauvettes, branche sud le long de C–D
  // branche sud : droite le long de la limite C–D jusqu'au cerisier du voisin est, puis virage vers le sud (plan Google, vue aérienne, photos 9 et 11)
  const xq = (z, o) => [xSouth(z) + o, z], K = [27.785, 1.425], R0 = K[0] - xSouth(K[1]); // centre du virage (rayon 5,50 à l'axe), rayon du bord nord
  // pas de trottoir le long de notre clôture sud : la chaussée vient jusqu'au mur (client, 12/10) ; le trottoir ne commence qu'au pilier sud-est, dans l'angle du virage
  overlayQuad('site', 'asphalt', [xq(K[1], 0), xq(K[1], 0.45), xq(zWest(19.9), 0.45), xq(zWest(19.5), 0)], 0.045, 2, 26);
  overlayQuad('site', 'asphalt', [xq(K[1], 0.45), xq(K[1], 5.3), xq(zWest(24.8) + 5.3, 5.3), xq(zWest(19.9) + 5.3, 0.45)], 0.045, 6, 26);
  overlayQuad('site', 'curb', [xq(K[1], 5.3), xq(K[1], 6.4), xq(zWest(25.9), 6.4), xq(zWest(24.8), 5.3)], 0.09, 2, 26);
  { // virage et branche vers le sud jusqu'en x 60 ; o : décalage depuis le bord nord de la rue droite (0 = limite, 0,45 → 5,30 chaussée)
    // côté extérieur, trottoir à partir de notre pilier sud-est jusqu'aux clôtures du voisin (mur sud en x 19,41, plaques en z −7,66) ; côté intérieur, bordure de 1,10 réduite à 0,45
    const tC = Math.asin(K[1] / R0) / (Math.PI / 2); // droit du pilier sud-est de notre clôture (z 0) : début du trottoir
    const T = [...Array(31).keys()].map(i => i / 30).concat([...Array(16).keys()].map(i => 1 + (i + 1) / 16), Math.atan2(K[1] + 7.62, R0) / (Math.PI / 2), tC, tC + 1e-4).sort((p, q) => p - q); // + angle des clôtures
    const at = (t, o) => { if (t > 1) return [K[0] + (t - 1) * (60 - K[0]), K[1] - R0 + o]; const a = t * Math.PI / 2, r = R0 - o; return [K[0] - r * Math.cos(a), K[1] - r * Math.sin(a)]; };
    const out = t => { if (t > 1) return R0 - K[1] - 7.62; const a = t * Math.PI / 2; return R0 - Math.min((K[0] - xSouth(K[1])) / Math.max(Math.cos(a), 1e-6), (K[1] + 7.62) / Math.max(Math.sin(a), 1e-6)); };
    const strip = (mat, lift, o0, o1, nu, TT = T) => {
      const pos = [], uv = [], idx = [];
      TT.forEach((t, j) => { for (let i = 0; i <= nu; i++) { const a = o0(t), [x, z] = at(t, a + (o1(t) - a) * i / nu); pos.push(x, hAt(x, z) + lift, z); uv.push(x, -z); }
        if (j) for (let i = 0; i < nu; i++) { const a = (j - 1) * (nu + 1) + i, d = a + nu + 1; idx.push(a, d, d + 1, a, d + 1, a + 1); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      if (g.attributes.normal.getY(0) < 0) { g.setIndex(idx.map((v, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); g.computeVertexNormals(); }
      const m = new THREE.Mesh(g, M[mat]); m.receiveShadow = true; groups.site.add(m);
    };
    strip('asphalt', 0.045, t => t <= tC ? out(t) : 0.45, () => 5.3, 6);
    strip('curb', 0.055, out, () => 0.45, 2, T.filter(t => t > tC));
    strip('curb', 0.09, () => 5.3, t => 6.4 - 0.66 * smooth(0, 1, t), 2);
  }
  // allée gravillonnée (1,00 m) du portillon à la porte d'entrée, et place de stationnement en gravillon devant le garage
  overlayQuad('site', 'gravel', [[PATH.x0, PATH.z0], [PATH.x1, PATH.z0], [PATH.x1, zWest(PATH.x1) - 0.02], [PATH.x0, zWest(PATH.x0) - 0.02]], 0.03, 4, 60);
  overlayQuad('site', 'gravel', [[PATH.x1, PATH.z0], [PATH.xd, PATH.z0], [PATH.xd, PATH.z1], [PATH.x1, PATH.z1]], 0.03, 2, 4);
  // bordures béton 5 cm de chaque côté, arasées 2 cm au-dessus de l'allée
  const border = (x0, x1, z0, z1) => { const n = Math.max(1, Math.round((z1 - z0) / 0.5)); for (let i = 0; i < n; i++) { const za = z0 + (z1 - z0) * i / n, zb = z0 + (z1 - z0) * (i + 1) / n, t = pathTop((za + zb) / 2);
    A.box('site', x0, x1, t - 0.20, t + 0.02, za, zb, 'curbStone'); } };
  border(PATH.x0 - 0.05, PATH.x0, PATH.z0 - 0.05, zWest(PATH.x0) - 0.03);
  border(PATH.x1, PATH.x1 + 0.05, PATH.z1, zWest(PATH.x1) - 0.03);
  A.box('site', PATH.x0 - 0.05, PATH.xd, PATH.top - 0.20, PATH.top + 0.02, PATH.z0 - 0.05, PATH.z0, 'curbStone');
  A.box('site', PATH.x1, PATH.xd, PATH.top - 0.20, PATH.top + 0.02, PATH.z1, PATH.z1 + 0.05, 'curbStone');
  // dalle de seuil de la porte d'entrée 1,20 × 0,80 (porte 90 + modénatures 2 × 15) à NGF 55,65 (−0,05), teinte du seuil gris galet
  A.box('site', -0.80, 0, -0.22, -0.05, 1.67, 2.87, 'galet');
  // auvent moderne alu 7016, 1,20 m × 0,90 m, avec spot LED intégré en sous-face
  A.box('rdc', -0.90, 0, 2.42, 2.52, 1.67, 2.87, 'alu'); A.box('rdc', -0.90, -0.88, 2.39, 2.42, 1.67, 2.87, 'alu'); // aligné sur les modénatures (90 + 2 × 15)
  { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.006, 24), M.spotLed); sp.position.set(-0.45, 2.418, 2.27); groups.rdc.add(sp);
    const rg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.004, 24), M.inox); rg.position.set(-0.45, 2.419, 2.27); groups.rdc.add(rg); }
  overlayQuad('site', 'gravel', [[L + 0.002, 0.03], [xSouth(0.03) - SEUIL.t1, 0.03], [xSouth(MUR.z) - SEUIL.t1, MUR.z], [L + 0.002, MUR.z]], 0.025, 26, 16); // jusqu'au muret et au seuil du portail
  // jardin de pluie : fond paillé et plantations (vivaces, graminées), regard de surverse
  overlayPoly('site', 'mulch', RAIN, 0.03, 0.1, true);
  TUFT = new THREE.ConeGeometry(0.025, 0.5, 4); BUSH = new THREE.IcosahedronGeometry(0.22, 1); const r = rng(7); TUFT_G = new THREE.Group();
  let placed = 0;
  for (let i = 0; i < 3000 && placed < 130; i++) {
    const x = 14.1 + r() * 4.3, z = 4.8 + r() * 7.8; const pi = polyInfo(RAIN, x, z);
    if (!pi.inside || pi.d < 0.12) continue;
    if (Math.hypot(x - 17.45, z - 11.6) < 0.45) continue;
    grassTuft(x, z, 0.6 + r() * 0.8, r); placed++;
  }
  // plantes hautes (demande client du 12/10 : « des fleurs qui montent plus, comme les roseaux ») : touffes dans le fond et le bas des talus, plus serrées dans l'angle
  { const kinds = ['jonc', 'jonc', 'jonc', 'calamagrostis', 'calamagrostis', 'massette', 'massette', 'salicaire', 'salicaire', 'iris', 'iris']; let n = 0;
    for (let i = 0; i < 4000 && n < 46; i++) {
      const x = 14.1 + r() * 4.3, z = 4.8 + r() * 7.8, pi = polyInfo(RAIN, x, z);
      if (!pi.inside || pi.d < 0.2 || Math.hypot(x - 17.45, z - 11.6) < 0.5) continue;
      tallPlant(x, z, kinds[Math.floor(r() * kinds.length)], r); n++;
    } }
  mergeStatic([TUFT_G], groups.site); TUFT_G = null; // [perf] ~860 maillages → 4
  { const y = hAt(17.45, 11.6); A.box('site', 17.20, 17.70, y - 0.1, y + 0.02, 11.35, 11.85, 'concrete'); A.box('site', 17.24, 17.66, y + 0.02, y + 0.03, 11.39, 11.81, 'grille'); }
  // arbre à planter (jardin nord, plan de masse)
  tree(-7.4, 7.6, 1.0);
  // contexte : haies et arbres en face (voisins, murs sur rue, arbres du voisin est, lampadaires : rue.js)
  tree(-8, 20.5, 1.3); tree(9, 24.0, 1.2); tree(30.5, 3.5, 1.4); tree(31, -12, 1.5);
  hedge(-60, 4.6, 6.4, 1.7); hedge(1.0, 12.5, 0, 1.8); // au sud de la rue, à l'ouest du virage
  // PAC : unité extérieure sur le pignon nord, devant le WC (plan RDC « Ext. Mod. »)
  // (dessinée dans equip.js, centrée sous la fenêtre du WC)
  // appliques extérieures (façades PCMI 5) : de part et d'autre de la baie ouest, au-dessus du garage (celle de l'entrée est remplacée par le spot de l'auvent)
  const lamp = (x0, x1, y0, y1, z0, z1) => { A.box('rdc', x0, x1, y0, y1, z0, z1, 'blackMatte'); };
  lamp(4.49, 4.59, 2.12, 2.32, D, D + 0.07); lamp(8.40, 8.50, 2.12, 2.32, D, D + 0.07); lamp(L, L + 0.07, 2.48, 2.68, 1.63, 1.73);
  // terrasse 8 × 4 m devant la baie ouest du séjour (dalles 60 × 60 indicatives, −0,04 sous le seuil)
  const tx0 = 6.45 - 4.0, tx1 = 6.45 + 4.0, tz1 = D + 4.0;
  A.box('site', tx0, tx1, -0.30, -0.04, D, tz1, { py: 'terrace', def: 'terraceEdge' });
  // pergola bioclimatique alu 7016 de 4 × 3 m adossée à la façade ouest, centrée sur la baie du séjour (x 6,45) :
  // poutre murale fixée sur l'enduit au-dessus de l'encadrement, 2 poteaux 15 × 15 côté jardin, ceinture de 22 cm, lames orientables
  { const px0 = 6.45 - 2.0, px1 = 6.45 + 2.0, pz0 = D, pz1 = D + 3.0, yb = 2.58, yt = 2.80, pg = 'pergola';
    for (const x of [px0, px1 - 0.15]) A.box(pg, x, x + 0.15, -0.04, yt, pz1 - 0.15, pz1, 'pergola');
    A.box(pg, px0, px1, yb, yt, pz0, pz0 + 0.12, 'pergola'); A.box(pg, px0, px1, yb, yt, pz1 - 0.12, pz1, 'pergola');
    A.box(pg, px0, px0 + 0.12, yb, yt, pz0 + 0.12, pz1 - 0.12, 'pergola'); A.box(pg, px1 - 0.12, px1, yb, yt, pz0 + 0.12, pz1 - 0.12, 'pergola');
    for (const x of [px0 + 0.30, 6.45 - 0.06, px1 - 0.42]) A.box(pg, x, x + 0.12, yb + 0.02, yt - 0.02, pz0 - 0.004, pz0, 'pergola'); // platines de fixation murale
    const n = 18, step = (px1 - px0 - 0.24) / n, lg = new THREE.BoxGeometry(step - 0.012, 0.028, pz1 - pz0 - 0.24);
    const im = new THREE.InstancedMesh(lg, M.pergola, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.45);
    for (let i = 0; i < n; i++) { m4.compose(new THREE.Vector3(px0 + 0.12 + (i + 0.5) * step, yt - 0.06, (pz0 + pz1) / 2), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); }
    im.castShadow = im.receiveShadow = true; groups.pergola.add(im); }
  // table de jardin pour 6 sous la pergola : mobilier.js (calque pergola)
  // robinets extérieurs
  A.box('rdc', -0.06, 0, 0.55, 0.65, 7.10, 7.18, 'inox'); A.box('rdc', L, L + 0.06, 0.55, 0.65, 6.92, 7.00, 'inox');
  buildFences();
}

function tree(x, z, s) {
  const y = hAt(x, z); const r = rng(Math.floor(x * 100 + z * 7 + 13));
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.15 * s, 2.6 * s, 10), M.trunk); tr.position.set(x, y + 1.3 * s, z); tr.castShadow = true; groups.site.add(tr);
  const wood = [tr]; // [perf] tronc et branches fusionnés
  for (let i = 0; i < 4; i++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.06 * s, 1.3 * s, 6), M.trunk); const a = i * 1.7; br.position.set(x + Math.cos(a) * 0.3 * s, y + 2.7 * s, z + Math.sin(a) * 0.3 * s); br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); br.castShadow = true; groups.site.add(br); wood.push(br); }
  mergeStatic(wood, groups.site);
  const geos = [];
  for (let i = 0; i < 46; i++) {
    const geo = new THREE.IcosahedronGeometry((0.32 + r() * 0.28) * s, 2); const pp = geo.attributes.position;
    for (let k = 0; k < pp.count; k++) { const f = 0.88 + r() * 0.24; pp.setXYZ(k, pp.getX(k) * f, pp.getY(k) * f, pp.getZ(k) * f); }
    const u = r() * 2 - 1, th = r() * Math.PI * 2, rr = Math.cbrt(r()) * 1.25 * s; const sq = Math.sqrt(1 - u * u);
    geo.translate(x + Math.cos(th) * sq * rr, y + 3.6 * s + u * rr * 0.9, z + Math.sin(th) * sq * rr);
    const c = new THREE.Color().setHSL(0.24 + r() * 0.05, 0.45, 0.25 + r() * 0.12); const col = []; for (let k = 0; k < pp.count; k++) col.push(c.r, c.g, c.b);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals(); geos.push(geo);
  }
  const crown = new THREE.Mesh(mergeGeometries(geos), M.foliage); crown.castShadow = true; crown.receiveShadow = true; groups.site.add(crown);
}
let TUFT, BUSH, TUFT_G; // [perf] TUFT_G : groupe provisoire des touffes, fusionné à la fin de la plantation
let TP; // géométries des plantes hautes (base à l'origine, hauteur 1)
// plante haute du jardin de pluie, en touffe de tiges et de feuilles inclinées vers l'extérieur ; épis ou fleurs au sommet des tiges
function tallPlant(x, z, kind, r) {
  const y = hAt(x, z), G = TUFT_G || groups.site;
  TP ||= { leaf: new THREE.ConeGeometry(0.009, 1, 3).translate(0, 0.5, 0), blade: new THREE.ConeGeometry(0.024, 1, 3).translate(0, 0.5, 0),
    head: new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), plume: new THREE.ConeGeometry(0.018, 0.26, 5), spike: new THREE.ConeGeometry(0.026, 0.30, 6), bloom: new THREE.IcosahedronGeometry(0.035, 0) };
  const add = (geo, mat, px, py, pz, rx, rz, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.rotation.set(rx, r() * 3, rz); m.scale.set(sx, sy, sz); m.castShadow = true; G.add(m); return m; };
  // tige ou feuille de hauteur h penchée de lean vers a ; renvoie le point à la fraction t de sa hauteur
  const stem = (geo, mat, h, lean, w = 1, sz = w) => {
    const a = r() * Math.PI * 2, rr = r() * 0.09, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, rx = Math.sin(a) * lean, rz = -Math.cos(a) * lean;
    const m = add(geo, mat, px, y - 0.02, pz, rx, rz, w, h, sz); m.rotation.y = 0;
    return t => new THREE.Vector3(0, h * t, 0).applyEuler(m.rotation).add(m.position);
  };
  const H = { jonc: 1.15, calamagrostis: 0.85, massette: 1.0, salicaire: 1.05, iris: 0.8 }[kind] * (0.85 + r() * 0.35);
  if (kind === 'iris') {
    for (let i = 0; i < 9; i++) stem(TP.blade, r() < 0.5 ? M.reed : M.reed2, H * (0.65 + r() * 0.4), 0.05 + r() * 0.2, 1, 0.25);
    for (let i = 0; i < 2; i++) { const p = stem(TP.leaf, M.reed2, H * 1.05, 0.08)(1); add(TP.bloom, M.iris, p.x, p.y, p.z, 0, 0, 1, 0.8, 1); }
    return;
  }
  for (let i = 0; i < 16; i++) stem(TP.leaf, r() < 0.5 ? M.reed : M.reed2, H * (0.55 + r() * 0.45), 0.06 + r() * 0.24);
  const ns = kind === 'jonc' ? 0 : kind === 'calamagrostis' ? 7 : 4;
  for (let i = 0; i < ns; i++) {
    const hs = kind === 'calamagrostis' ? H * 1.7 : H * (1.05 + r() * 0.15), at = stem(TP.leaf, kind === 'calamagrostis' ? M.plume : M.reed2, hs, 0.03 + r() * 0.08, 0.7);
    const p = at(kind === 'massette' ? 0.86 : 0.88), mat = kind === 'calamagrostis' ? M.plume : kind === 'massette' ? M.typha : M.lythrum;
    add(kind === 'calamagrostis' ? TP.plume : kind === 'massette' ? TP.head : TP.spike, mat, p.x, p.y, p.z, 0, 0, 1, 1, 1);
  }
}
function grassTuft(x, z, s, r) {
  const y = hAt(x, z), G = TUFT_G || groups.site;
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(TUFT, r() < 0.5 ? M.leaf2 : M.leaf); c.scale.setScalar(s * (0.7 + r() * 0.5)); c.position.set(x + (r() - 0.5) * 0.15, y + 0.2 * s, z + (r() - 0.5) * 0.15); c.rotation.set((r() - 0.5) * 0.7, r() * 3, (r() - 0.5) * 0.7); c.castShadow = true; G.add(c); }
  if (r() < 0.35) { const b = new THREE.Mesh(BUSH, r() < 0.5 ? M.leaf : M.leaf2); const k = s * (0.6 + r() * 0.5); b.scale.set(k, k * 0.7, k); b.position.set(x + (r() - 0.5) * 0.2, y + 0.08 * k, z + (r() - 0.5) * 0.2); b.castShadow = true; G.add(b); }
  if (r() < 0.3) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M.flower); f.position.set(x, y + 0.45 * s, z); G.add(f); }
}
// haie le long d'une rue, du côté opposé (X0 → X1 si horizontale, sinon le long de la rue sud)
function hedge(a0, a1, off, h) {
  const r = rng(Math.floor(a0 * 10 + 7));
  if (off === 6.4) { // rue ouest, côté opposé
    for (let x = a0; x < a1; x += 2.2) { if (r() < 0.12) continue; const x1 = x + 2.0 + r() * 0.2, z = zWest(x) + off + 0.6, y = hAt(x, z); const hh = h * (0.85 + r() * 0.3); A.box('site', x, x1, y - 0.1, y + hh, z, z + 0.9 + r() * 0.3, 'hedge'); }
  } else { // rue sud, côté opposé
    for (let z = a0; z < a1; z += 2.2) { if (r() < 0.12) continue; const x = xSouth(z) + 6.4 + 0.6, y = hAt(x, z); const hh = h * (0.85 + r() * 0.3); A.box('site', x, x + 0.9 + r() * 0.3, y - 0.1, y + hh, z, z + 2.0 + r() * 0.2, 'hedge'); }
  }
}

// ---------------------------------------------------------------- clôtures
function buildFences() {
  const g = p => hAt(p[0], p[1]);
  // limite voisine nord : muret surmonté d'un grillage, appartenant au voisin (côté extérieur) ; limite est (mur de soutènement) : env.js
  const neighbour = (p0, p1) => {
    const len = dist2(p0, p1), n = Math.max(1, Math.ceil(len / 2.5)); const pts = [], gs = [];
    for (let i = 0; i <= n; i++) { const p = lerp2(p0, p1, i / n); pts.push(p); gs.push(g(p)); }
    for (let i = 0; i < n; i++) { sbox('fence', 'oldWall', pts[i], pts[i + 1], -0.16, 0, gs[i] - 0.3, gs[i + 1] - 0.3, 0.75); sbox('fence', 'coping', pts[i], pts[i + 1], -0.18, 0.02, gs[i] + 0.45, gs[i + 1] + 0.45, 0.03); }
    for (let i = 0; i <= n; i++) { const q = lerp2(p0, p1, clamp((i * len / n + 0.04) / len, 0, 1)); const pp = lerp2(p0, p1, clamp((i * len / n - 0.0) / len, 0, 1)); sbox('fence', 'meshPost', pp, q, -0.10, -0.06, gs[i] + 0.45, gs[i] + 0.45, 1.25); }
    // panneau de grillage suivant la pente
    const pos = [], uv = [], idx = []; let acc = 0; const dx = p1[0] - p0[0], dz = p1[1] - p0[1], l = Math.hypot(dx, dz); const nx = dz / l, nz = -dx / l;
    for (let i = 0; i <= n; i++) { if (i) acc += dist2(pts[i - 1], pts[i]); const x = pts[i][0] - nx * 0.08, z = pts[i][1] - nz * 0.08; pos.push(x, gs[i] + 0.50, z, x, gs[i] + 1.68, z); uv.push(acc, 0, acc, 1.18); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    groups.fence.add(new THREE.Mesh(geo, M.mesh));
  };
  neighbour(BND.B, BND.A);

  // sur rue (PCMI 5) : muret enduit ton pierre réf. 15 de 0,80 m, lames horizontales pleines en alu 7016 sur 1,20 m,
  // piliers 40 × 40, portillon 1,00 m et portail coulissant 3,50 m en alu 7016 hauteur 2,00 m. Le tout suit la pente.
  const runW = [BND.A, BND.D], runS = [BND.D, BND.C];
  const at = (run, s) => lerp2(run[0], run[1], s / dist2(run[0], run[1]));
  const pillar = (run, s) => {
    const p0 = at(run, s - 0.20), p1 = at(run, s + 0.20), gc = g(at(run, s));
    sbox('fence', 'enduit', p0, p1, 0, 0.40, gc - 0.35, gc - 0.35, 2.39);
    sbox('fence', 'coping', at(run, s - 0.24), at(run, s + 0.24), -0.04, 0.44, gc + 2.04, gc + 2.04, 0.04);
    sbox('fence', 'coping', at(run, s - 0.17), at(run, s + 0.17), 0.03, 0.37, gc + 2.08, gc + 2.08, 0.02);
    return gc;
  };
  const panel = (run, s0, s1, ga, gb) => { // entre faces de piliers ; ga, gb : niveaux du terrain aux deux bouts
    const p0 = at(run, s0), p1 = at(run, s1);
    sbox('fence', 'enduit', p0, p1, 0.0, 0.20, ga - 0.35, gb - 0.35, 1.15);
    sbox('fence', 'coping', p0, p1, -0.02, 0.22, ga + 0.80, gb + 0.80, 0.035);
    for (let k = 0; k < 6; k++) sbox('fence', 'fenceAlu', p0, p1, 0.08, 0.115, ga + 0.838 + k * 0.1936, gb + 0.838 + k * 0.1936, 0.1906);
    sbox('fence', 'fenceAlu', p0, p1, 0.075, 0.12, ga + 1.995, gb + 1.995, 0.012); // lisse haute
    const n = Math.ceil((s1 - s0) / 1.70);
    for (let i = 1; i < n; i++) { const t = i / n, s = s0 + (s1 - s0) * t, gg = ga + (gb - ga) * t; sbox('fence', 'fenceAlu', at(run, s - 0.025), at(run, s + 0.025), 0.065, 0.13, gg + 0.835, gg + 0.835, 1.17); }
  };
  // vantail rectangulaire de 2,00 m, lames horizontales pleines ; ly / acc : calque et accumulateur (vantail mobile : accumulateur propre) ; renvoie le niveau bas du vantail
  const gate = (run, s0, s1, slide, dt = 0, yb0 = null, ly = 'fence', acc = A) => {
    const gm = Math.max(g(at(run, s0)), g(at(run, s1))); const yb = yb0 ?? gm + 0.04, ht = 1.96;
    const p0 = at(run, s0 + 0.01), p1 = at(run, s1 - 0.01), t0 = 0.07 + dt, t1 = 0.13 + dt;
    const sb = (m, a, b, ta, tb, y, h) => sbox(ly, m, a, b, ta, tb, y, y, h, acc);
    sb('fenceAlu', p0, at(run, s0 + 0.06), t0, t1, yb, ht);
    sb('fenceAlu', at(run, s1 - 0.06), p1, t0, t1, yb, ht);
    sb('fenceAlu', p0, p1, t0, t1, yb, 0.06); sb('fenceAlu', p0, p1, t0, t1, yb + ht - 0.06, 0.06);
    const nb = 9; const sh = (ht - 0.12) / nb;
    for (let k = 0; k < nb; k++) sb('fenceAlu', p0, p1, t0 + 0.013, t1 - 0.013, yb + 0.06 + k * sh + 0.002, sh - 0.004);
    if (slide) sb('fenceAlu', at(run, (s0 + s1) / 2 - 0.03), at(run, (s0 + s1) / 2 + 0.03), t0, t1, yb, ht);
    else { const hp = at(run, s1 - 0.12); sb('blackMatte', hp, at(run, s1 - 0.06), t1, t1 + 0.03, yb + 1.0, 0.14); sb('blackMatte', hp, at(run, s1 - 0.06), t0 - 0.03, t0, yb + 1.0, 0.14); }
    return yb;
  };
  // point à la profondeur t de la limite (t > 0 vers l'intérieur de la parcelle, comme les épaisseurs de sbox)
  const atT = (run, s, t) => { const p = at(run, s), [a, b] = run, l = dist2(a, b); return [p[0] + (b[1] - a[1]) / l * t, p[1] - (b[0] - a[0]) / l * t]; };
  // vantail mobile : géométrie en coordonnées monde dans un groupe propre (hors fusion), pivot en (x, z) ; déclaré dans DOORS (clic : ouvrir / fermer).
  // kind renseigné : la balade ne l'ouvre pas d'elle-même (nav.js), le vantail y reste un obstacle dynamique
  const leaf = (name, pivot, fill) => {
    const acc = new Acc(), g0 = new THREE.Group(), inner = new THREE.Group(); g0.name = name; g0.userData.noMerge = true;
    g0.position.set(pivot[0], 0, pivot[1]); inner.position.set(-pivot[0], 0, -pivot[1]); g0.add(inner); groups.fence.add(g0);
    fill(acc); acc.build({ leaf: inner });
    const meshes = []; inner.traverse(o => { if (o.isMesh) meshes.push(o); }); return { g: g0, meshes };
  };
  const door = (lf, kind, speed, apply) => { const d = { g: lf.g, meshes: lf.meshes, open: 0, target: 0, speed, apply, kind }; for (const m of lf.meshes) m.userData.door = d; apply(0); DOORS.push(d); return d; };
  // côté ouest, du nord (A) au sud (D) : pilier, 8,73, pilier, portillon 1,00, pilier, 9,67, pilier, 9,67, pilier (31,07 m)
  const LW = dist2(BND.A, BND.D);
  const sp = [0.20, 9.33, 10.73, 20.80, LW - 0.20];
  const gp = sp.map(s => pillar(runW, s));
  const gAt = (s) => { for (let i = 0; i < sp.length - 1; i++) if (s <= sp[i + 1]) return gp[i] + (gp[i + 1] - gp[i]) * (s - sp[i]) / (sp[i + 1] - sp[i]); return gp[gp.length - 1]; };
  for (const [s0, s1] of [[0.40, 9.13], [10.93, 20.60], [21.00, LW - 0.40]]) panel(runW, s0, s1, gAt(s0), gAt(s1));
  // portillon : vantail sur gonds côté pilier nord (s 9,53), ouverture de 90° vers l'intérieur de la parcelle ; serrure côté pilier sud (s 10,53)
  { const s0 = 9.53, s1 = 10.53; let yb = 0;
    const lf = leaf('portillon', atT(runW, s0 + 0.01, 0.13), acc => { yb = gate(runW, s0, s1, false, 0, null, 'leaf', acc); });
    door(lf, 'portillon', 0.7, v => { lf.g.rotation.y = Math.PI / 2 * smooth(0, 1, v); });
    for (const y of [yb + 0.22, yb + 1.62]) sbox('fence', 'fenceAlu', at(runW, s0 - 0.004), at(runW, s0 + 0.014), 0.125, 0.15, y, y, 0.12); // gonds
    // gâche électrique encastrée dans le pilier, face à la serrure (portillon commandé à distance, sans moteur)
    sbox('fence', 'inox', at(runW, s1 - 0.003), at(runW, s1 + 0.003), 0.08, 0.12, yb + 0.96, yb + 0.96, 0.20); }
  // côté sud, de D à C : (pilier d'angle commun), 9,00, pilier, portail coulissant 3,50, pilier (13,70 m)
  const LS = dist2(BND.D, BND.C);
  const ss = [0.20, 9.60, LS - 0.20]; void ss;
  const gs = [gp[gp.length - 1], pillar(runS, 9.60), pillar(runS, LS - 0.20)];
  panel(runS, 0.40, 9.40, gs[0] + (gs[1] - gs[0]) * 0.2 / 9.4, gs[0] + (gs[1] - gs[0]) * 9.2 / 9.4);

  // ---- portail coulissant 3,50 m entre piliers (vantail de 3,78 m, 14 cm de recouvrement derrière chaque pilier) : il roule sur un rail posé sur le seuil,
  // derrière les piliers de 40 cm et sous le débord de leurs chaperons (vantail t 0,45 → 0,51), et se range vers le jardin le long de la clôture :
  // course 3,66 m (ouvert : s 6,00 → 9,78, 2 cm derrière le nu du pilier), rail de s 5,92 à 13,45
  const S0G = 9.66, S1G = 13.44, TRAV = 3.66, DTG = 0.38, TR = 0.48; // DTG : décalage du vantail dans gate() ; TR : axe du rail
  const seuilY = (s, t) => surfAllee(atT(runS, s, t)[0]); // dessus du seuil : au nu du gravillon, il suit la pente de la descente dans sa profondeur
  const yR = Math.max(seuilY(5.92, TR), seuilY(13.45, TR)), ybG = yR + 0.025 + 0.01; // rail de niveau calé au point haut ; galets : vantail 1 cm au-dessus du rail
  // seuil en béton enduit ton pierre, comme le muret (sous l'ouverture et toute la zone de refoulement, du retour du muret à la limite est)
  const slab = (s0, s1, t0, t1) => {
    const q = [[s0, t0], [s1, t0], [s1, t1], [s0, t1]].map(([s, t]) => { const p = atT(runS, s, t); return [p[0], surfAllee(p[0]), p[1]]; });
    const u = q[1].map((v, k) => v - q[0][k]), w = q[3].map((v, k) => v - q[0][k]);
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n) * Math.sign(n[1]); n = n.map(v => v / nl);
    A.quadN('fence', 'enduit', q, n);
    const cx = (q[0][0] + q[2][0]) / 2, cz = (q[0][2] + q[2][2]) / 2;
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; let ex = b[2] - a[2], ez = a[0] - b[0]; const el = Math.hypot(ex, ez) * (ex * ((a[0] + b[0]) / 2 - cx) + ez * ((a[2] + b[2]) / 2 - cz) < 0 ? -1 : 1);
      A.quadN('fence', 'enduit', [[a[0], -1.0, a[2]], [b[0], -1.0, b[2]], [b[0], b[1], b[2]], [a[0], a[1], a[2]]], [ex / el, 0, ez / el]); }
  };
  const sC = (BND.D[1] - MUR.z) / BND.D[1] * LS; // abscisse de l'angle des murets (nu côté allée du muret allée / jardin)
  slab(5.70, LS - 0.03, SEUIL.t0, SEUIL.t1); slab(9.80, 13.30, -0.05, SEUIL.t0); slab(9.43, sC, SEUIL.t1, SEUIL.tn); // bande principale, entre les piliers (glissé sous le bord du trottoir), fond de la niche
  // bordure du trottoir au droit de l'ouverture : le trottoir (terrain naturel de la rue) est 2 à 11 cm au-dessus du seuil, sa rive est fermée par la bordure
  for (let i = 0; i < 7; i++) { const sa = 9.80 + 0.5 * i, sb = sa + 0.5, ya = g(at(runS, sa)) + 0.052, yb = g(at(runS, sb)) + 0.052;
    sbox('fence', 'curb', at(runS, sa), at(runS, sb), -0.08, 0, ya - 0.30, yb - 0.30, 0.30); }
  sbox('fence', 'grille', at(runS, 5.92), at(runS, 13.45), TR - 0.015, TR + 0.015, yR - 0.012, yR - 0.012, 0.037); // rail
  // motorisation du portail (interprétation de la demande : le moteur au sol à côté du muret est celui du portail coulissant) : moteur à crémaillère
  // 30 × 20 × 30 cm gris anthracite sur socle enduit, dans la niche du muret derrière le pilier côté rangement ; pignon engrené sur la crémaillère du vantail
  // en s 9,72 (dans la crémaillère portail fermé comme ouvert)
  const ySoc = seuilY(9.72, 0.78) + 0.05, yMot = ySoc + 0.30;
  sbox('fence', 'enduit', at(runS, 9.53), at(runS, 9.91), 0.54, 0.78, ySoc - 0.12, ySoc - 0.12, 0.12); // socle
  sbox('fence', 'blackMatte', at(runS, 9.56), at(runS, 9.88), 0.542, 0.755, ySoc, ySoc, 0.015); // embase
  sbox('fence', 'fenceAlu', at(runS, 9.57), at(runS, 9.87), 0.547, 0.745, ySoc + 0.015, ySoc + 0.015, yMot - ySoc - 0.015); // capot
  sbox('fence', 'blackMatte', at(runS, 9.60), at(runS, 9.66), 0.744, 0.748, ySoc + 0.06, ySoc + 0.06, 0.05); // trappe de déverrouillage
  { const p = atT(runS, 9.72, 0.571), pg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.026, 18), M.closetRail); pg.position.set(p[0], yMot + 0.015, p[1]); pg.castShadow = pg.receiveShadow = true; groups.fence.add(pg); } // pignon
  // vantail coulissant et sa crémaillère (acier galvanisé, sur toute la longueur, face intérieure, à hauteur du pignon)
  const ux = (BND.D[0] - BND.C[0]) / LS, uz = (BND.D[1] - BND.C[1]) / LS; // sens d'ouverture : vers les s décroissants (vers le jardin)
  const lfG = leaf('portail coulissant', [0, 0], acc => {
    gate(runS, S0G, S1G, true, DTG, ybG, 'leaf', acc);
    sbox('leaf', 'closetRail', at(runS, S0G + 0.01), at(runS, S1G - 0.01), 0.13 + DTG, 0.155 + DTG, yMot + 0.002, yMot + 0.002, 0.03, acc);
  });
  const dG = door(lfG, 'portail', 1 / 3, v => { const k = TRAV * smooth(0, 1, v); lfG.g.position.set(ux * k, 0, uz * k); }); // ~3 s
  { const c = atT(runS, (S0G - TRAV + S1G) / 2, TR); dG._navC = { x: c[0], y: ybG + 1.0, z: c[1], r: (S1G - S0G + TRAV) / 2 + 0.1 }; } // emprise de toute la course (obstacle dynamique de la balade, nav.js)

  // ---- murets : dessus et chaperons rectilignes (sans gradins ni courbe), pied enterré sous le terrain
  const murBot = x => driveH(x) - 0.12;
  const xEnd = xSouth(MUR.z + MUR.e / 2) - SEUIL.tm; // le muret allée / jardin bute contre la niche du moteur (nu côté jardin)
  const yC = murY(xEnd); // murets du seuil : dessus horizontal (le seuil est de niveau à 3 mm près), à la hauteur du bout du muret allée / jardin
  // muret de soutènement le long du seuil (s croissants : du bout de course vers l'angle) ; h = 0 : corps descendu à −1,05
  const soutRun = (sa, sb, ta, tb, mat, h, ext0 = 0, ext1 = 0) => {
    const hh = h || yC + 1.05;
    sbox('fence', mat, at(runS, sa - ext0), at(runS, sb + ext1), ta, tb, h ? yC : yC - hh, h ? yC : yC - hh, hh);
  };
  { const hh = yC + 1.05;
    sbox('fence', 'enduit', at(runS, 5.70), at(runS, 5.90), 0.15, SEUIL.tn, yC - hh, yC - hh, hh); // retour jusqu'à la clôture au bout de la course
    sbox('fence', 'coping', at(runS, 5.68), at(runS, 5.92), SEUIL.t0, SEUIL.tn + 0.02, yC, yC, 0.03);
    soutRun(5.90, 9.43, SEUIL.t1, SEUIL.tn, 'enduit', 0); soutRun(9.25, sC, SEUIL.tn, SEUIL.tm, 'enduit', 0); // le long du seuil, puis niche du moteur
    soutRun(5.92, 9.25, SEUIL.t1 - 0.02, SEUIL.tn + 0.02, 'coping', 0.03); soutRun(9.25, 9.45, SEUIL.t1 - 0.02, SEUIL.tn - 0.02, 'coping', 0.03);
    soutRun(9.25, sC, SEUIL.tn - 0.02, SEUIL.tm + 0.02, 'coping', 0.03, 0.02, 0.02); }
  // muret entre l'allée du garage et le jardin : un prisme par tronçon, dessus et chaperon sur la droite murY (pente constante de 6,5 %),
  // pied parallèle enterré d'au moins 12 cm sous l'allée ; interrompu au droit de la marche (chaperons retournés de 2 cm sur les joues)
  const murRun = (xa, xb, ca, cb) => {
    const ya = murY(xa), yb = murY(xb), hs = Math.max(ya - murBot(xa), yb - murBot(xb));
    sbox('fence', 'enduit', [xa, MUR.z], [xb, MUR.z], -MUR.e, 0, ya - hs, yb - hs, hs);
    sbox('fence', 'coping', [xa - ca, MUR.z], [xb + cb, MUR.z], -MUR.e - 0.02, 0.02, murY(xa - ca), murY(xb + cb), 0.03);
  };
  murRun(L + 0.008, MARCHE.x0, 0, 0.02); murRun(MARCHE.x1, xEnd, 0.02, -0.02); // depuis le nu de l'enduit de la façade sud
  // marche de l'allée au jardin dans le passage de 0,80 m : giron en pierre reconstituée (comme le chaperon) de 25 cm × 5 cm, nu avant au nu
  // côté allée du muret (sans nez ni débord), sur une contremarche enduite dans le plan du muret ; sol de la balade au clavier
  // (userData.navKind = 0 : marche franchissable, nav.js)
  { const { x0, x1, zB } = MARCHE, acc = new Acc(), grp = new THREE.Group(); grp.name = 'marche allée / jardin'; groups.fence.add(grp);
    const y0 = marcheY(x0) - 0.05, y1 = marcheY(x1) - 0.05, hb = Math.max(y0 - murBot(x0), y1 - murBot(x1));
    sbox('st', 'enduit', [x0, MUR.z], [x1, MUR.z], -MUR.e, 0, y0 - hb, y1 - hb, hb, acc); // contremarche (corps du muret sous le giron)
    sbox('st', 'coping', [x0, MUR.z], [x1, MUR.z], -(zB - MUR.z), 0, y0, y1, 0.05, acc); // giron
    acc.build({ st: grp }); grp.traverse(o => { if (o.isMesh) o.userData.navKind = 0; }); }
  // pelouse le long des murets côté jardin (le maillage du terrain, au pas de 20 cm, y creuserait une rigole)
  const grassStrip = c => overlayQuad('site', 'grass', c, -0.006, Math.max(2, Math.ceil(dist2(c[0], c[1]) / 0.25)), 2);
  const gq = (s0, s1, t0, t1) => [atT(runS, s0, t0), atT(runS, s1, t0), atT(runS, s1, t1), atT(runS, s0, t1)];
  const zg = MUR.z + MUR.e + 0.003; // 3 mm du nu : le bord de la bande est évalué côté jardin
  const { x0: xm0, x1: xm1, zB: zmB } = MARCHE, xg0 = xm0 - 0.003, xg1 = xm1 + 0.003;
  grassStrip([[L + 0.008, zg], [xg0, zg], [xg0, zg + 0.25], [L + 0.008, zg + 0.25]]); grassStrip([[xg1, zg], [xEnd, zg], [xEnd, zg + 0.25], [xg1, zg + 0.25]]);
  grassStrip([[xg0, zmB + 0.003], [xg1, zmB + 0.003], [xg1, zg + 0.25], [xg0, zg + 0.25]]); // derrière le giron (bord arrière au niveau de la pelouse)
  grassStrip(gq(9.25, sC, SEUIL.tm + 0.003, SEUIL.tm + 0.25)); grassStrip(gq(5.70, 9.25, SEUIL.tn + 0.003, SEUIL.tn + 0.25)); grassStrip(gq(5.45, 5.697, SEUIL.t0, SEUIL.tn + 0.25));
}

// ---------------------------------------------------------------- scène
const groups = {};
const LAYERS = ['site', 'pergola', 'fence', 'skinU', 'skinR', 'rdc', 'furn0', 'slab1', 'r1', 'furn1', 'ceil1', 'roof', 'volets0', 'volets1'];
let amb; const roomLights = [];
// points d'accroche des modules (env.js, equip.js, nav.js) : pre/post autour de controls.update(), render remplace le rendu par défaut
const hooks = { pre: [], post: [], render: null };
const DOORS = []; // éléments ouvrants cliquables : { g (groupe pivot), meshes, open, target, speed?, apply?(open) } ; sans apply : rotation d'une porte battante
function ctx() {
  return { A, M, TEX, groups, scene, camera, controls, renderer, get composer() { return composer; }, get gtao() { return gtao; }, labelRenderer,
    state, VIEWS, setView, applyVisibility, applyLighting, updateSun, hooks, DOORS, roomLights, labels, requestRender, mergeStatic, get fast() { return fast; },
    hAt, zWest, xSouth, BND, L, D, T, SH, H, E1, std, makeTex, pixelNoise, rng, clamp, smooth, lerp2, sbox, hipRoof, tree, hedge, wall, LB, OPEN, FACE };
}
let renderer, scene, camera, controls, sun, hemi, sky, pmrem, envRT, composer, gtao, labelRenderer;
// [perf] rendu à la demande : rien n'est dessiné tant que la caméra est immobile et que rien ne change. En mouvement (orbite, balade,
// animation de vue, porte, curseur de l'heure…) : résolution réduite et sans occlusion ambiante ; puis une image pleine qualité à l'arrêt.
// Les modules qui modifient la scène hors des fonctions de main.js appellent ctx.requestRender() (sinon toute action dans le panneau redessine).
// Sous Playwright (navigator.webdriver), pas d'images allégées : les captures d'essai restent identiques.
const PERF = { adaptive: !navigator.webdriver, fastDpr: 1, settle: 220, eps: 1e-6 };
let labelScene, fast = false, dirty = true, shadowDirty = true, hqPending = false, lastActive = 0, activeRun = 0;
const camSig = new Float64Array(32);
function requestRender(shadows = true) { dirty = true; if (shadows) shadowDirty = true; }
const hqDpr = () => Math.min(window.devicePixelRatio || 1, 2);
function setDpr(v) { if (renderer.getPixelRatio() !== v) renderer.setPixelRatio(v); }
function saveCam() { camera.updateMatrixWorld(); camSig.set(camera.matrixWorld.elements, 0); camSig.set(camera.projectionMatrix.elements, 16); }
function cameraMoved() {
  camera.updateMatrixWorld(); const a = camera.matrixWorld.elements, b = camera.projectionMatrix.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(a[i] - camSig[i]) > PERF.eps || Math.abs(b[i] - camSig[16 + i]) > PERF.eps) return true;
  return false;
}
function draw(now, hq) {
  fast = !hq;
  setDpr(hq || hooks.render ? hqDpr() : Math.min(hqDpr(), PERF.fastDpr)); // l'optique panoramique gère sa propre résolution
  if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; } // carte d'ombre du soleil recalculée seulement si la scène a changé
  if (hooks.render) hooks.render(now);
  else if (hq && state.ao && composer && (state.inside || state.mode !== 'ext')) composer.render(); else renderer.render(scene, camera);
  labelRenderer.render(labelScene, camera);
  saveCam(); dirty = false; hqPending = !hq;
}
// [perf] variante d'éclairage intérieur compilée en tâche de fond après le chargement (évite l'à-coup à la première entrée dans la maison) ;
// seulement si le navigateur compile en parallèle, sinon la compilation bloquerait la page au hasard : elle se fera à la première entrée, comme avant
function precompileInterior() {
  if (!renderer.compileAsync || !renderer.extensions.has('KHR_parallel_shader_compile')) return; const vis = roomLights.map(l => l.visible);
  let p; try { roomLights.forEach(l => { l.visible = true; }); p = renderer.compileAsync(scene, camera); } catch (e) { p = null; } finally { roomLights.forEach((l, i) => { l.visible = vis[i]; }); }
  if (p) p.then(() => requestRender(false), () => {});
}
const state = { mode: 'ext', roof: true, furn: true, fence: true, pergola: true, volets: false, ao: true, month: 6, hour: 16.5, envI: 0.07, lampI: 7, inside: false };
const labels = { rdc: [], r1: [] };

function init() {
  const canvas = document.getElementById('scene');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(hqDpr());
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // [perf] ombre du soleil statique : recalculée quand la scène change (requestRender), pas quand la caméra bouge
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.75;
  MAX_ANISO.v = renderer.capabilities.getMaxAnisotropy();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);
  controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495; controls.maxDistance = 120;

  buildTextures(); buildMaterials();
  for (const l of LAYERS) { groups[l] = new THREE.Group(); groups[l].name = l; scene.add(groups[l]); }
  buildShell(); buildInterior(); buildRoof(); buildFurniture(); buildSite();
  buildEquipment(ctx()); buildEnvironment(ctx()); buildRue(ctx()); buildBains(ctx()); buildMobilier(ctx()); buildChambre1(ctx()); buildVoiture(ctx()); buildSousEscalier(ctx()); buildOuvrants(ctx());
  A.build(groups);

  sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
  pmrem = new THREE.PMREMGenerator(renderer);
  sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 170;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.target.position.set(4, 0, 6); scene.add(sun); scene.add(sun.target);
  hemi = new THREE.HemisphereLight(0xe4ebf2, 0xa19f99, 0.35); scene.add(hemi);
  scene.fog = new THREE.Fog(0xcfd8de, 60, 200);
  amb = new THREE.AmbientLight(0xf6f7fa, 0); scene.add(amb);
  for (const [lv, x, z] of [[0, 6.5, 5.6], [0, 10.5, 5.6], [0, 1.95, 5.45], [0, 3.33, 6.85], [0, 3.0, 2.0], [0, 9.0, 1.8], [1, 1.9, 1.7], [1, 10.5, 2.2], [1, 6.5, 3.67], [1, 2.7, 5.9], [1, 6.6, 5.9], [1, 10.4, 5.9]]) {
    const pl = new THREE.PointLight(0xfff2e4, 0, 9, 2); pl.position.set(x, lv ? H.r1Ceil - 0.35 : H.rdcCeil - 0.35, z); pl.userData.lv = lv; scene.add(pl); roomLights.push(pl);
  }

  // étiquettes des pièces (surfaces des plans travaux v3)
  labelRenderer = new CSS2DRenderer(); labelRenderer.domElement.className = 'labels'; document.getElementById('stage').appendChild(labelRenderer.domElement);
  labelScene = new THREE.Scene(); // [perf] étiquettes dans une scène à part : le rendu CSS2D ne parcourt plus les ~1 800 objets de la maquette
  const e1 = H.r1Floor + 0.05;
  const rooms = [
    ['rdc', 'Entrée', '12,82 m²', 3.0, 0.05, 2.2], ['rdc', 'WC', '2,00 m²', 1.3, 0.05, 0.85], ['rdc', 'Cuisine', '11,50 m²', 2.0, 0.95, 5.6], ['rdc', 'Séjour', '36,24 m²', 8.2, 0.9, 4.6], ['rdc', 'Garage', '16,41 m²', 9.9, 0.0, 1.8], ['rdc', 'Local technique', '4,98 m²', 6.2, 0.0, 1.9],
    ['r1', 'Bains', '9,54 m²', 1.5, e1, 1.9], ['r1', 'WC', '1,53 m²', 4.38, e1, 1.4], ['r1', 'Douche', '3,86 m²', 5.6, e1, 2.0], ['r1', 'Dressing', '5,29 m²', 7.4, e1, 1.8], ['r1', 'Chambre 1', '14,80 m²', 10.6, e1 + 0.6, 3.1],
    ['r1', 'Palier', '6,05 m²', 6.6, e1, 3.67], ['r1', 'Chambre 3', '15,26 m²', 2.4, e1 + 0.6, 6.8], ['r1', 'Bureau', '9,83 m²', 6.4, e1, 5.4], ['r1', 'Chambre 2', '14,47 m²', 10.6, e1 + 0.6, 6.8],
  ];
  for (const [lv, name, s, x, y, z] of rooms) {
    const el = document.createElement('div'); el.className = 'room'; el.innerHTML = `<b>${name}</b><span>${s}</span>`;
    const o = new CSS2DObject(el); o.position.set(x, y + 0.02, z); o.visible = false; labelScene.add(o); labels[lv].push(o);
  }

  // post-traitement : occlusion ambiante
  try {
    // cible lissée MSAA 4× (comme le composeur panoramique de nav.js) : sans elle, les vues intérieures avec occlusion ambiante n'étaient pas lissées et les filets fins (jeux de 3 mm des portes, chants, montants) scintillaient au moindre mouvement
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 2, 2);
    gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao); composer.addPass(new OutputPass());
  } catch (err) { console.warn('AO indisponible', err); composer = null; }
  if (matchMedia('(max-width: 700px)').matches) { state.ao = false; document.getElementById('t-ao').checked = false; }

  updateSun(); setView('sw', true); applyVisibility();
  window.addEventListener('resize', resize); resize();
  renderer.setAnimationLoop(tick);
  bindUI();
  initNav(ctx()); initOuvrants(ctx());
  // [perf] filet de sécurité du rendu à la demande : toute action dans le panneau ou au clavier (hors flèches de la balade) redessine
  for (const t of ['input', 'change', 'click']) document.addEventListener(t, e => requestRender(e.target !== renderer.domElement), true);
  window.addEventListener('keydown', e => { if (!/^(Arrow|Shift)/.test(e.key)) requestRender(); }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });
  canvas.addEventListener('webglcontextrestored', () => requestRender());
  saveCam(); requestRender();
  setTimeout(precompileInterior, 1500);
  document.body.classList.add('ready');
}

function resize() {
  const st = document.getElementById('stage'); const w = st.clientWidth, h = st.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  labelRenderer.setSize(w, h); if (composer) { composer.setPixelRatio(hqDpr()); composer.setSize(w, h); } // [perf] l'occlusion ambiante reste en pleine résolution
  requestRender();
}

// position du soleil (lat. 48,97° N, long. 2,33° E), heure légale
function sunDir(month, hour) {
  const N = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1];
  const dst = month >= 4 && month <= 10 ? 2 : 1;
  const solar = hour - dst + 2.33 / 15;
  const rad = Math.PI / 180, lat = 48.97 * rad;
  const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (N + 10)) * rad;
  const Hh = (solar - 12) * 15 * rad;
  const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(Hh));
  const az = Math.atan2(Math.sin(Hh), Math.cos(Hh) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) + Math.PI;
  return { el, az, v: new THREE.Vector3(-Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el)) };
}
let envTimer = null;
function updateSun(deferEnv) {
  const { el, v } = sunDir(state.month, state.hour);
  const elc = Math.max(el, -0.05);
  const d = new THREE.Vector3(v.x, Math.sin(elc), v.z).normalize();
  sky.material.uniforms.sunPosition.value.copy(d);
  sun.position.copy(sun.target.position).addScaledVector(d, 80);
  const k = clamp(Math.sin(elc) * 3, 0, 1);
  sun.intensity = 5 * k; sun.color.setHSL(0.09, 0.6 * (1 - k) + 0.1, 0.55 + 0.4 * k);
  hemi.intensity = 0.15 + 0.45 * clamp(Math.sin(elc) * 4 + 0.3, 0, 1);
  renderer.toneMappingExposure = (0.62 + 0.36 * clamp(Math.sin(elc) * 4 + 0.2, 0, 1)) * (state.inside ? 0.92 : 1);
  scene.fog.color.setHSL(0.58, 0.18, 0.55 + 0.25 * k);
  const e = document.getElementById('sun-info');
  if (e) { const az = sunDir(state.month, state.hour).az * 180 / Math.PI; e.textContent = `hauteur ${Math.round(el * 180 / Math.PI)}°, azimut ${Math.round(az)}° (${cardinal(az)})`; }
  applyLighting();
  clearTimeout(envTimer); envTimer = setTimeout(updateEnv, deferEnv ? 250 : 0);
}
function applyLighting() {
  const m = state.mode, inside = state.inside;
  for (const pl of roomLights) pl.intensity = (inside || (m === 'rdc' && pl.userData.lv === 0) || (m === 'r1' && pl.userData.lv === 1)) ? state.lampI * (pl.userData.k ?? 1) : 0;
  // [perf] vues extérieures : les lampes intérieures (toutes éteintes) sont retirées du rendu, sinon chaque pixel calcule 16 lumières nulles.
  // Deux jeux de lumières seulement (extérieur / intérieur et plans), pour ne recompiler les shaders qu'une fois (cf. precompileInterior)
  const lit = inside || m !== 'ext'; for (const pl of roomLights) pl.visible = lit;
  amb.intensity = inside ? 0.16 : (m === 'ext' ? 0 : 0.14);
  scene.environmentIntensity = envLevel();
  if (gtao) gtao.blendIntensity = inside ? 0.9 : 0.6; // dehors : occlusion adoucie, sinon les menuiseries au fond des tableaux de 20 cm noircissent
  syncRalEnv();
  requestRender();
}
const envLevel = () => state.inside ? state.envI : 0.40;
// RAL 7016 : sans lumière renvoyée par l'enduit clair (pas d'éclairage global), les menuiseries au fond des tableaux, à l'ombre, paraissaient presque noires
// à côté des garde-corps au soleil ; ambiance renforcée sur toutes les pièces 7016 pour qu'elles se lisent de la même teinte, comme en vrai
// (envMapIntensity n'agit que si la carte est posée sur le matériau : avec scene.environment seul, three.js impose environmentIntensity)
const RAL_MATS = ['alu', 'garage', 'pergola', 'soffit', 'fenceAlu', 'handle', 'grille', 'sable', 'slats', 'ral7016', 'c1Steel'];
function syncRalEnv() {
  if (!envRT) return;
  for (const k of RAL_MATS) { const m = M[k]; if (!m) continue; if (m.envMap !== envRT.texture) { m.envMap = envRT.texture; m.needsUpdate = true; } m.envMapIntensity = envLevel() * (state.inside ? 1.5 : 2.6); }
}
function cardinal(a) { return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(((a % 360) + 360) % 360 / 45) % 8]; }
function updateEnv() {
  // ambiance d'éclairage neutre (dégradé ciel gris-bleu clair / horizon / sol) plutôt que le ciel physique très bleu :
  // sans ça le gris 7016 et les façades à l'ombre virent au bleu marine
  const s2 = new THREE.Scene(), el = sunDir(state.month, state.hour).el, k = 0.55 + 0.45 * clamp(Math.sin(el) * 3, 0, 1);
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { k: { value: k } },
    vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float k; varying vec3 vd; void main(){ float y = vd.y; vec3 top = vec3(0.50, 0.56, 0.64), hor = vec3(0.80, 0.80, 0.78), gnd = vec3(0.30, 0.29, 0.26);' +
      ' vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor, gnd, pow(-y, 0.4)); gl_FragColor = vec4(c * k, 1.0); }' });
  s2.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));
  if (envRT) envRT.dispose(); envRT = pmrem.fromScene(s2, 0, 0.1, 2000); scene.environment = envRT.texture; scene.environmentIntensity = envLevel(); syncRalEnv();
  mat.dispose(); requestRender(false);
}

// ---------------------------------------------------------------- vues
const VIEWS = {
  sw: { p: [27.5, 1.75, 21.5], t: [8.5, 3.0, 4.6], mode: 'ext' },
  plonge: { p: [30, 8.5, 26], t: [6.5, 1.5, 5.5], mode: 'ext' },
  ouest: { p: [6.45, 2.4, 25], t: [6.45, 2.9, 4], mode: 'ext' },
  entree: { p: [-4.6, 1.65, 6.6], t: [0, 1.25, 2.3], mode: 'ext' },
  cloture: { p: [-9.5, 1.6, 18.5], t: [1.5, 1.0, 12.9], mode: 'ext' },
  jardin: { p: [-10.8, 1.7, 1.2], t: [0, 2.2, 4.3], mode: 'ext' },
  sud: { p: [25.5, 4.6, 9.8], t: [12.6, 1.6, 2.6], mode: 'ext' },
  pluie: { p: [24.5, 7.5, 15.5], t: [15.5, -0.3, 7.5], mode: 'ext' },
  aerien: { p: [-16, 27, 32], t: [5, 0, 5], mode: 'ext' },
  rdc: { p: [6.45, 19.5, 13.5], t: [6.45, 0, 4.4], mode: 'rdc' },
  r1: { p: [6.45, 22.5, 13.5], t: [6.45, 2.9, 4.4], mode: 'r1' },
  i_sejour: { p: [12.25, 1.65, 3.85], t: [3.0, 1.15, 6.9], mode: 'ext', inside: 1 },
  i_cuisine: { p: [6.2, 1.6, 6.3], t: [1.0, 1.0, 5.0], mode: 'ext', inside: 1 },
  i_entree: { p: [4.9, 1.6, 2.95], t: [0.4, 1.2, 2.0], mode: 'ext', inside: 1 },
  i_ch1: { p: [9.45, 4.42, 3.85], t: [12.2, 3.6, 0.9], mode: 'ext', inside: 1 },
  i_bains: { p: [0.72, 4.47, 0.95], t: [3.6, 3.85, 2.15], mode: 'ext', inside: 1 },
  i_palier: { p: [8.85, 4.42, 3.68], t: [1.5, 3.3, 3.68], mode: 'ext', inside: 1 },
};
let anim = null;
function setView(key, instant) {
  const v = VIEWS[key]; state.mode = v.mode; applyVisibility();
  const to = new THREE.Vector3(...v.p); let tt = new THREE.Vector3(...v.t);
  if (v.inside) { tt = to.clone().add(tt.sub(to).normalize().multiplyScalar(0.6)); }
  controls.minDistance = v.inside ? 0.1 : 1.0; controls.maxPolarAngle = v.inside ? Math.PI * 0.85 : Math.PI * 0.495;
  controls.zoomSpeed = v.inside ? 0.4 : 1; controls.panSpeed = v.inside ? 0.3 : 1;
  if (instant) { camera.position.copy(to); controls.target.copy(tt); controls.update(); anim = null; }
  else anim = { t0: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: to, q1: tt };
  state.lastView = key; state.inside = !!v.inside; camera.fov = v.inside ? 64 : 45; camera.near = v.inside ? 0.05 : 0.2; camera.updateProjectionMatrix(); applyLighting(); updateSun(true);
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === key ? 'true' : 'false'));
}
function applyVisibility() {
  const m = state.mode; const upper = m !== 'rdc'; const roof = state.roof && m === 'ext';
  groups.r1.visible = upper; groups.skinU.visible = upper; groups.skinR.visible = !upper; groups.slab1.visible = upper; groups.volets1.visible = upper && state.volets;
  groups.furn1.visible = upper && state.furn; groups.furn0.visible = state.furn;
  groups.volets0.visible = state.volets; groups.roof.visible = roof; groups.ceil1.visible = roof;
  groups.fence.visible = state.fence; groups.pergola.visible = state.pergola;
  labels.rdc.forEach(o => o.visible = m === 'rdc'); labels.r1.forEach(o => o.visible = m === 'r1');
  const tr = document.getElementById('t-roof'); if (tr) tr.disabled = m !== 'ext';
  requestRender();
}

function tick(now) {
  const dt = Math.min(0.05, (now - (tick.last ?? now)) / 1000); tick.last = now;
  let active = animateDoors(dt); if (active) shadowDirty = true; // un ouvrant qui bouge change les ombres
  if (anim) {
    const k = clamp((now - anim.t0) / 1200, 0, 1); const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(anim.p0, anim.p1, e); controls.target.lerpVectors(anim.q0, anim.q1, e);
    if (k >= 1) anim = null; active = true;
  }
  for (const f of hooks.pre) f(now);
  controls.update();
  // [perf] fin de l'inertie de l'orbite : quand ce qu'il reste à parcourir devient invisible (< 0,5 px), on l'arrête net pour passer plus tôt à l'image pleine qualité
  const sd = controls._sphericalDelta, po = controls._panOffset;
  if (sd && po && controls.state === -1 && Math.abs(sd.theta) < 2e-4 && Math.abs(sd.phi) < 2e-4 && po.lengthSq() < (2e-4 * camera.position.distanceTo(controls.target)) ** 2) { sd.set(0, 0, 0); po.set(0, 0, 0); }
  for (const f of hooks.post) f(now);
  // [perf] rendu à la demande (voir PERF) : changement ponctuel → pleine qualité tout de suite ; mouvement continu → images allégées,
  // puis une image pleine qualité après PERF.settle ms d'immobilité ; rien du tout au repos
  const moved = cameraMoved();
  if (moved || active || dirty) { const hq = !PERF.adaptive || (!moved && !active && activeRun === 0); activeRun++; lastActive = now; draw(now, hq); }
  else { activeRun = 0; if (hqPending && now - lastActive > (controls.state === -1 ? PERF.settle : 1000)) draw(now, true); } // bouton encore enfoncé : on attend un peu plus
}

// ---------------------------------------------------------------- interface
function bindUI() {
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  const tog = (id, key) => { const el = document.getElementById(id); el.checked = state[key]; el.addEventListener('change', () => { state[key] = el.checked; applyVisibility(); }); };
  tog('t-roof', 'roof'); tog('t-furn', 'furn'); tog('t-fence', 'fence'); tog('t-pergola', 'pergola'); tog('t-volets', 'volets'); tog('t-ao', 'ao');
  for (const [id, lvl] of [['tile-r', 'R'], ['tile-w', 'W']]) {
    const s = document.getElementById(id);
    for (const [k, o] of Object.entries(TILE_OPTIONS)) { const op = document.createElement('option'); op.value = k; op.textContent = o.label; s.appendChild(op); }
    s.value = finish[lvl]; s.addEventListener('change', () => setTile(lvl, s.value));
  }
  { const s = document.getElementById('tile-p');
    for (const [k, o] of Object.entries(PARQUET_OPTIONS)) { const op = document.createElement('option'); op.value = k; op.textContent = o.label; s.appendChild(op); }
    s.value = finish.P; s.addEventListener('change', () => setParquet(s.value)); }
  const mo = document.getElementById('month'), hr = document.getElementById('hour'), hl = document.getElementById('hour-label');
  mo.value = String(state.month); hr.value = String(state.hour);
  const fmt = h => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  hl.textContent = fmt(state.hour);
  mo.addEventListener('change', () => { state.month = +mo.value; updateSun(true); });
  hr.addEventListener('input', () => { state.hour = +hr.value; hl.textContent = fmt(state.hour); updateSun(true); });
  // clic sur une porte intérieure, le portail ou le portillon : ouverture / fermeture (les murs et clôtures visibles masquent les ouvrants situés derrière)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), cvs = renderer.domElement; let down = null, lastHover = 0;
  const doorAt = ev => { const r = cvs.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
    const objs = ['rdc', 'r1', 'slab1', 'ceil1', 'skinU', 'skinR', 'furn0', 'furn1', 'roof', 'fence'].map(k => groups[k]).filter(g => g.visible);
    // [perf] d'abord les seuls ouvrants (quelques milliers de triangles) : au survol, presque toujours rien, et on s'arrête là ;
    // sinon lancer complet limité à la distance de l'ouvrant touché, pour vérifier qu'aucun mur ne le masque (même résultat qu'avant)
    const dm = []; for (const d of DOORS) for (const m of d.meshes) { let t = m; while (t.parent && t.parent !== scene) t = t.parent; if (objs.includes(t)) dm.push(m); }
    const dh = ray.intersectObjects(dm, false)[0]; if (!dh) return undefined;
    ray.far = dh.distance + 1e-6; const hit = ray.intersectObjects(objs, true)[0]; ray.far = Infinity; return hit && hit.object.userData.door; };
  cvs.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  cvs.addEventListener('pointerup', ev => { if (!down) return; const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y), quick = performance.now() - down.t < 500; down = null;
    if (moved < 6 && quick) { const d = doorAt(ev); if (d) d.target = d.target > 0.5 ? 0 : 1; } });
  cvs.addEventListener('pointermove', ev => { if (ev.buttons || performance.now() - lastHover < 90) return; lastHover = performance.now(); cvs.style.cursor = doorAt(ev) ? 'pointer' : ''; });
  // [perf] capture en pleine qualité, y compris si elle est demandée pendant un mouvement (écouteur de capture : passe avant celui de nav.js)
  document.getElementById('snap').addEventListener('click', () => { fast = false; setDpr(hqDpr()); requestRender(false); }, true);
  document.getElementById('snap').addEventListener('click', () => {
    if (state.ao && composer && (state.inside || state.mode !== 'ext')) composer.render(); else renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    const dlg = document.getElementById('shot'); document.getElementById('shot-img').src = url; dlg.hidden = false;
    const a = document.getElementById('shot-dl'); a.href = url;
  });
  try { if (window.self !== window.top) document.getElementById('shot-dl').hidden = true; } catch (e) { document.getElementById('shot-dl').hidden = true; }
  // dans la visionneuse claude.ai, le lien de téléchargement passe par la capacité « downloads »
  let saver = null;
  window.claude?.use?.('downloads').then(d => { saver = d; if (d) document.getElementById('shot-dl').hidden = false; }).catch(() => {});
  document.getElementById('shot-dl').addEventListener('click', ev => {
    if (!saver) return; ev.preventDefault();
    const bin = atob(document.getElementById('shot-img').src.split(',')[1] || ''), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length) saver.save({ filename: 'maison-merlettes.png', data: bytes }).catch(() => {});
  });
  document.getElementById('shot-close').addEventListener('click', () => { document.getElementById('shot').hidden = true; });
  const panel = document.getElementById('panel'); document.getElementById('collapse').addEventListener('click', () => { const c = panel.classList.toggle('collapsed'); document.getElementById('collapse').setAttribute('aria-expanded', c ? 'false' : 'true'); });
  if (matchMedia('(max-width: 700px)').matches) { panel.classList.add('collapsed'); document.getElementById('collapse').setAttribute('aria-expanded', 'false'); }
  window.__maquette = { M, groups, DOORS, setView, state, applyVisibility, updateSun, setTile, setParquet, hAt, get composer() { return composer; }, get gtao() { return gtao; }, scene: () => scene, renderer: () => renderer, sun: () => sun, camera: () => camera, controls: () => controls,
    requestRender, perf: PERF, get fast() { return fast; } };
}

init();
