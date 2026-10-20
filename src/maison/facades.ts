// Murs, peau d'enduit, modénatures, menuiseries extérieures, garde-corps, porte d'entrée et porte de garage
import * as THREE from 'three';
import { H, L, D, T, SH, E1, FACE, OPEN, EUR } from './plan';
import { A, wall } from '../noyau/geometrie';
import { M } from '../noyau/materiaux';
import { groups } from '../noyau/etat';

// boîte en coordonnées locales de façade : a (le long), y, d (profondeur depuis le nu extérieur, + vers l'intérieur)
export function LB(face, layer, a0, a1, y0, y1, d0, d1, mat) {
  const f = FACE[face];
  const w0 = f.F - f.s * d0, w1 = f.F - f.s * d1;
  if (f.axis === 'x') A.box(layer, a0, a1, y0, y1, w0, w1, mat); else A.box(layer, w0, w1, y0, y1, a0, a1, mat);
}
// clé de face d'une boîte LB tournée vers l'extérieur / l'intérieur
const outKey = face => { const f = FACE[face]; return f.axis === 'x' ? (f.s > 0 ? 'pz' : 'nz') : (f.s > 0 ? 'px' : 'nx'); };
const inKey = face => { const f = FACE[face]; return f.axis === 'x' ? (f.s > 0 ? 'nz' : 'pz') : (f.s > 0 ? 'nx' : 'px'); };

export function buildShell() {
  for (const lv of [0, 1]) {
    const layer = lv ? 'r1' : 'rdc';
    const y0 = lv ? H.r1Floor : -0.6, y1 = lv ? H.wallTop : H.r1Floor;
    const ops = k => OPEN[k].filter(o => o.lvl === lv);
    const top = lv ? 'enduit' : 'cut';
    // brique + enduit ; le parement extérieur est une peau continue (plus bas)
    wall(layer, 'z', 0, SH, 0, D, y0, y1, ops('N'), { neg: null, pos: 'garageWall', end: 'lisse', top });
    wall(layer, 'z', L - SH, L, 0, D, y0, y1, ops('S'), { neg: 'garageWall', pos: null, end: 'lisse', top });
    wall(layer, 'x', D - SH, D, SH, L - SH, y0, y1, ops('W'), { neg: 'garageWall', pos: null, end: 'lisse', top });
    wall(layer, 'x', 0, SH, SH, L - SH, y0, lv ? H.eaveE : y1, [], { neg: null, pos: 'garageWall', end: 'lisse', top });
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
      // local technique : le plan p. 9 prolonge le doublage du mur est de x 5,31 à 7,01 (bout de la cote 1,70) ; garage 21,36 m² = 7,37 × 2,93 − 1,70 × 0,14
      wall(layer, 'x', SH, T, 5.31, 7.01, -0.13, H.garageCeil, [], P);
    }
  }
  // peau d'enduit continue sur toute la hauteur (et version coupée à +2,87 pour la vue du RDC)
  for (const [layer, top] of [['skinU', null], ['skinR', H.r1Floor]] as [string, number | null][]) {
    const ops = k => top ? OPEN[k].filter(o => o.lvl === 0) : OPEN[k];
    const t = top || H.wallTop, e = 0.008; // peau légèrement en saillie pour masquer les arêtes des tableaux
    wall(layer, 'z', -e, 0, -e, D + e, -0.6, t, ops('N'), { neg: 'enduit', pos: null, end: null, top: null, bottom: null });
    wall(layer, 'z', L, L + e, -e, D + e, -0.6, t, ops('S'), { neg: null, pos: 'enduit', end: null, top: null, bottom: null });
    wall(layer, 'x', D, D + e, -e, L + e, -0.6, t, ops('W'), { neg: null, pos: 'enduit', end: null, top: null, bottom: null });
    wall(layer, 'x', -e, 0, -e, L + e, -0.6, top || H.eaveE, [], { neg: 'enduit', pos: null, end: null, top: null, bottom: null });
  }
  // 4 chaînes d'angle droites lissées à l'éponge (30 cm sur chaque face)
  const q = 0.30, p = 0.02, yb = -0.6, yt = H.wallTop;
  for (const [face, a0, a1] of [['W', 0, q], ['W', L - q, L], ['E', 0, q], ['E', L - q, L], ['N', 0, q], ['N', D - q, D], ['S', 0, q], ['S', D - q, D]]) {
    LB(face, 'rdc', a0, a1, yb, H.r1Floor, -p, 0, 'lisse');
    LB(face, 'r1', a0, a1, H.r1Floor, face === 'E' ? H.eaveE : yt, -p, 0, 'lisse');
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

// vantail mobile : calque propre (groupe rempli par A.build ou à la main), accroché et animé par ouvrants.ts ; inf = géométrie du vantail en repère de façade
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
  // 4 sections (calques propres, roulées sous le plafond par ouvrants.ts) ; chaque joint noir est partagé en deux demi-joints
  for (let k = 0; k < 4; k++) { const ya = y0 + (y1 - y0) * k / 4, yb = y0 + (y1 - y0) * (k + 1) / 4, ly = leafLayer(face, o, { k, y0: ya, y1: yb, d0: 0.235, d1: 0.275 });
    LB(face, ly, a0, a1, ya, yb, 0.235, 0.275, 'garage');
    if (k > 0) LB(face, ly, a0 + 0.01, a1 - 0.01, ya, ya + 0.004, 0.231, 0.235, 'black');
    if (k < 3) LB(face, ly, a0 + 0.01, a1 - 0.01, yb - 0.004, yb, 0.231, 0.235, 'black'); }
  LB(face, layer, a0, a0 + 0.04, y0, y1, 0.20, 0.235, 'blackMatte');
  LB(face, layer, a1 - 0.04, a1, y0, y1, 0.20, 0.235, 'blackMatte');
  LB(face, layer, a0, a1, y1 - 0.04, y1, 0.20, 0.235, 'blackMatte');
  LB(face, layer, a0, a1, y0 - 0.02, y0, -0.03, 0.24, 'galet');
}
