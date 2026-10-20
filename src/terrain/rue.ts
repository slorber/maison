// Rue des Merlettes (limite ouest du terrain) et son débouché sur la rue des Fauvettes, à l'angle sud-ouest : profil en travers,
// bordures, caniveaux, trottoirs, grilles et tampons, panneaux, lampadaires, poteau électrique, bacs à couvercle jaune.
// Tracés, niveaux et mobilier : plan de masse (page 4, 1/200) et plan altimétrique du géomètre (profil RUE de main.js : fils d'eau, bordures,
// nus d'en face, NGF levés) ; matériaux et ouvrages non cotés : photos du 11/10/2026 et du client (12/10/2026), Street View 2021.
// Appelé après buildEnvironment, avant A.build(groups) : nappes et bordures dans les seaux A, mobilier fusionné en un seul maillage (atlas).
import * as THREE from 'three';
import type { Ctx } from '../types';

let C, R; // R : profil de la branche ouest (C.RUE)
const X0 = -80;
// rue des Fauvettes, rive nord à l'ouest du carrefour (au-delà du plan, photos 7, 12) : décalages depuis xSouth(z) ; trottoir jusqu'au mur sud du n° 4 (−0,24, pan coupé)
const FN = { face: 0.42, dos: 0.25, can: 0.72, fond: -0.24, z0: 21.16 };
const BAT = [1.59, 4.89]; // bateau en pavés devant le portail du n° 4 (entre ses piliers) : seul tronçon pavé du trottoir d'en face (client, 12/10/2026)

// ---------------------------------------------------------------- petites opérations vectorielles
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const zo = (x, o) => C.zWest(x) + o; // z d'un point de la rue
const fx = v => typeof v === 'function' ? v : () => v;

// ---------------------------------------------------------------- nappes drapées (seaux A, UV en mètres)
// f(u, v) → [x, y, z] ; nu × nv quadrilatères ; normale orientée selon hint (dessus : [0, 1, 0], faces vues : direction extérieure)
function sheet(mat, f, nu, nv, hint) {
  const P = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) P.push(f(i / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = P[j * (nu + 1) + i], b = P[j * (nu + 1) + i + 1], c = P[(j + 1) * (nu + 1) + i + 1], d = P[(j + 1) * (nu + 1) + i];
    let n = unit(cross(sub(c, a), sub(d, b))); if (dot(n, hint) < 0) n = mul(n, -1);
    C.A.quadN('site', mat, [a, b, c, d], n);
  }
}
// bande le long de la branche ouest : x de xa à xb, décalages oa(x) → ob(x), niveau absolu Y(x, o)
const band = (xa, xb, oa, ob, Y) => { const A = fx(oa), B = fx(ob); return (u, v) => { const x = xa + (xb - xa) * u, o = A(x) + (B(x) - A(x)) * v; return [x, Y(x, o), zo(x, o)]; }; };
// face verticale le long de la branche ouest, au décalage of(x), du niveau y0(x) à y1(x)
const vband = (xa, xb, of, y0, y1) => (u, v) => { const x = xa + (xb - xa) * u, y = y0(x) + (y1(x) - y0(x)) * v; return [x, y, zo(x, fx(of)(x))]; };
// bande le long de la branche sud ou de la rue des Fauvettes : z de za à zb, x de xa(z) à xb(z), niveau hAt + l (drapé sur la surface interpolée des points levés)
const fau = (za, zb, xa, xb, la, lb = la) => { const A = fx(xa), B = fx(xb); return (u, v) => { const z = za + (zb - za) * u, x = A(z) + (B(z) - A(z)) * v; return [x, C.hAt(x, z) + la + (lb - la) * v, z]; }; };
const xs = f => z => C.xSouth(z) + f; // abscisse à f de la limite C–D (prolongée)

// bordure de la branche ouest : face au décalage oF (pied au niveau yF), chanfrein de 2,5 cm, dessus au niveau yT jusqu'au décalage oB
function kerbW(xa, xb, oF, oB, yF, yT, nu) {
  const F = fx(oF), Bk = fx(oB), s = Math.sign(Bk(xa) - F(xa)), ch = (x, o) => yT(x) - 0.02 * clamp(1 - s * (o - F(x)) / 0.025, 0, 1);
  sheet('rueBord', vband(xa, xb, F, yF, x => yT(x) - 0.02), nu, 1, [0, 0, -s]);
  sheet('rueBord', band(xa, xb, F, x => F(x) + s * 0.025, ch), nu, 1, [0, 1, 0]);
  sheet('rueBord', band(xa, xb, x => F(x) + s * 0.025, Bk, x => yT(x)), nu, 1, [0, 1, 0]);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- maillage du mobilier (atlas 4 × 4 cases de 256 px, couleurs par sommet)
const mk = () => ({ pos: [], nor: [], uv: [], col: [], idx: [] });
const GA = mk(), GL = mk(); let G = GA; // GL : diffuseurs des lampadaires (matériau émissif)
const cell = (c, m = 0.01) => { const cx = c % 4, cy = Math.floor(c / 4); return [cx / 4 + m, 1 - (cy + 1) / 4 + m, (cx + 1) / 4 - m, 1 - cy / 4 - m]; }; // u0 v0 u1 v1
const WHITE = [0.125, 0.875]; // centre de la case blanche (0) : la couleur vient des sommets
let K; // couleurs (linéaires)
function poly(p, n, uv?, col?) {
  const i0 = G.pos.length / 3, per = Array.isArray(n[0]); col = col || K.white;
  for (let k = 0; k < p.length; k++) { const q = p[k], nk = per ? n[k] : n, t = uv ? uv[k] : WHITE; G.pos.push(q[0], q[1], q[2]); G.nor.push(nk[0], nk[1], nk[2]); G.uv.push(t[0], t[1]); G.col.push(col.r, col.g, col.b); }
  const na = per ? n.reduce(add, [0, 0, 0]) : n, flip = dot(cross(sub(p[1], p[0]), sub(p[2], p[0])), na) < 0;
  for (let k = 1; k < p.length - 1; k++) flip ? G.idx.push(i0, i0 + k + 1, i0 + k) : G.idx.push(i0, i0 + k, i0 + k + 1);
}
// cylindre (tronc de cône) vertical, normales lissées, chapeau optionnel
function cyl(x, z, y0, y1, r0, r1, n, col, cap) {
  const sl = (r0 - r1) / (y1 - y0);
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI, b = (i + 1) / n * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    poly([[x + r0 * ca, y0, z + r0 * sa], [x + r0 * cb, y0, z + r0 * sb], [x + r1 * cb, y1, z + r1 * sb], [x + r1 * ca, y1, z + r1 * sa]], [unit([ca, sl, sa]), unit([cb, sl, sb]), unit([cb, sl, sb]), unit([ca, sl, sa])], null, col);
  }
  if (cap) poly(Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [x + r1 * Math.cos(a), y1, z + r1 * Math.sin(a)]; }), [0, 1, 0], null, col);
}
// tube entre deux points (bras, câbles, traverses), bouts fermés en option (roues)
function tube(a, b, r, n, col, caps?) {
  const d = unit(sub(b, a)), u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), w = cross(d, u);
  for (let i = 0; i < n; i++) {
    const t0 = i / n * 2 * Math.PI, t1 = (i + 1) / n * 2 * Math.PI, e0 = add(mul(u, Math.cos(t0)), mul(w, Math.sin(t0))), e1 = add(mul(u, Math.cos(t1)), mul(w, Math.sin(t1)));
    poly([add(a, mul(e0, r)), add(a, mul(e1, r)), add(b, mul(e1, r)), add(b, mul(e0, r))], [e0, e1, e1, e0], null, col);
  }
  if (caps) for (const [q, s] of [[a, -1], [b, 1]]) poly(Array.from({ length: n }, (_, i) => { const t = i / n * 2 * Math.PI; return add(q, mul(add(mul(u, Math.cos(t)), mul(w, Math.sin(t))), r)); }), mul(d, s), null, col);
}
// pavé orienté : centre c [x, z], axe local ax (unitaire, plan XZ), demi-côtés hx, hz, de y0 à y1 ; dessus texturé optionnel (case de l'atlas)
function obox(c, ax, hx, hz, y0, y1, col, top?, noBottom?) {
  const az = [-ax[1], ax[0]], P = (sx, sz, y) => [c[0] + sx * hx * ax[0] + sz * hz * az[0], y, c[1] + sx * hx * ax[1] + sz * hz * az[1]];
  const X = [ax[0], 0, ax[1]], Z = [az[0], 0, az[1]];
  poly([P(-1, -1, y1), P(1, -1, y1), P(1, 1, y1), P(-1, 1, y1)], [0, 1, 0], top ? [[top[0], top[1]], [top[2], top[1]], [top[2], top[3]], [top[0], top[3]]] : null, top ? K.white : col);
  if (!noBottom) poly([P(-1, -1, y0), P(1, -1, y0), P(1, 1, y0), P(-1, 1, y0)], [0, -1, 0], null, col);
  poly([P(1, -1, y0), P(1, 1, y0), P(1, 1, y1), P(1, -1, y1)], X, null, col); poly([P(-1, -1, y0), P(-1, 1, y0), P(-1, 1, y1), P(-1, -1, y1)], mul(X, -1), null, col);
  poly([P(-1, 1, y0), P(1, 1, y0), P(1, 1, y1), P(-1, 1, y1)], Z, null, col); poly([P(-1, -1, y0), P(1, -1, y0), P(1, -1, y1), P(-1, -1, y1)], mul(Z, -1), null, col);
}
// rectangle vertical texturé : centre c, direction horizontale ex (gauche → droite vue de face), largeur w, hauteur h, normale n
function vrect(c, ex, w, h, n, r) {
  const L = add(c, mul(ex, -w / 2)), R = add(c, mul(ex, w / 2));
  poly([[L[0], L[1] - h / 2, L[2]], [R[0], R[1] - h / 2, R[2]], [R[0], R[1] + h / 2, R[2]], [L[0], L[1] + h / 2, L[2]]], n, [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);
}
// disque texturé posé sur le terrain (tampons) : chaque sommet au niveau lev + l (lev : hAt, ou dessus d'un trottoir), chant de hauteur e
function hdisc(x, z, l, rad, r, e, n = 24, lev = C.hAt) {
  const uc = (r[0] + r[2]) / 2, vc = (r[1] + r[3]) / 2, du = (r[2] - r[0]) / 2, dv = (r[3] - r[1]) / 2, pts = [], uvs = [];
  for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, px = x + rad * Math.cos(a), pz = z + rad * Math.sin(a); pts.push([px, lev(px, pz) + l, pz]); uvs.push([uc + du * Math.cos(a), vc - dv * Math.sin(a)]); }
  poly(pts, [0, 1, 0], uvs);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], m = unit([(p[0] + q[0]) / 2 - x, 0, (p[2] + q[2]) / 2 - z]); poly([[p[0], p[1] - e, p[2]], [q[0], q[1] - e, q[2]], q, p], m, null, K.iron); }
}
// plaque rectangulaire texturée posée sur le terrain (grilles, tampon carré, plaque de chambre) : coins à lev + l, chants de hauteur e
function plate(c, ax, hx, hz, l, r, e, lev = C.hAt) {
  const az = [-ax[1], ax[0]], P = (sx, sz) => { const px = c[0] + sx * hx * ax[0] + sz * hz * az[0], pz = c[1] + sx * hx * ax[1] + sz * hz * az[1]; return [px, lev(px, pz) + l, pz]; };
  const q = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)]; poly(q, [0, 1, 0], [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);
  for (let i = 0; i < 4; i++) { const p = q[i], k = q[(i + 1) % 4], m = unit([(p[0] + k[0]) / 2 - c[0], 0, (p[2] + k[2]) / 2 - c[1]]); poly([[p[0], p[1] - e, p[2]], [k[0], k[1] - e, k[2]], k, p], m, null, K.iron); }
}

// ---------------------------------------------------------------- textures et matériaux
function buildMaterials() {
  const { makeTex, pixelNoise, rng, std, M } = C;
  // bordures et caniveaux béton, éléments de 1 m (joint en u = x le long des Merlettes ; variante Z : joint en v, pour les éléments posés selon Z)
  const bord = jz => makeTex(256, 1.0, (g, s) => {
    pixelNoise(g, s, '#bcb8ae', 0.05, 0.07, 4, jz ? 902 : 901); const r = rng(903);
    for (let i = 0; i < 25; i++) { g.fillStyle = `rgba(70,66,60,${0.04 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * s, r() * s, 6 + r() * 25, 3 + r() * 10, r() * 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(50,47,43,0.65)'; if (jz) g.fillRect(0, 0, s, 3); else g.fillRect(0, 0, 3, s);
  });
  M.rueBord = std({ map: bord(false), roughness: 0.92 }); M.rueBordZ = std({ map: bord(true), roughness: 0.92 });
  // pavés béton 20 × 10 en chevrons à 45° (devant les portails d'en face) : réseau périodique de 8 √2 × 10 cm, teintes par pavé périodiques
  const u = 0.1, T = 8 * Math.SQRT2 * u;
  M.ruePave = std({ map: makeTex(512, T, (g, s) => {
    const k = s / T * u, hsh = (a, b, t) => { const h = Math.sin(((a % 8 + 8) % 8) * 12.9898 + ((b % 4 + 4) % 4) * 78.233 + t * 37.7) * 43758.5; return h - Math.floor(h); };
    g.fillStyle = '#7d776d'; g.fillRect(0, 0, s, s); g.save(); g.scale(k, k); g.rotate(-Math.PI / 4); g.lineWidth = 0.11; g.strokeStyle = '#6f695f';
    const tone = f => { const l = 0.9 + f * 0.18; return `rgb(${170 * l | 0},${163 * l | 0},${151 * l | 0})`; };
    for (let a = -4; a <= 12; a++) for (let b = -7; b <= 3; b++) {
      const x = a + 2 * b, y = a - 2 * b;
      g.fillStyle = tone(hsh(a, b, 0)); g.fillRect(x, y, 2, 1); g.strokeRect(x, y, 2, 1);
      g.fillStyle = tone(hsh(a, b, 1)); g.fillRect(x, y + 1, 1, 2); g.strokeRect(x, y + 1, 1, 2);
    }
    g.restore(); const img = g.getImageData(0, 0, s, s), d = img.data, r = rng(911); for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  }), roughness: 0.9 });
  M.rueAtlas = std({ map: makeTex(1024, 1, drawAtlas), vertexColors: true, roughness: 0.6, metalness: 0.12 });
  M.rueDiff = std({ color: '#f4f1e8', roughness: 0.3, emissive: '#fff2d2', emissiveIntensity: 0.25 });
  K = Object.fromEntries(Object.entries({ white: '#ffffff', iron: '#2c2824', pole: '#26292c', galva: '#8d9396', concrete: '#b9b4a8', wire: '#141414', binBody: '#464a4e', binLid: '#e3b51b', rubber: '#121212', brown: '#5b3a26' }).map(([k, v]) => [k, new THREE.Color(v)]));
}
// atlas : 0 blanc, 1 tampon à studs concentriques (photo 12), 2 tampon à ondes (photo 17), 3 grille de caniveau (tronçon de 0,49 m),
// 4 grille d'avaloir, 5 tampon carré (photos 6, 7), 6 plaque striée de chambre (photo 16), 7 bouche à clé, 8 panneau C12, 9 dos de panneau, 10–11 plaque de rue
function drawAtlas(g) {
  const S = 256, inC = (c, fn) => { g.save(); g.translate((c % 4) * S, Math.floor(c / 4) * S); g.beginPath(); g.rect(0, 0, c === 10 ? 2 * S : S, S); g.clip(); fn(); g.restore(); };
  const disc = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const grain = (x, y, w, h, a, seed) => { let t = seed; for (let i = 0; i < w * h / 6; i++) { t = (t * 9301 + 49297) % 233280; const q = t / 233280; t = (t * 9301 + 49297) % 233280; const p = t / 233280; g.fillStyle = q < 0.5 ? `rgba(0,0,0,${a})` : `rgba(160,110,70,${a})`; g.fillRect(x + q * w, y + p * h, 2, 2); } };
  g.fillStyle = '#2a2622'; g.fillRect(0, 0, 4 * S, 4 * S);
  inC(0, () => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); });
  inC(1, () => {
    disc(128, 128, 127, '#4a3f35'); disc(128, 128, 118, '#221d19'); disc(128, 128, 115, '#5a4a3c');
    for (let k = 0; k < 8; k++) { const r = 18 + k * 12.3, n = Math.floor(2 * Math.PI * r / 13); for (let i = 0; i < n; i++) { const a = (i + 0.5 * (k % 2)) * 2 * Math.PI / n; g.save(); g.translate(128 + r * Math.cos(a), 128 + r * Math.sin(a)); g.rotate(a + Math.PI / 2); g.fillStyle = '#8b745d'; g.fillRect(-4.5, -3, 9, 6); g.fillStyle = 'rgba(15,12,10,0.55)'; g.fillRect(-4.5, 3, 9, 2); g.restore(); } }
    disc(128, 128, 9, '#7c6650'); g.fillStyle = '#1c1815'; g.fillRect(196, 120, 14, 16); grain(10, 10, 236, 236, 0.18, 7);
  });
  inC(2, () => {
    disc(128, 128, 127, '#4f4237'); disc(128, 128, 120, '#211b17'); disc(128, 128, 117, '#6f5744');
    g.save(); g.beginPath(); g.arc(128, 128, 112, 0, 7); g.clip(); g.strokeStyle = '#271e18'; g.lineWidth = 6;
    for (let x = 26; x < 240; x += 34) { g.beginPath(); for (let y = 0; y <= 256; y += 4) { const px = x + 8 * Math.sin(y / 256 * 2 * Math.PI * 4); y ? g.lineTo(px, y) : g.moveTo(px, y); } g.stroke(); }
    g.restore(); disc(70, 205, 8, '#15110e'); disc(186, 205, 8, '#15110e'); grain(10, 10, 236, 236, 0.15, 11);
  });
  inC(3, () => { g.fillStyle = '#3b3530'; g.fillRect(0, 0, S, S); g.fillStyle = '#57504a'; g.fillRect(0, 0, S, 12); g.fillRect(0, S - 12, S, 12); const n = 14, w = S / n; g.fillStyle = '#0b0a09'; for (let i = 0; i < n; i++) g.fillRect(i * w + w * 0.28, 40, w * 0.44, S - 80); grain(0, 0, S, S, 0.2, 13); });
  inC(4, () => { g.fillStyle = '#433c36'; g.fillRect(0, 0, S, S); g.fillStyle = '#2e2925'; g.fillRect(16, 16, S - 32, S - 32); const n = 9, w = (S - 48) / n; g.fillStyle = '#0a0908'; for (let i = 0; i < n; i++) g.fillRect(24 + i * w + w * 0.2, 30, w * 0.6, S - 60); grain(0, 0, S, S, 0.2, 17); });
  inC(5, () => { g.fillStyle = '#3a322b'; g.fillRect(0, 0, S, S); g.fillStyle = '#5e4d3f'; g.fillRect(14, 14, S - 28, S - 28); g.strokeStyle = '#3b3028'; g.lineWidth = 5; for (const r of [100, 78, 56, 34]) { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); } for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * Math.PI; g.beginPath(); g.moveTo(128 + 34 * Math.cos(a), 128 + 34 * Math.sin(a)); g.lineTo(128 + 100 * Math.cos(a), 128 + 100 * Math.sin(a)); g.stroke(); } grain(14, 14, S - 28, S - 28, 0.18, 19); });
  inC(6, () => { g.fillStyle = '#a7a39a'; g.fillRect(0, 0, S, S); g.fillStyle = '#5c4a3b'; g.fillRect(14, 14, S - 28, S - 28); g.fillStyle = '#7a6350'; for (let j = 0; j < 15; j++) for (let i = 0; i < 15; i++) { g.save(); g.translate(22 + i * 15, 22 + j * 15); g.rotate((i + j) % 2 ? Math.PI / 4 : -Math.PI / 4); g.fillRect(-5, -1.5, 10, 3); g.restore(); } grain(14, 14, S - 28, S - 28, 0.22, 23); });
  inC(7, () => { disc(128, 128, 127, '#4a4038'); disc(128, 128, 100, '#1f1a17'); disc(128, 128, 95, '#5a4b3e'); g.strokeStyle = '#3a3028'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 32, 0, 7); g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * Math.PI; g.beginPath(); g.moveTo(128 + 45 * Math.cos(a), 128 + 45 * Math.sin(a)); g.lineTo(128 + 85 * Math.cos(a), 128 + 85 * Math.sin(a)); g.stroke(); } });
  inC(8, () => { // panneau C12 « sens unique » : fond bleu, listel et flèche blancs
    const rr = (x, y, w, h, r, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
    rr(2, 2, S - 4, S - 4, 22, '#f2f2ee'); rr(14, 14, S - 28, S - 28, 14, '#1f5aa5');
    g.fillStyle = '#f2f2ee'; g.fillRect(104, 110, 48, 106); g.beginPath(); g.moveTo(56, 116); g.lineTo(200, 116); g.lineTo(128, 40); g.closePath(); g.fill();
  });
  inC(9, () => { g.fillStyle = '#9ba1a4'; g.fillRect(0, 0, S, S); g.fillStyle = '#7d8386'; g.fillRect(0, 0, S, 10); g.fillRect(0, S - 10, S, 10); g.fillRect(0, 0, 10, S); g.fillRect(S - 10, 0, 10, S); g.fillStyle = '#6f7477'; g.fillRect(0, 100, S, 56); });
  inC(10, () => { // plaque de rue (Street View 2021, photo 8) : fond brun, filet et lettres crème
    g.fillStyle = '#5a3925'; g.fillRect(0, 0, 2 * S, S); g.strokeStyle = '#e6d6a6'; g.lineWidth = 7; g.beginPath(); g.roundRect(13, 13, 2 * S - 26, S - 26, 14); g.stroke();
    g.fillStyle = '#e9dbad'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 30px sans-serif'; g.fillText('DEUIL-LA-BARRE', S, 56, 420); g.font = 'bold 50px sans-serif'; g.fillText('RUE', S, 114, 420); g.font = 'bold 62px sans-serif'; g.fillText('DES MERLETTES', S, 186, 450);
  });
}

// ---------------------------------------------------------------- profil en travers et carrefour (nappes et bordures)
// branche ouest (profil RUE, niveaux absolus) : notre trottoir en enrobé de la limite au dos de la bordure (15 cm), chaussée bombée, caniveau béton de 30 cm,
// bordure de 17 cm, trottoir d'en face en enrobé jusqu'aux nus (pavés au seul bateau du n° 4) ; retours des deux bordures à l'angle (plan : x 18,40 et 18,10) ;
// carrefour et branche sud drapés sur la surface interpolée des points levés
function profile() {
  const up = [0, 1, 0], XR = R.XR, XRW = R.XRW, P0 = R.PC[0][0], nu = Math.round((XR - X0) / 1.0);
  const SW = x => R.SW(x), SWo = x => R.SWo(x), oG = x => R.oG(x), oW = x => R.oW(x), front = x => R.front(x);
  // notre côté : trottoir, bordure, retour de la bordure vers la limite (face sud en XR)
  sheet('asphalt', band(X0, XR - 0.15, -0.03, x => oG(x) - 0.15, SW), nu, 1, up); // 3 cm sous le muret : seuil du portillon
  kerbW(X0, XR, oG, x => oG(x) - 0.15, x => R.FE(x) - 0.01, SW, nu);
  sheet('rueBordZ', band(XR - 0.15, XR, 0, x => oG(x) - 0.15, SW), 1, 2, up);
  sheet('rueBord', (u, v) => { const o = R.oG(XR) * u, z = zo(XR, o), g = C.hAt(XR + 0.01, z) - 0.01; return [XR, g + (SW(XR) - 0.02 - g) * v, z]; }, 3, 1, [1, 0, 0]);
  // chaussée, caniveau, bordure d'en face, retour de la bordure vers le pan coupé du n° 4 (fil d'eau en XRW)
  sheet('asphalt', band(X0, XR, oG, x => oW(x) - 0.30, (x, o) => R.road(x, o) + 0.003), nu, 6, up);
  sheet('rueBord', band(X0, XRW, x => oW(x) - 0.30, oW, (x, o) => R.road(x, o) + 0.004), nu, 2, up);
  kerbW(X0, XRW, oW, x => oW(x) + 0.17, x => R.FEW(x) - 0.01, SWo, nu);
  sheet('rueBordZ', band(XRW - 0.17, XRW, x => oW(x) + 0.17, front, SWo), 1, 4, up);
  sheet('rueBord', (u, v) => { const o = R.oW(XRW) + (front(XRW) - R.oW(XRW)) * u, z = zo(XRW, o), g = C.hAt(XRW + 0.01, z) - 0.01; return [XRW, g + (SWo(XRW) - g) * v, z]; }, 4, 1, [1, 0, 0]);
  // trottoir d'en face : enrobé, pavés en chevrons au bateau du n° 4 (tranchée rebouchée en enrobé en travers des pavés, photo 17), fermeture sous les murs
  const tr = (mat, xa, xb, l = 0) => sheet(mat, band(xa, xb, x => oW(x) + 0.17, front, x => SWo(x) + l), Math.max(1, Math.round((xb - xa) / 1.0)), 2, up);
  tr('asphalt', X0, BAT[0]); tr('ruePave', BAT[0], BAT[1]); tr('asphalt', BAT[1], P0); tr('asphalt', P0, XRW - 0.17); tr('asphalt', 3.3, 3.7, 0.003);
  sheet('rueBord', vband(X0, P0, front, x => SWo(x) - 0.25, SWo), nu, 1, [0, 0, 1]);
  // carrefour : entre les retours, puis jusqu'au fil d'eau d'en face de la branche sud (RUE.xFS) et au pan coupé du n° 4 ; branche sud vers l'ouest (rue des Fauvettes)
  const zPC = x => R.PC[0][1] + (R.PC[1][1] - R.PC[0][1]) * (x - P0) / (R.PC[1][0] - P0);
  sheet('asphalt', band(XRW, XR, x => oW(x) - 0.30, front, (x, o) => C.hAt(x, zo(x, o)) + 0.003), 1, 6, up);
  sheet('asphalt', (u, v) => { const x0 = XR + (24.62 - XR) * u, za = C.zWest(x0), zb = x0 < R.PC[1][0] ? zPC(x0) : FN.z0, z = za + (zb - za) * v, x = Math.min(x0, R.xFS(z)); return [x, C.hAt(x, z) + 0.003, z]; }, 26, 10, up);
  const zE = 60, nz = Math.round((zE - FN.z0) / 1.0);
  sheet('asphalt', fau(FN.z0, zE, xs(FN.can), R.xFS, 0.003), nz, 8, up);
  // rive nord des Fauvettes (au-delà du plan, photos 7, 12) : caniveau, bordure (vue 10 cm), trottoir en enrobé jusqu'au mur sud du n° 4, about contre le pan coupé
  sheet('rueBordZ', fau(FN.z0, zE, xs(FN.can), xs(FN.face), 0.004), nz, 2, up);
  sheet('rueBord', (u, v) => { const z = FN.z0 + (zE - FN.z0) * u, x = C.xSouth(z) + FN.face, g = C.hAt(x, z); return [x, g + 0.08 * v, z]; }, nz, 1, [1, 0, 0]);
  sheet('rueBordZ', fau(FN.z0, zE, xs(FN.face), xs(FN.face - 0.025), 0.08, 0.10), nz, 1, up);
  sheet('rueBordZ', fau(FN.z0, zE, xs(FN.face - 0.025), xs(FN.dos), 0.10), nz, 1, up);
  sheet('asphalt', fau(FN.z0, zE, xs(FN.dos), xs(FN.fond), 0.10), nz, 1, up);
  sheet('rueBord', (u, v) => { const x = C.xSouth(FN.z0) + FN.fond + (FN.face - FN.fond) * u, g = C.hAt(x, FN.z0); return [x, g + 0.10 * v, FN.z0]; }, 2, 1, [0, 0, -1]);
  // branche sud, rive d'en face : bordure (vue 10 cm, R5 / R6) au fil d'eau du plan, trottoir jusqu'au nu des propriétés (n° 6), à partir du lampadaire (z 5,74)
  const zS = 5.74, ns = Math.round((zE - zS) / 1.0);
  sheet('rueBord', (u, v) => { const z = zS + (zE - zS) * u, x = R.xFS(z), g = C.hAt(x, z); return [x, g + 0.10 * v, z]; }, ns, 1, [-1, 0, 0]);
  sheet('curb', fau(zS, zE, R.xFS, R.xS6, 0.10), ns, 2, up);
  sheet('rueBord', (u, v) => { const x = R.xFS(zS) + (R.xS6(zS) - R.xFS(zS)) * u, g = C.hAt(x, zS); return [x, g + 0.10 * v, zS]; }, 2, 1, [0, 0, -1]);
}

// ---------------------------------------------------------------- eaux pluviales et réseaux : grilles, tampons, bouches à clé, chambre (positions du plan de masse)
function covers() {
  const LJ = 0.005; // au-dessus de l'enrobé (0,003)
  const onSide = l => (x, z) => R.y(x, z - C.zWest(x)) + l; // dessus des trottoirs (niveaux absolus du profil)
  // caniveau à grille en travers du débouché (plan : 0,22 × 2,91, de notre fil d'eau au fil d'eau d'en face), 6 tronçons
  { const pE = [18.46, 14.465], pW = [18.37, 17.375], d = [pW[0] - pE[0], pW[1] - pE[1]], len = Math.hypot(d[0], d[1]), ax = [d[0] / len, d[1] / len], n = 6;
    for (let i = 0; i < n; i++) plate([pE[0] + d[0] * (i + 0.5) / n, pE[1] + d[1] * (i + 0.5) / n], ax, len / n / 2, 0.11, LJ, cell(3), 0.04); }
  // grille d'avaloir au bout du caniveau d'en face (plan : 0,40 × 0,23)
  plate([18.42, 17.755], [1, 0], 0.20, 0.115, LJ, cell(4), 0.04);
  // tampons d'assainissement (plan) : carrefour (Ø 0,80 à studs concentriques, photos 12, 18), branche sud, branche ouest au nord ; tampon de chaussée S8 (Ø 0,74 à ondes, photo 17)
  hdisc(20.43, 14.92, LJ, 0.40, cell(1), 0.04, 28);
  for (const [x, z] of [[22.30, 1.31], [23.22, 2.18], [-17.21, 15.40], [4.73, 16.31]]) hdisc(x, z, LJ, 0.37, cell(2), 0.03, 28);
  // bouches à clé Ø 0,17 (plan : E au carrefour, branche ouest)
  for (const [x, z] of [[19.89, 16.49], [20.59, 16.66], [5.48, 15.66], [-14.03, 14.51]]) hdisc(x, z, LJ, 0.085, cell(7), 0.03, 12);
  // tampon carré de 0,45 sur le trottoir d'en face, devant le portillon du n° 4 (point S10, 55,56)
  { const x = 5.77; plate([x, zo(x, 4.85)], [1, 0], 0.225, 0.225, 0, cell(5), 0.03, onSide(0.008)); }
  // chambre de tirage France Télécom L1T 0,49 × 0,38 (plan : x −11,10 → −10,61, de la limite au dos de la bordure) : sur notre trottoir, à son niveau, contre notre clôture
  { const x = -10.855, u = [1, 0.03872], l = Math.hypot(u[0], u[1]); plate([x, zo(x, 0.14)], [u[0] / l, u[1] / l], 0.245, 0.19, 0, cell(6), 0.04, onSide(0.006)); }
}

// ---------------------------------------------------------------- panneaux à l'angle sud-ouest du terrain
// poteau noir sur notre trottoir (plan de masse : x 17,51, à 0,23 de la limite) ; panneau C12 « sens unique » de 0,55
// (bas à 2,92 m) tourné vers le carrefour (face au sud, 20° vers l'ouest : vu de face sur la photo 12) ; dessous, plaque de rue brune 0,60 × 0,34 au nord du poteau,
// dans le plan de la rue, lisible des deux côtés (photo 8 ; plaque vue de biais sur 12, 13, 18) ; tailles et hauteurs mesurées sur la photo 12
const SIGN = [17.51, 0.23];
function signs() {
  const [x, o] = SIGN, z = zo(x, o), y0 = R.y(x, o);
  cyl(x, z, y0 - 0.05, y0 + 3.45, 0.035, 0.035, 10, K.pole, true);
  const a = 20 * Math.PI / 180, n = [Math.cos(a), 0, Math.sin(a)], ex = [Math.sin(a), 0, -Math.cos(a)], c = [x + n[0] * 0.05, y0 + 3.195, z + n[2] * 0.05];
  vrect(c, ex, 0.55, 0.55, n, cell(8)); vrect(add(c, mul(n, -0.012)), mul(ex, -1), 0.55, 0.55, mul(n, -1), cell(9));
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const e = add(c, add(mul(ex, sx * 0.275), [0, sy * 0.275, 0])), t = sx ? [0, 0.275, 0] : mul(ex, 0.275), q = mul(n, -0.012); const nn = sx ? mul(ex, sx) : [0, sy, 0]; poly([sub(e, t), add(e, t), add(add(e, t), q), add(sub(e, t), q)], nn, null, K.galva); }
  for (const yy of [3.045, 3.275]) obox([x + n[0] * 0.015, z + n[2] * 0.015], [n[0], n[2]], 0.02, 0.03, y0 + yy, y0 + yy + 0.05, K.galva);
  // plaque de rue : de x − 0,035 à x − 0,635, de 2,55 à 2,89 m, épaisseur 2 cm, faces ouest (lue du nord vers le sud) et est
  const pc = [x - 0.335, y0 + 2.72, z], r = cell(10); r[2] = 1 - 0.01;
  vrect(add(pc, [0, 0, 0.011]), [1, 0, 0], 0.60, 0.34, [0, 0, 1], r); vrect(add(pc, [0, 0, -0.011]), [-1, 0, 0], 0.60, 0.34, [0, 0, -1], r);
  obox([pc[0], z], [1, 0], 0.30, 0.0105, y0 + 2.55, y0 + 2.89, K.brown, null);
  for (const yy of [2.62, 2.80]) obox([x, z], [1, 0], 0.055, 0.045, y0 + yy, y0 + yy + 0.05, K.galva);
}

// ---------------------------------------------------------------- lampadaires : fût fin anthracite, manchon, fourche en Y dans le plan de la rue,
// tête annulaire plate Ø 0,58 à 5,45 m (photos 12, 13, 14, 15, 16 : fourche vue ouverte depuis l'ouest, fermée depuis le sud)
// positions du plan de masse : branche ouest, sur notre trottoir (au nord : x −9,77, à 0,155 de la limite, presque contre la clôture ; au sud : x 9,28, à 0,30) ;
// branche sud, sur le trottoir d'en face (x 25,11 ; z 5,74 et x 25,19 ; z 23,31), fourche dans le plan de la branche sud
const LAMPS_W = [[-9.77, 0.155], [9.28, 0.30]], LAMPS_S = [[25.11, 5.74], [25.19, 23.31]];
function lamps() {
  const L = LAMPS_W.map(([x, o]) => [x, zo(x, o), R.y(x, o), 0]).concat(LAMPS_S.map(([x, z]) => [x, z, C.hAt(x, z) + 0.10, 1]));
  for (const [x, z, y0, rot] of L) {
    const P = (d, y) => rot ? [x, y0 + y, z + d] : [x + d, y0 + y, z];
    cyl(x, z, y0 - 0.05, y0 + 0.25, 0.075, 0.075, 12, K.pole, false);
    cyl(x, z, y0 + 0.25, y0 + 4.58, 0.062, 0.046, 12, K.pole, false);
    cyl(x, z, y0 + 4.58, y0 + 4.68, 0.05, 0.068, 12, K.pole, false); cyl(x, z, y0 + 4.68, y0 + 4.81, 0.068, 0.04, 12, K.pole, true);
    for (const s of [-1, 1]) { tube(P(0, 4.79), P(s * 0.10, 5.11), 0.02, 6, K.pole); tube(P(s * 0.10, 5.11), P(s * 0.27, 5.44), 0.018, 6, K.pole); }
    cyl(x, z, y0 + 5.43, y0 + 5.50, 0.29, 0.29, 28, K.pole, true); cyl(x, z, y0 + 5.50, y0 + 5.53, 0.13, 0.07, 16, K.pole, true);
    G = GL; poly(Array.from({ length: 24 }, (_, i) => { const a = i / 24 * 2 * Math.PI; return [x + 0.24 * Math.cos(a), y0 + 5.426, z + 0.24 * Math.sin(a)]; }), [0, -1, 0]); G = GA;
  }
}

// ---------------------------------------------------------------- poteau électrique béton (réseau aérien), côté est, au nord du voisin nord (hors plan)
// (photos 5, 12, 13, 17 : poteau gris à l'extrémité de la façade du voisin nord, au bord de la chaussée, posé sur le trottoir) ; câbles vers l'ouest (au-dessus des maisons
// d'en face) et branchement sur la façade nord du voisin nord (photos 5, 12)
const POLE = [-28.0, 0.15];
function pole() {
  const [x, o] = POLE, z = zo(x, o), y0 = R.y(x, o), H = 8.5;
  cyl(x, z, y0 - 0.1, y0 + H, 0.14, 0.085, 8, K.concrete, true);
  tube([x, y0 + 8.15, z - 0.55], [x, y0 + 8.15, z + 0.55], 0.03, 6, K.galva); tube([x + 0.09, y0 + 7.75, z - 0.25], [x + 0.09, y0 + 7.75, z + 0.25], 0.025, 6, K.galva);
  for (const dz of [-0.45, 0, 0.45]) cyl(x, z + dz, y0 + 8.18, y0 + 8.30, 0.035, 0.025, 6, K.wire, true);
  const span = (a, b, sag, n = 10) => { for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, p = t => add(add(a, mul(sub(b, a), t)), [0, -4 * sag * t * (1 - t), 0]); tube(p(t0), p(t1), 0.008, 4, K.wire); } };
  for (const dz of [-0.45, 0.45]) span([x, y0 + 8.30, z + dz], [x - 1.5, y0 + 7.4, zo(x - 1.5, 36)], 0.9, 14);
  // voisin nord (env.js northHouse : x −25,4 → −17,8, z 0,3 → 10,3, rez-de-chaussée 0,25 au-dessus du point haut du terrain)
  const gh = Math.max(...[[-25.4, 0.3], [-25.4, 10.3], [-17.8, 0.3], [-17.8, 10.3], [-21.6, 5.3]].map(p => C.hAt(p[0], p[1]))) + 0.25;
  for (const zz of [9.5, 8.9]) span([x + 0.09, y0 + 7.78, z - 0.2], [-25.42, gh + 2.9, zz], 0.35, 8);
}

// ---------------------------------------------------------------- bacs roulants 240 L à couvercle jaune sur le trottoir ouest (photos 12, 13, 14)
// devant le portail du n° 4, juste au nord du tampon carré du portillon (photo 13), et plus au nord devant le mur crème ; roues et poignée côté sud (photo 12)
const BINS = [7.2, -8.5]; // contre les murs d'en face (nu à RUE.oF)
function bins() {
  for (const x of BINS) {
    const o = R.oF(x) - 0.35, z = zo(x, o), y0 = R.y(x, o), P = (dx, dz, y) => [x + dx, y0 + y, z + dz];
    const b0 = [P(-0.30, -0.25, 0.05), P(0.30, -0.25, 0.05), P(0.30, 0.25, 0.05), P(-0.30, 0.25, 0.05)], b1 = [P(-0.36, -0.29, 1.0), P(0.36, -0.29, 1.0), P(0.36, 0.29, 1.0), P(-0.36, 0.29, 1.0)];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, q = [b0[i], b0[j], b1[j], b1[i]], m = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25), c = [x, m[1], z]; poly(q, unit([m[0] - c[0], 0.08, m[2] - c[2]]), null, K.binBody); }
    poly(b0, [0, -1, 0], null, K.binBody);
    obox([x, z], [1, 0], 0.39, 0.30, y0 + 1.0, y0 + 1.05, K.binLid); obox([x + 0.40, z], [1, 0], 0.025, 0.25, y0 + 0.93, y0 + 0.98, K.binBody);
    for (const s of [-1, 1]) tube(P(0.30, s * 0.20, 0.10), P(0.30, s * 0.27, 0.10), 0.10, 10, K.rubber, true);
    tube(P(0.30, -0.27, 0.10), P(0.30, 0.27, 0.10), 0.015, 6, K.binBody);
  }
}

// ---------------------------------------------------------------- point d'entrée
export function buildRue(ctx: Ctx) {
  C = ctx; R = ctx.RUE;
  buildMaterials();
  profile(); covers(); signs(); lamps(); pole(); bins();
  for (const [g, mat, sh] of [[GA, 'rueAtlas', true], [GL, 'rueDiff', false]] as [typeof GA, string, boolean][]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2)); if (mat === 'rueAtlas') geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3)); geo.setIndex(g.idx);
    const m = new THREE.Mesh(geo, C.M[mat]); m.castShadow = sh; m.receiveShadow = true; C.groups.site.add(m);
  }
}
