// Environnement (voisinage, rues, arbres) : appelé avant A.build(groups)
// D'après les 11 photos de chantier (sept.–oct. 2026) et la vue aérienne : maison de maître à l'est (terrain +0,85), mur de soutènement
// en limite est, maison R+C au nord, maisons en face (rue des Merlettes à l'ouest, rue des Fauvettes au sud), lampadaires. Volumes indicatifs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let C; // contexte de la maquette (main.js)
const RAD = Math.PI / 180;
const V3 = a => new THREE.Vector3(a[0], a[1], a[2]);
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ---------------------------------------------------------------- faces inclinées (toitures, lucarnes) : UV en mètres, alignées sur la pente
const RF = new Map();
function rface(layer, mat, pts, hint) {
  const a = V3(pts[0]), b = V3(pts[1]), c = V3(pts[2]);
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  if (hint && n.dot(V3(hint)) < 0) { pts = [...pts].reverse(); n.negate(); }
  n.normalize();
  const h = new THREE.Vector3(0, 1, 0).cross(n); if (h.lengthSq() < 1e-6) h.set(1, 0, 0); h.normalize();
  const s = n.clone().cross(h); // s : vers le haut de la pente
  const k = layer + '|' + mat; let bk = RF.get(k); if (!bk) { bk = { layer, mat, pos: [], nor: [], uv: [] }; RF.set(k, bk); }
  const P = pts.map(V3);
  for (let i = 1; i < P.length - 1; i++) for (const q of [P[0], P[i], P[i + 1]]) { bk.pos.push(q.x, q.y, q.z); bk.nor.push(n.x, n.y, n.z); bk.uv.push(q.dot(h), q.dot(s)); }
}
function flushFaces() {
  for (const b of RF.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    const m = new THREE.Mesh(g, C.M[b.mat]); m.castShadow = m.receiveShadow = true; C.groups[b.layer].add(m);
  }
  RF.clear();
}
// toiture 4 pans quelconque (faîtage selon le plus grand côté), égout ye au nu extérieur du débord ; sous-face plate optionnelle
function hip(layer, mat, x0, x1, z0, z1, ye, pitch, soffit) {
  const t = Math.tan(pitch * RAD), lx = x1 - x0, lz = z1 - z0; let r;
  if (lx >= lz) {
    const run = lz / 2, yr = ye + run * t, zr = (z0 + z1) / 2, r0 = x0 + run, r1 = x1 - run;
    rface(layer, mat, [[x0, ye, z0], [x1, ye, z0], [r1, yr, zr], [r0, yr, zr]], [0, 1, -1]);
    rface(layer, mat, [[x1, ye, z1], [x0, ye, z1], [r0, yr, zr], [r1, yr, zr]], [0, 1, 1]);
    rface(layer, mat, [[x0, ye, z1], [x0, ye, z0], [r0, yr, zr]], [-1, 1, 0]);
    rface(layer, mat, [[x1, ye, z0], [x1, ye, z1], [r1, yr, zr]], [1, 1, 0]);
    r = { yr, a: [r0, zr], b: [r1, zr] };
  } else {
    const run = lx / 2, yr = ye + run * t, xr = (x0 + x1) / 2, r0 = z0 + run, r1 = z1 - run;
    rface(layer, mat, [[x0, ye, z0], [x0, ye, z1], [xr, yr, r1], [xr, yr, r0]], [-1, 1, 0]);
    rface(layer, mat, [[x1, ye, z1], [x1, ye, z0], [xr, yr, r0], [xr, yr, r1]], [1, 1, 0]);
    rface(layer, mat, [[x0, ye, z0], [x1, ye, z0], [xr, yr, r0]], [0, 1, -1]);
    rface(layer, mat, [[x1, ye, z1], [x0, ye, z1], [xr, yr, r1]], [0, 1, 1]);
    r = { yr, a: [xr, r0], b: [xr, r1] };
  }
  if (soffit) C.A.quadN(layer, soffit, [[x0, ye, z0], [x1, ye, z0], [x1, ye, z1], [x0, ye, z1]], [0, -1, 0]);
  return r;
}
// toiture 2 pans (faîtage selon X si alongX), pignons dans le matériau des murs, sous-face des débords
function gable(layer, mat, wmat, x0, x1, z0, z1, yw, pitch, alongX, ov) {
  const t = Math.tan(pitch * RAD), ye = yw - ov * t, A = C.A;
  if (alongX) {
    const zr = (z0 + z1) / 2, yr = yw + (z1 - z0) / 2 * t;
    for (const [ze, sg] of [[z0 - ov, -1], [z1 + ov, 1]]) {
      const p = [[x0 - ov, ye, ze], [x1 + ov, ye, ze], [x1 + ov, yr, zr], [x0 - ov, yr, zr]];
      rface(layer, mat, p, [0, 1, sg]); rface(layer, 'envSoffit', p, [0, -1, -sg]);
    }
    A.polyN(layer, wmat, [[x0, yw, z0], [x0, yw, z1], [x0, yr, zr]], [-1, 0, 0]); A.polyN(layer, wmat, [[x1, yw, z0], [x1, yw, z1], [x1, yr, zr]], [1, 0, 0]);
    return { yr, a: [x0 - ov, zr], b: [x1 + ov, zr] };
  }
  const xr = (x0 + x1) / 2, yr = yw + (x1 - x0) / 2 * t;
  for (const [xe, sg] of [[x0 - ov, -1], [x1 + ov, 1]]) {
    const p = [[xe, ye, z0 - ov], [xe, ye, z1 + ov], [xr, yr, z1 + ov], [xr, yr, z0 - ov]];
    rface(layer, mat, p, [sg, 1, 0]); rface(layer, 'envSoffit', p, [-sg, -1, 0]);
  }
  A.polyN(layer, wmat, [[x0, yw, z0], [x1, yw, z0], [xr, yr, z0]], [0, 0, -1]); A.polyN(layer, wmat, [[x0, yw, z1], [x1, yw, z1], [xr, yr, z1]], [0, 0, 1]);
  return { yr, a: [xr, z0 - ov], b: [xr, z1 + ov] };
}
// faîtage en tuiles (prisme le long de la ligne de faîtage)
function ridge(mat, r, w = 0.2) { C.sbox('site', mat, r.a, r.b, -w / 2, w / 2, r.yr - 0.06, r.yr - 0.06, 0.13); }

// repère local d'un volume rectangulaire : face S (+X), N (−X), W (+Z), E (−Z) ; a le long de la face, d en saillie vers l'extérieur
function faces(x0, x1, z0, z1, layer = 'site') {
  const F = { S: { ax: 'x', w: x1, s: 1 }, N: { ax: 'x', w: x0, s: -1 }, W: { ax: 'z', w: z1, s: 1 }, E: { ax: 'z', w: z0, s: -1 } };
  const P = (f, a, y, d) => { const q = F[f], w = q.w + q.s * d; return q.ax === 'x' ? [w, y, a] : [a, y, w]; };
  const fb = (f, a0, a1, y0, y1, d0, d1, m) => { const q = F[f], w0 = q.w + q.s * d0, w1 = q.w + q.s * d1; if (q.ax === 'x') C.A.box(layer, w0, w1, y0, y1, a0, a1, m); else C.A.box(layer, a0, a1, y0, y1, w0, w1, m); };
  const nr = f => F[f].ax === 'x' ? [F[f].s, 0, 0] : [0, 0, F[f].s];
  const av = f => F[f].ax === 'x' ? [0, 0, 1] : [1, 0, 0];
  const ring = (f, m, ac, yc, d, r0, r1, n = 18) => { for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, b = (i + 1) / n * 2 * Math.PI; C.A.quadN(layer, m, [P(f, ac + r0 * Math.cos(a), yc + r0 * Math.sin(a), d), P(f, ac + r1 * Math.cos(a), yc + r1 * Math.sin(a), d), P(f, ac + r1 * Math.cos(b), yc + r1 * Math.sin(b), d), P(f, ac + r0 * Math.cos(b), yc + r0 * Math.sin(b), d)], nr(f)); } };
  const disc = (f, m, ac, yc, d, r, n = 18, a0 = 0, a1 = 2 * Math.PI) => { const pts = []; const full = a1 - a0 > 6.2; for (let i = 0; i < (full ? n : n + 1); i++) { const a = a0 + (a1 - a0) * i / n; pts.push(P(f, ac + r * Math.cos(a), yc + r * Math.sin(a), d)); } C.A.polyN(layer, m, pts, nr(f)); };
  return { F, P, fb, nr, av, ring, disc };
}
const groundMinMax = (x0, x1, z0, z1) => { const h = [[x0, z0], [x0, z1], [x1, z0], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]].map(p => C.hAt(p[0], p[1])); return [Math.min(...h), Math.max(...h)]; };

// ---------------------------------------------------------------- textures et matériaux
function buildMaterials() {
  const { makeTex, pixelNoise, rng, std, M, TEX } = C;
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
  // béton banché vieilli du mur de soutènement : coulures sous l'arase, taches de mousse, joint de reprise, trous de banche
  const wallC = makeTex(512, 2.4, (g, s) => {
    pixelNoise(g, s, '#a9a79f', 0.05, 0.10, 5, 301); const r = rng(302);
    for (let i = 0; i < 90; i++) { const x = r() * s, w = 2 + r() * 12, y0 = r() * s * 0.5, l = s * (0.2 + r() * 0.6); const grd = g.createLinearGradient(0, y0, 0, y0 + l); const k = 0.06 + r() * 0.10; grd.addColorStop(0, `rgba(58,60,52,${k})`); grd.addColorStop(1, 'rgba(58,60,52,0)'); g.fillStyle = grd; g.fillRect(x, y0, w, l); }
    for (let i = 0; i < 45; i++) { g.fillStyle = `rgba(${70 + r() * 30},${82 + r() * 30},50,${0.08 + r() * 0.1})`; g.beginPath(); g.ellipse(r() * s, s * (0.55 + r() * 0.45), 4 + r() * 22, 3 + r() * 10, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(55,55,50,0.35)'; g.fillRect(s * 0.5, 0, 2, s); g.fillRect(0, s * 0.42, s, 1);
    for (const yy of [0.2, 0.7]) for (const xx of [0.12, 0.62]) { g.fillStyle = 'rgba(45,45,40,0.55)'; g.beginPath(); g.arc(xx * s, yy * s, 3.5, 0, 7); g.fill(); }
  });
  // tuiles (plates ou mécaniques) : rangs ombrés, teinte variable
  const tiles = (base, rows, cols, seed, moss) => makeTex(512, 1.0, (g, s) => {
    const r = rng(seed), [R, G, B] = rgbOf(base); g.fillStyle = rgb(R * 0.4, G * 0.4, B * 0.4); g.fillRect(0, 0, s, s);
    const th = s / rows, tw = s / cols;
    for (let j = 0; j < rows; j++) { const off = (j % 2) * tw / 2; for (let i = -1; i <= cols; i++) {
      const x = i * tw + off, y = j * th, f = 0.78 + r() * 0.34, m = r() < moss ? 0.25 : 0;
      const c = k => rgb((R * (1 - m) + 95 * m) * f * k, (G * (1 - m) + 100 * m) * f * k, (B * (1 - m) + 70 * m) * f * k);
      const grd = g.createLinearGradient(0, y, 0, y + th); grd.addColorStop(0, c(0.72)); grd.addColorStop(0.25, c(0.95)); grd.addColorStop(0.9, c(1.05)); grd.addColorStop(1, c(0.55));
      g.fillStyle = grd; g.fillRect(x + 1.5, y + 1, tw - 3, th - 2);
    } }
    const img = g.getImageData(0, 0, s, s), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  });
  // ardoises du brisis et du terrasson (10 rangs par 1,20 m)
  const slate = makeTex(512, 1.2, (g, s) => {
    const r = rng(311); g.fillStyle = '#202328'; g.fillRect(0, 0, s, s); const rows = 10, cols = 6, th = s / rows, tw = s / cols;
    for (let j = 0; j < rows; j++) { const off = (j % 2) * tw / 2; for (let i = -1; i <= cols; i++) {
      const l = 0.85 + r() * 0.3, x = i * tw + off, y = j * th; const grd = g.createLinearGradient(0, y, 0, y + th);
      grd.addColorStop(0, rgb(48 * l, 50 * l, 53 * l)); grd.addColorStop(0.85, rgb(64 * l, 66 * l, 70 * l)); grd.addColorStop(1, rgb(34 * l, 35 * l, 38 * l));
      g.fillStyle = grd; g.fillRect(x + 1, y + 0.5, tw - 2, th - 1.5);
    } }
  });
  const stone = makeTex(256, 1.0, (g, s) => pixelNoise(g, s, '#ddd3be', 0.05, 0.06, 5, 321, (f, r) => r() < 0.02 ? f * 0.94 : f));
  // persiennes blanches (lames de 5 cm)
  const louvre = makeTex(64, 0.2, (g, s) => { g.fillStyle = '#f3f2ee'; g.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) { const y = i * s / 4; g.fillStyle = 'rgba(105,105,100,0.6)'; g.fillRect(0, y, s, 3); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, y + 3, s, 2); } });
  // clôture en plaques de béton (plaques de 2,00 × 0,50 entre poteaux)
  const plate = makeTex(256, 2.0, (g, s) => {
    pixelNoise(g, s, '#a29f97', 0.06, 0.08, 5, 331); const r = rng(332);
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(55,55,50,0.5)'; g.fillRect(0, k * s / 4, s, 2); g.fillStyle = 'rgba(255,255,250,0.18)'; g.fillRect(0, k * s / 4 + 2, s, 2); }
    g.fillStyle = 'rgba(70,70,65,0.35)'; g.fillRect(0, 0, 13, s);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(60,62,55,${0.05 + r() * 0.08})`; g.fillRect(r() * s, r() * s, 3 + r() * 8, 10 + r() * 40); }
  });
  // balustres en pierre (silhouette avec transparence, 1 balustre tous les 20 cm, 62 cm de haut)
  const bal = makeTex(64, 0.2, (g, s, W, Hh) => {
    g.clearRect(0, 0, W, Hh);
    for (let y = 0; y < Hh; y++) {
      const t = y / Hh; let w;
      if (t < 0.07) w = 0.46; else if (t < 0.12) w = 0.22; else if (t < 0.86) w = 0.13 + 0.25 * Math.exp(-(((t - 0.63) / 0.17) ** 2)) + 0.05 * Math.exp(-(((t - 0.2) / 0.05) ** 2)); else if (t < 0.92) w = 0.22; else w = 0.46;
      const x0 = W / 2 - w * W, x1 = W / 2 + w * W; const grd = g.createLinearGradient(x0, 0, x1, 0);
      grd.addColorStop(0, '#9f998c'); grd.addColorStop(0.35, '#f4f0e6'); grd.addColorStop(0.6, '#ece6da'); grd.addColorStop(1, '#a8a294');
      g.fillStyle = grd; g.fillRect(x0, y, x1 - x0, 1);
    }
  }, { w: 64, h: 256, metersV: 0.62 });
  bal.wrapT = THREE.ClampToEdgeWrapping;
  M.envWallC = std({ map: wallC, roughness: 0.95 });
  M.envSlate = std({ map: slate, roughness: 0.68 });
  M.envTileB = std({ map: tiles('#6f4233', 3, 5, 341, 0.12), roughness: 0.85 });
  M.envTileB2 = std({ map: tiles('#7b4e37', 3, 5, 343, 0.06), roughness: 0.85 });
  M.envTileR = std({ map: tiles('#ad553a', 3, 5, 342, 0.03), roughness: 0.8 });
  M.envManor = std({ map: TEX.lisse, color: '#f2f1ec', roughness: 0.9 });
  M.envStone = std({ map: stone, color: '#f1ece2', roughness: 0.85 });
  M.envQuoin = std({ map: stone, color: '#e4d1aa', roughness: 0.9 });
  M.envBase = std({ map: TEX.lisse, color: '#e6e2d8', roughness: 0.95 });
  M.envShutter = std({ map: louvre, roughness: 0.6 });
  M.envGlass = std({ color: '#262c32', roughness: 0.12, metalness: 0.4 });
  M.envLantern = std({ color: '#efe6cc', roughness: 0.3, emissive: '#fff0c8', emissiveIntensity: 0.15 });
  M.envCream = std({ map: TEX.lisse, color: '#efe3c9', roughness: 0.95 });
  M.envPeach = std({ map: TEX.lisse, color: '#f0d4bd', roughness: 0.95 });
  M.envSoffit = std({ color: '#d9d3c6', roughness: 0.9 });
  M.envPlate = std({ map: plate, roughness: 0.95 });
  M.envPlateL = std({ map: plate, color: '#f1efe9', roughness: 0.95 });
  M.envGazebo = std({ color: '#2e3135', roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide });
  M.envBal = std({ map: bal, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  M.envWood = std({ color: '#5c3b2a', roughness: 0.7 });
  M.envZinc = std({ color: '#8f9498', roughness: 0.45, metalness: 0.5 });
  M.envTerrace = std({ map: TEX.concrete, color: '#e6dfd0', roughness: 0.85 });
  M.envPole = std({ color: '#1a1b1d', roughness: 0.4, metalness: 0.55 });
  M.envLampDiff = std({ color: '#f4f1e8', roughness: 0.3, emissive: '#fff2d2', emissiveIntensity: 0.25 });
  M.envDish = std({ color: '#dcdcd8', roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
  return bal;
}

// ---------------------------------------------------------------- arbres (couronnes fusionnées, peu de triangles)
const TREES = { crowns: [], trunks: [] };
function blob(x, y, z, rad, sx, sy, col, r) {
  const geo = new THREE.IcosahedronGeometry(rad, 1), pp = geo.attributes.position;
  for (let k = 0; k < pp.count; k++) { const f = 0.85 + r() * 0.3; pp.setXYZ(k, pp.getX(k) * f * sx, pp.getY(k) * f * sy, pp.getZ(k) * f * sx); }
  geo.translate(x, y, z); geo.computeVertexNormals();
  const cols = []; for (let k = 0; k < pp.count; k++) cols.push(col.r, col.g, col.b);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); TREES.crowns.push(geo);
}
function trunk(x, y, z, r0, r1, h) { const g = new THREE.CylinderGeometry(r0, r1, h, 7); g.translate(x, y + h / 2, z); TREES.trunks.push(g); }
// feuillu : fût, houppier de n boules ; o : rayon, hauteur de fût, teinte, saturation, clarté
function leafy(x, z, s, o = {}) {
  const y = C.hAt(x, z), r = C.rng(Math.floor(x * 131 + z * 17 + 911));
  const th = (o.trunk ?? 1.7) * s, R = (o.r ?? 1.9) * s, H = o.h ?? 0.9, n = o.n ?? 36;
  trunk(x, y - 0.2, z, 0.08 * s, 0.18 * s, th + R * 0.9);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * 2 * Math.PI, rr = Math.cbrt(r()) * R, sq = Math.sqrt(1 - u * u);
    const col = new THREE.Color().setHSL((o.hue ?? 0.25) + r() * 0.04, o.sat ?? 0.42, (o.light ?? 0.26) + r() * 0.09);
    blob(x + Math.cos(a) * sq * rr, y + th + R * H + u * rr * H, z + Math.sin(a) * sq * rr, (0.55 + r() * 0.4) * s * (o.blob ?? 1), 1, 1, col, r);
  }
}
// cèdre : étages de branches horizontales, bleu-vert sombre
function cedar(x, z, s) {
  const y = C.hAt(x, z), r = C.rng(Math.floor(x * 31 + z * 7 + 5));
  trunk(x, y - 0.2, z, 0.18 * s, 0.42 * s, 13 * s);
  for (let k = 0; k < 7; k++) {
    const yk = y + (2.6 + k * 1.6) * s, rk = (4.8 - k * 0.62) * s, m = 13 - k;
    for (let i = 0; i < m; i++) {
      const a = r() * 2 * Math.PI, rr = (0.25 + 0.75 * Math.sqrt(r())) * rk, col = new THREE.Color().setHSL(0.38 + r() * 0.05, 0.2, 0.11 + r() * 0.05);
      blob(x + Math.cos(a) * rr * 0.75, yk + (r() - 0.5) * 0.6 * s, z + Math.sin(a) * rr * 0.75, (1.0 + r() * 0.7) * s, 1.55, 0.5, col, r);
    }
  }
  for (let i = 0; i < 3; i++) blob(x + (r() - 0.5) * s, y + 13.6 * s + i * 0.5 * s, z + (r() - 0.5) * s, 0.8 * s, 1, 0.8, new THREE.Color().setHSL(0.37, 0.22, 0.15), r);
}
function flushTrees() {
  const { M, groups } = C;
  if (TREES.crowns.length) { const m = new THREE.Mesh(mergeGeometries(TREES.crowns), M.foliage); m.castShadow = m.receiveShadow = true; groups.site.add(m); }
  if (TREES.trunks.length) { const m = new THREE.Mesh(mergeGeometries(TREES.trunks), M.trunk); m.castShadow = true; groups.site.add(m); }
  TREES.crowns.length = TREES.trunks.length = 0;
}

// ---------------------------------------------------------------- limite est : mur de soutènement en béton, piliers, grillage vert
function eastBoundary() {
  const { A, hAt, L, BND } = C;
  const zf = 0, zb = -0.25, zp = -0.12; // nu côté jardin, nu côté voisin, axe du grillage
  const top = x => hAt(x, -0.6) + 0.08, bot = x => Math.min(hAt(x, 0.15), hAt(x, -0.6)) - 0.3;
  for (const [x0, x1, piers] of [[-11.62, 0, [-11.46, -5.75, -0.22]], [L, BND.C[0], [L + 0.24, 16.3, BND.C[0] - 0.17]]]) {
    const n = Math.ceil((x1 - x0) / 0.8), xs = Array.from({ length: n + 1 }, (_, i) => x0 + (x1 - x0) * i / n);
    for (let i = 0; i < n; i++) {
      const a = xs[i], b = xs[i + 1], ta = top(a), tb = top(b), ba = bot(a), bb = bot(b);
      A.quadN('fence', 'envWallC', [[a, ba, zf], [b, bb, zf], [b, tb, zf], [a, ta, zf]], [0, 0, 1]);
      A.quadN('fence', 'envWallC', [[a, ba, zb], [b, bb, zb], [b, tb, zb], [a, ta, zb]], [0, 0, -1]);
      A.quadN('fence', 'envWallC', [[a, ta, zb], [b, tb, zb], [b, tb, zf + 0.02], [a, ta, zf + 0.02]], [0, 1, 0]);
      A.quadN('fence', 'envWallC', [[a, ta - 0.06, zf + 0.02], [b, tb - 0.06, zf + 0.02], [b, tb, zf + 0.02], [a, ta, zf + 0.02]], [0, 0, 1]); // arase légèrement débordante
      // bande de gazon du voisin entre le mur et son terrain (le maillage du sol ne suit pas le ressaut)
      A.quadN('site', 'grass', [[a, hAt(a, -0.6) + 0.004, -0.62], [b, hAt(b, -0.6) + 0.004, -0.62], [b, tb - 0.075, zb], [a, ta - 0.075, zb]], [0, 1, 0]);
      // grillage simple torsion vert foncé 1,20 m
      A.quadN('fence', 'mesh', [[a, ta + 0.04, zp], [b, tb + 0.04, zp], [b, tb + 1.22, zp], [a, ta + 1.22, zp]], [0, 0, 1]);
    }
    for (const x of [x0, x1]) { const t = top(x), b0 = bot(x); A.quadN('fence', 'envWallC', [[x, b0, zb], [x, b0, zf + 0.02], [x, t, zf + 0.02], [x, t, zb]], [x === x0 ? -1 : 1, 0, 0]); }
    // poteaux fins tous les 2,5 m environ, fil de tension en tête
    const np = Math.ceil((x1 - x0) / 2.5);
    for (let i = 0; i <= np; i++) { const x = x0 + (x1 - x0) * i / np; if (piers.some(p => Math.abs(p - x) < 0.4)) continue; const t = top(x); A.box('fence', x - 0.02, x + 0.02, t, t + 1.25, zp - 0.02, zp + 0.02, 'meshPost'); }
    for (let i = 0; i < n; i++) C.sbox('fence', 'meshPost', [xs[i], zp], [xs[i + 1], zp], -0.006, 0.006, top(xs[i]) + 1.2, top(xs[i + 1]) + 1.2, 0.012);
    // piliers béton 30 × 30 à chapeau
    for (const x of piers) { const t = top(x), b0 = bot(x); A.box('fence', x - 0.16, x + 0.16, b0, t + 1.30, -0.28, 0.05, 'envWallC'); A.box('fence', x - 0.2, x + 0.2, t + 1.30, t + 1.36, -0.32, 0.09, 'envWallC'); A.box('fence', x - 0.12, x + 0.12, t + 1.36, t + 1.42, -0.24, 0.01, 'envWallC'); }
  }
}

// ---------------------------------------------------------------- voisin est : maison de maître à rez-de-chaussée surélevé, toit à la Mansart
function manor(balTex) {
  const { A, hAt } = C;
  const X0 = -24, X1 = -11.8, Z0 = -18.5, Z1 = -3.2; // emprise
  const [gmin, g0] = groundMinMax(X0, X1, Z0, Z1);
  const yF = g0 + 1.9, yC = yF + 3.25, yB = yC + 0.36, hB = 3.0, yT = yB + hB; // RDC surélevé, corniche, brisis, terrasson
  const { P, fb, nr, av, ring, disc } = faces(X0, X1, Z0, Z1);
  // soubassement, murs enduits blancs, bandeau, entablement et corniche moulurée
  A.box('site', X0 - 0.05, X1 + 0.05, gmin - 0.5, yF, Z0 - 0.05, Z1 + 0.05, 'envBase');
  A.box('site', X0 - 0.07, X1 + 0.07, yF - 0.06, yF + 0.16, Z0 - 0.07, Z1 + 0.07, 'envStone');
  A.box('site', X0, X1, yF, yC, Z0, Z1, 'envManor');
  A.box('site', X0 - 0.1, X1 + 0.1, yC, yC + 0.16, Z0 - 0.1, Z1 + 0.1, 'envStone');
  A.box('site', X0 - 0.3, X1 + 0.3, yC + 0.16, yB, Z0 - 0.3, Z1 + 0.3, 'envStone');
  // brisis à 72° (ardoise) puis terrasson à 20°, ourlet en zinc à la jonction
  const o = 0.25, ins = hB / Math.tan(72 * RAD);
  const xo0 = X0 - o, xo1 = X1 + o, zo0 = Z0 - o, zo1 = Z1 + o, xi0 = xo0 + ins, xi1 = xo1 - ins, zi0 = zo0 + ins, zi1 = zo1 - ins;
  rface('site', 'envSlate', [[xo1, yB, zo0], [xo1, yB, zo1], [xi1, yT, zi1], [xi1, yT, zi0]], [1, 0.3, 0]);
  rface('site', 'envSlate', [[xo0, yB, zo0], [xo0, yB, zo1], [xi0, yT, zi1], [xi0, yT, zi0]], [-1, 0.3, 0]);
  rface('site', 'envSlate', [[xo0, yB, zo1], [xo1, yB, zo1], [xi1, yT, zi1], [xi0, yT, zi1]], [0, 0.3, 1]);
  rface('site', 'envSlate', [[xo0, yB, zo0], [xo1, yB, zo0], [xi1, yT, zi0], [xi0, yT, zi0]], [0, 0.3, -1]);
  const tr = hip('site', 'envSlate', xi0, xi1, zi0, zi1, yT, 20);
  for (const [a, b, c, d] of [[xi0, xi1, zi0, zi0], [xi0, xi1, zi1, zi1], [xi0, xi0, zi0, zi1], [xi1, xi1, zi0, zi1]]) A.box('site', a - 0.05, b + 0.05, yT - 0.05, yT + 0.05, c - 0.05, d + 0.05, 'envZinc');
  C.sbox('site', 'envZinc', tr.a, tr.b, -0.07, 0.07, tr.yr - 0.03, tr.yr - 0.03, 0.08);
  // chaînes d'angle harpées en pierre beige
  const hq = 0.37, nq = Math.floor((yC - yF - 0.16) / hq);
  for (const [f1, a1, s1, f2, a2, s2] of [['S', Z1, -1, 'W', X1, -1], ['S', Z0, 1, 'E', X1, -1], ['N', Z1, -1, 'W', X0, 1], ['N', Z0, 1, 'E', X0, 1]]) {
    for (let k = 0; k < nq; k++) {
      const y0 = yF + 0.16 + k * hq + 0.012, y1 = y0 + hq - 0.024, l1 = k % 2 ? 0.58 : 0.34, l2 = k % 2 ? 0.34 : 0.58;
      fb(f1, Math.min(a1, a1 + s1 * l1), Math.max(a1, a1 + s1 * l1), y0, y1, -0.001, 0.035, 'envQuoin');
      fb(f2, Math.min(a2, a2 + s2 * l2), Math.max(a2, a2 + s2 * l2), y0, y1, -0.001, 0.035, 'envQuoin');
    }
  }
  // portes-fenêtres à persiennes blanches fermées, chambranle et corniche de baie
  const baie = (f, a) => {
    const w = 1.2, y0 = yF + 0.1, y1 = yF + 2.6;
    fb(f, a - w / 2 - 0.13, a + w / 2 + 0.13, y0 - 0.04, y1 + 0.13, -0.001, 0.022, 'envStone');
    fb(f, a - w / 2, a + w / 2, y0, y1, 0.022, 0.06, 'envShutter');
    for (const s of [a - w / 2, a - 0.022, a + w / 2 - 0.045]) fb(f, s, s + 0.045, y0, y1, 0.06, 0.07, 'white');
    for (const y of [y0, y0 + 1.22, y1 - 0.06]) fb(f, a - w / 2, a + w / 2, y, y + 0.06, 0.06, 0.07, 'white');
    fb(f, a - w / 2 - 0.22, a + w / 2 + 0.22, y1 + 0.13, y1 + 0.25, -0.001, 0.11, 'envStone');
  };
  // lanterne murale noire sur potence
  const lantern = (f, a, y) => {
    fb(f, a - 0.025, a + 0.025, y - 0.05, y + 0.03, 0, 0.27, 'blackMatte'); fb(f, a - 0.06, a + 0.06, y - 0.12, y + 0.1, 0, 0.03, 'blackMatte');
    fb(f, a - 0.12, a + 0.12, y - 0.06, y - 0.01, 0.15, 0.39, 'blackMatte'); fb(f, a - 0.09, a + 0.09, y - 0.34, y - 0.06, 0.18, 0.36, 'envLantern');
    fb(f, a - 0.1, a + 0.1, y - 0.39, y - 0.34, 0.17, 0.37, 'blackMatte'); fb(f, a - 0.05, a + 0.05, y - 0.01, y + 0.06, 0.22, 0.32, 'blackMatte');
  };
  const bayS = [-6.1, -10.85, -15.6], bayW = [-21.4, -14.4];
  for (const a of bayS) { baie('S', a); baie('N', a); }
  for (const a of bayW) { baie('W', a); baie('E', a); }
  for (const a of [-8.45, -13.25]) { lantern('S', a, yF + 2.45); }
  for (const a of [-19.55, -16.25]) { lantern('W', a, yF + 2.45); }
  // oculus du RDC (façade ouest), entouré de pierre, clé
  { const ac = -17.9, yc = yF + 1.55; disc('W', 'envGlass', ac, yc, 0.012, 0.36); ring('W', 'envQuoin', ac, yc, 0.04, 0.33, 0.5); fb('W', ac - 0.09, ac + 0.09, yc + 0.42, yc + 0.64, -0.001, 0.06, 'envQuoin'); fb('W', ac - 0.02, ac + 0.02, yc - 0.33, yc + 0.33, 0.012, 0.03, 'white'); fb('W', ac - 0.33, ac + 0.33, yc - 0.02, yc + 0.02, 0.012, 0.03, 'white'); }
  // lucarnes à fronton triangulaire dans le brisis (3 au sud, 3 au nord), fenêtres cintrées
  const up = [0, 1, 0];
  const lucarne = (f, ac) => {
    const w = 0.68, d1 = 0.16, y0 = yB, yS = yB + 0.6, yW = yB + 1.45, yE = yB + 1.95, yR = yE + 0.5, hw = 0.84;
    fb(f, ac - w, ac + w, y0, yE, -1.3, d1, 'envStone');
    fb(f, ac - w - 0.06, ac + w + 0.06, yE - 0.1, yE, -1.3, d1 + 0.05, 'envStone'); // entablement
    fb(f, ac - w - 0.04, ac + w + 0.04, yS - 0.08, yS, -0.2, d1 + 0.06, 'envStone'); // appui
    fb(f, ac - 0.42, ac + 0.42, yS, yW, d1, d1 + 0.012, 'envGlass'); disc(f, 'envGlass', ac, yW, d1 + 0.012, 0.42, 12, 0, Math.PI);
    fb(f, ac - 0.025, ac + 0.025, yS, yW + 0.42, d1 + 0.012, d1 + 0.035, 'white'); fb(f, ac - 0.42, ac + 0.42, yW - 0.025, yW + 0.02, d1 + 0.012, d1 + 0.035, 'white');
    for (const s of [-1, 1]) fb(f, ac + s * 0.42 - (s > 0 ? 0 : 0.05), ac + s * 0.42 + (s > 0 ? 0.05 : 0), yS, yW, d1, d1 + 0.04, 'envStone');
    A.polyN('site', 'envStone', [P(f, ac - hw, yE, d1 + 0.05), P(f, ac + hw, yE, d1 + 0.05), P(f, ac, yR, d1 + 0.05)], nr(f)); // fronton
    const sa = av(f);
    for (const s of [-1, 1]) {
      rface('site', 'envSlate', [P(f, ac + s * (hw + 0.04), yE - 0.03, d1 + 0.09), P(f, ac, yR + 0.04, d1 + 0.09), P(f, ac, yR + 0.04, -1.6), P(f, ac + s * (hw + 0.04), yE - 0.03, -1.6)], [up[0] + s * sa[0], 1, up[2] + s * sa[2]]);
    }
  };
  for (const a of bayS) { lucarne('S', a); lucarne('N', a); }
  // œil-de-bœuf dans le brisis ouest (et est) : encadrement de pierre, chapeau d'ardoise
  const oeil = (f, ac) => {
    const yc = yB + 1.35, d1 = 0.12;
    fb(f, ac - 0.55, ac + 0.55, yB + 0.62, yB + 2.0, -1.3, d1, 'envStone');
    ring(f, 'envStone', ac, yc, d1 + 0.04, 0.32, 0.52); disc(f, 'envGlass', ac, yc, d1 + 0.01, 0.34);
    fb(f, ac - 0.02, ac + 0.02, yc - 0.32, yc + 0.32, d1 + 0.01, d1 + 0.03, 'white'); fb(f, ac - 0.32, ac + 0.32, yc - 0.02, yc + 0.02, d1 + 0.01, d1 + 0.03, 'white');
    fb(f, ac - 0.11, ac + 0.11, yc + 0.46, yc + 0.66, d1, d1 + 0.07, 'envStone');
    const sa = av(f);
    for (const s of [-1, 1]) rface('site', 'envSlate', [P(f, ac + s * 0.62, yB + 1.98, d1 + 0.08), P(f, ac, yB + 2.3, d1 + 0.08), P(f, ac, yB + 2.3, -1.5), P(f, ac + s * 0.62, yB + 1.98, -1.5)], [s * sa[0], 1, s * sa[2]]);
    A.polyN('site', 'envStone', [P(f, ac - 0.6, yB + 2.0, d1 + 0.06), P(f, ac + 0.6, yB + 2.0, d1 + 0.06), P(f, ac, yB + 2.28, d1 + 0.06)], nr(f));
  };
  oeil('W', -17.9); oeil('E', -17.9);
  // souches de cheminée enduites, couronnement, mitrons
  for (const [cx, cz] of [[-14.2, -6.0], [-21.8, -6.0], [-18.0, -15.9]]) {
    const yb = yT - 0.4, yt = tr.yr + 1.1;
    A.box('site', cx - 0.38, cx + 0.38, yb, yt, cz - 0.5, cz + 0.5, 'envManor'); A.box('site', cx - 0.46, cx + 0.46, yt, yt + 0.14, cz - 0.58, cz + 0.58, 'envStone');
    for (const dz of [-0.22, 0.22]) A.box('site', cx - 0.1, cx + 0.1, yt + 0.14, yt + 0.42, cz + dz - 0.1, cz + dz + 0.1, 'envQuoin');
  }
  // antenne râteau
  A.box('site', -14.22, -14.18, tr.yr + 1.2, tr.yr + 3.0, -6.02, -5.98, 'grille'); for (const k of [0, 1, 2]) A.box('site', -14.22, -14.18, tr.yr + 2.3 + k * 0.25, tr.yr + 2.32 + k * 0.25, -6.5, -5.5, 'grille');

  // terrasse surélevée en L (au sud et le long de la façade ouest) : massif enduit, dalle de pierre, porte de garage dessous
  const TX1 = -6.2, tz1 = -1.6;
  A.box('site', X1, TX1, gmin - 0.4, yF - 0.12, Z0, tz1, 'envBase');
  A.box('site', X0, X1, gmin - 0.4, yF - 0.12, Z1, tz1, 'envBase');
  A.box('site', X1 - 0.001, TX1 + 0.04, yF - 0.12, yF, Z0 - 0.04, tz1 + 0.04, { py: 'envTerrace', def: 'envStone' });
  A.box('site', X0 - 0.04, X1, yF - 0.12, yF, Z1, tz1 + 0.04, { py: 'envTerrace', def: 'envStone' });
  { const gd = hAt(-9.9, tz1 + 0.3); A.box('site', -11.1, -8.7, gd - 0.05, gd + 2.15, tz1 - 0.02, tz1 + 0.012, 'envWood');
    for (const x of [-10.5, -9.9, -9.3]) A.box('site', x - 0.008, x + 0.008, gd, gd + 2.1, tz1 + 0.012, tz1 + 0.016, 'blackMatte');
    A.box('site', -11.25, -8.55, gd + 2.15, gd + 2.3, tz1 - 0.001, tz1 + 0.03, 'envStone'); }
  // balustrade : socle, balustres, main courante, dés de pierre ; escalier droit vers le jardin
  const yb0 = yF + 0.14; balTex.offset.y = -yb0 / 0.62;
  const balRun = (ax, c, a0, a1) => {
    const bx = (p0, p1, y0, y1, hw, m) => ax === 'x' ? A.box('site', p0, p1, y0, y1, c - hw, c + hw, m) : A.box('site', c - hw, c + hw, y0, y1, p0, p1, m);
    bx(a0, a1, yF, yb0, 0.15, 'envStone'); bx(a0, a1, yb0 + 0.62, yF + 0.9, 0.17, 'envStone');
    if (ax === 'x') A.quadN('site', 'envBal', [[a0, yb0, c], [a1, yb0, c], [a1, yb0 + 0.62, c], [a0, yb0 + 0.62, c]], [0, 0, 1]);
    else A.quadN('site', 'envBal', [[c, yb0, a0], [c, yb0, a1], [c, yb0 + 0.62, a1], [c, yb0 + 0.62, a0]], [1, 0, 0]);
  };
  const de = (x, z) => { A.box('site', x - 0.2, x + 0.2, yF, yF + 0.98, z - 0.2, z + 0.2, 'envStone'); A.box('site', x - 0.24, x + 0.24, yF + 0.98, yF + 1.05, z - 0.24, z + 0.24, 'envStone'); };
  const cw = tz1 - 0.2, cs = TX1 - 0.2, sg0 = -11.45, sg1 = -14.55; // axes des balustrades, trémie de l'escalier
  const dW = [X0 + 0.2, -21.1, -18.0, -14.9, X1, -9.0, cs];
  for (let i = 0; i < dW.length - 1; i++) balRun('x', cw, dW[i], dW[i + 1]);
  const dS = [cw, -5.0, -8.2, sg0, sg1, Z0 + 0.2];
  for (let i = 0; i < dS.length - 1; i++) if (dS[i] !== sg0) balRun('z', cs, Math.min(dS[i], dS[i + 1]), Math.max(dS[i], dS[i + 1]));
  for (const x of dW) de(x, cw); for (const z of dS.slice(1)) de(cs, z);
  { const gs = hAt(-3.6, -13), n = Math.max(3, Math.round((yF - gs) / 0.17)), rise = (yF - gs) / n, run = 0.32, z0 = sg1 - 0.14, z1 = sg0 + 0.14;
    for (let k = 1; k < n; k++) A.box('site', TX1 + (k - 1) * run, TX1 + k * run, gs - 0.3, yF - k * rise, z0, z1, { py: 'envTerrace', px: 'envStone', def: 'envBase' });
    const xe = TX1 + (n - 1) * run;
    for (const zc of [sg0, sg1]) { C.sbox('site', 'envBase', [TX1 + 0.2, zc], [xe, zc], -0.14, 0.14, yF - 0.3, gs - 0.3, 0.92); C.sbox('site', 'envStone', [TX1 + 0.2, zc], [xe, zc], -0.17, 0.17, yF + 0.62, gs + 0.62, 0.08); A.box('site', xe - 0.05, xe + 0.35, gs - 0.3, gs + 0.95, zc - 0.2, zc + 0.2, 'envStone'); } }
  // salon de jardin blanc sur la terrasse
  { const tx = -8.6, tz = -9.6; A.box('site', tx - 0.45, tx + 0.45, yF + 0.70, yF + 0.74, tz - 0.45, tz + 0.45, 'white'); A.box('site', tx - 0.04, tx + 0.04, yF, yF + 0.70, tz - 0.04, tz + 0.04, 'white');
    for (const dz of [-0.85, 0.85]) { const z = tz + dz; A.box('site', tx - 0.22, tx + 0.22, yF + 0.42, yF + 0.46, z - 0.22, z + 0.22, 'white'); A.box('site', tx - 0.22, tx + 0.22, yF + 0.46, yF + 0.92, z + Math.sign(dz) * 0.2, z + Math.sign(dz) * 0.24, 'white'); for (const [ex, ez] of [[-0.19, -0.19], [0.17, -0.19], [-0.19, 0.17], [0.17, 0.17]]) A.box('site', tx + ex, tx + ex + 0.03, yF, yF + 0.42, z + ez, z + ez + 0.03, 'white'); } }
  return { yF, g0 };
}

// ---------------------------------------------------------------- maisons simples (volumes enduits, fenêtres, toiture tuiles)
function house(o) {
  const { A } = C; const { x0, x1, z0, z1 } = o;
  const [gmin, gmax] = groundMinMax(x0, x1, z0, z1), g = gmax + (o.raise ?? 0.15), yw = g + o.h;
  A.box('site', x0, x1, gmin - 0.4, yw, z0, z1, o.wall);
  A.box('site', x0 - 0.03, x1 + 0.03, gmin - 0.4, g + 0.02, z0 - 0.03, z1 + 0.03, 'envBase');
  const ov = o.ov ?? 0.4, t = Math.tan(o.pitch * RAD);
  const r = o.roof === 'hip' ? hip('site', o.roofMat, x0 - ov, x1 + ov, z0 - ov, z1 + ov, yw - ov * t, o.pitch, 'envSoffit') : gable('site', o.roofMat, o.wall, x0, x1, z0, z1, yw, o.pitch, o.roof === 'gx', ov);
  ridge(o.roofMat, r);
  const { fb } = faces(x0, x1, z0, z1);
  const lv = o.h > 4.4 ? [0.95, 3.75] : [0.95];
  for (const f of ['S', 'N', 'W', 'E']) {
    const along = f === 'S' || f === 'N' ? [z0, z1] : [x0, x1], len = along[1] - along[0], n = Math.max(1, Math.floor((len - 0.8) / 2.7));
    for (let i = 0; i < n; i++) {
      const a = along[0] + (i + 0.5) * len / n;
      lv.forEach((ly, j) => {
        const door = o.door === f && i === Math.floor(n / 2) && j === 0, w = door ? 0.95 : (o.h > 4.4 ? 1.15 : 1.0), y0 = g + (door ? 0 : ly), y1 = g + (door ? 2.15 : ly + 1.25);
        fb(f, a - w / 2 - 0.07, a + w / 2 + 0.07, y0 - (door ? 0 : 0.07), y1 + 0.07, -0.001, 0.025, 'appui');
        fb(f, a - w / 2, a + w / 2, y0, y1, 0.025, 0.04, door ? 'envWood' : 'envGlass');
        if (!door && o.shutters) for (const s of [-1, 1]) fb(f, a + s * (w / 2 + 0.1) - (s > 0 ? 0 : w / 2), a + s * (w / 2 + 0.1) + (s > 0 ? w / 2 : 0), y0, y1, 0.02, 0.05, o.shutters);
      });
    }
  }
  if (o.chim) { const [cx, cz] = o.chim; A.box('site', cx - 0.3, cx + 0.3, yw, r.yr + 0.9, cz - 0.4, cz + 0.4, o.chimMat || o.wall); A.box('site', cx - 0.36, cx + 0.36, r.yr + 0.9, r.yr + 1.0, cz - 0.46, cz + 0.46, 'coping'); }
  return { g, yw, r };
}

// ---------------------------------------------------------------- voisin nord : maison R+C, toit 4 pans en tuiles brunes, lucarne, Velux, cheminée, parabole
function northHouse() {
  const { A } = C;
  const x0 = -25.4, x1 = -17.8, z0 = 0.3, z1 = 10.3, p = 45, t = 1, ov = 0.4;
  const [gmin, gmax] = groundMinMax(x0, x1, z0, z1), g = gmax + 0.25, yE = g + 3.3;
  A.box('site', x0, x1, gmin - 0.4, yE, z0, z1, 'envCream');
  A.box('site', x0 - 0.03, x1 + 0.03, gmin - 0.4, g + 0.03, z0 - 0.03, z1 + 0.03, 'envBase');
  const r = hip('site', 'envTileB', x0 - ov, x1 + ov, z0 - ov, z1 + ov, yE - ov * t, p, 'envSoffit'); ridge('envTileB', r);
  const yS = x => yE - ov * t + (x1 + ov - x) * t; // pan sud
  const { fb } = faces(x0, x1, z0, z1);
  // baies du RDC (sud et ouest), volets roulants
  for (const [f, as] of [['S', [1.9, 5.0, 8.3]], ['W', [-23.6, -19.8]], ['N', [3.0, 7.5]], ['E', [-21.6]]]) for (const a of as) {
    const w = f === 'S' && a === 5.0 ? 1.8 : 1.1, y0 = g + (w > 1.5 ? 0.05 : 0.9), y1 = g + 2.15;
    fb(f, a - w / 2 - 0.07, a + w / 2 + 0.07, y0 - 0.05, y1 + 0.07, -0.001, 0.025, 'appui'); fb(f, a - w / 2, a + w / 2, y0, y1, 0.025, 0.04, 'envGlass'); fb(f, a - w / 2, a + w / 2, y1 - 0.25, y1, 0.04, 0.05, 'slats');
  }
  // lucarne à deux pans sur le pan sud (côté est), fenêtre
  { const zc = 2.1, xf = -18.55, yb = yS(xf) - 0.25, ye = yE + 1.85, yr = ye + 0.68;
    A.box('site', xf - 2.2, xf, yb, ye, zc - 0.65, zc + 0.65, 'envCream');
    A.polyN('site', 'envCream', [[xf, ye, zc - 0.65], [xf, ye, zc + 0.65], [xf, yr - 0.04, zc]], [1, 0, 0]);
    for (const s of [-1, 1]) { const p4 = [[xf + 0.12, ye - 0.08, zc + s * 0.8], [xf - 2.6, ye - 0.08, zc + s * 0.8], [xf - 2.6, yr, zc], [xf + 0.12, yr, zc]]; rface('site', 'envTileB', p4, [0, 1, s]); rface('site', 'envSoffit', p4, [0, -1, -s]); }
    A.box('site', xf, xf + 0.03, yb + 0.35, ye - 0.15, zc - 0.47, zc + 0.47, 'appui'); A.box('site', xf + 0.03, xf + 0.045, yb + 0.42, ye - 0.22, zc - 0.4, zc + 0.4, 'envGlass'); }
  // Velux sur le pan sud (côté ouest)
  { const xa = -19.25, xb = -20.0, za = 6.4, zb = 7.2;
    rface('site', 'grille', [[xa + 0.05, yS(xa + 0.05) + 0.03, za - 0.05], [xa + 0.05, yS(xa + 0.05) + 0.03, zb + 0.05], [xb - 0.05, yS(xb - 0.05) + 0.03, zb + 0.05], [xb - 0.05, yS(xb - 0.05) + 0.03, za - 0.05]], [1, 1, 0]);
    rface('site', 'envGlass', [[xa, yS(xa) + 0.06, za], [xa, yS(xa) + 0.06, zb], [xb, yS(xb) + 0.06, zb], [xb, yS(xb) + 0.06, za]], [1, 1, 0]); }
  // souche de cheminée près de l'extrémité est du faîtage, antenne râteau et parabole
  { const cx = -21.0, cz = 3.0, yt = r.yr + 0.85;
    A.box('site', cx - 0.28, cx + 0.28, yE + 1.5, yt, cz - 0.4, cz + 0.4, 'envCream'); A.box('site', cx - 0.33, cx + 0.33, yt, yt + 0.08, cz - 0.45, cz + 0.45, 'coping');
    A.box('site', cx - 0.02, cx + 0.02, yt + 0.08, yt + 2.4, cz - 0.02, cz + 0.02, 'grille'); for (const k of [0, 1, 2, 3]) A.box('site', cx - 0.015, cx + 0.015, yt + 1.6 + k * 0.2, yt + 1.62 + k * 0.2, cz - 0.4 + k * 0.05, cz + 0.4 - k * 0.05, 'grille');
    const c = new THREE.Vector3(cx + 0.55, yt - 0.55, cz + 0.15), n = new THREE.Vector3(0.85, 0.32, 0.4).normalize(), u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(u, n);
    const pts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * 2 * Math.PI; const q = c.clone().addScaledVector(u, Math.cos(a) * 0.32).addScaledVector(v, Math.sin(a) * 0.32); pts.push([q.x, q.y, q.z]); }
    A.polyN('site', 'envDish', pts, [n.x, n.y, n.z]); A.polyN('site', 'envDish', pts, [-n.x, -n.y, -n.z]);
    A.box('site', cx + 0.27, cx + 0.5, yt - 0.6, yt - 0.56, cz + 0.1, cz + 0.16, 'grille'); }
}

// ---------------------------------------------------------------- murs, portails et haies
function wallLine(layer, mat, cap, pts, t0, t1, h) { // mur enduit suivant le terrain le long d'une polyligne, chaperon
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const g0 = C.hAt(p0[0], p0[1]), g1 = C.hAt(p1[0], p1[1]);
    C.sbox(layer, mat, p0, p1, t0, t1, g0 - 0.3, g1 - 0.3, h + 0.3);
    if (cap) C.sbox(layer, cap, p0, p1, t0 - 0.03, t1 + 0.03, g0 + h, g1 + h, 0.05);
  }
}
const seg = (p0, p1, step) => { const n = Math.max(1, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / step)); return Array.from({ length: n + 1 }, (_, i) => C.lerp2(p0, p1, i / n)); };
function pier(x, z, h, mat, cap, s = 0.2) { const g = C.hAt(x, z); C.A.box('site', x - s, x + s, g - 0.3, g + h, z - s, z + s, mat); C.A.box('site', x - s - 0.04, x + s + 0.04, g + h, g + h + 0.06, z - s - 0.04, z + s + 0.04, cap); }
function hedgeRow(pts, w, h, seed) { // haie taillée par tronçons de 2 m, hauteur légèrement variable
  const r = C.rng(seed);
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i], p1 = pts[i + 1], g0 = C.hAt(p0[0], p0[1]), g1 = C.hAt(p1[0], p1[1]), hh = h * (0.93 + r() * 0.14), dw = (r() - 0.5) * 0.15; C.sbox('site', 'hedge', p0, p1, -w / 2 - dw, w / 2 + dw, g0 - 0.15, g1 - 0.15, hh + 0.15); }
}
function streetFronts() {
  const { zWest, A, hAt } = C;
  // en face, rue des Merlettes (côté ouest) : mur enduit crème de 1,80 m, portillon et portail gris, végétation derrière
  const zW = (x, o) => [x, zWest(x) + 6.4 + o];
  const gates = [[10.42, 11.58], [12.92, 16.58]]; // portillon, portail ; piliers de 44 cm de part et d'autre
  for (const [a, b] of [[5, 9.98], [12.02, 12.48], [17.02, 19.2]]) wallLine('site', 'envCream', 'coping', seg(zW(a, 0.2), zW(b, 0.2), 1.6), -0.1, 0.1, 1.8);
  for (const [a, b] of gates) {
    for (const x of [a - 0.22, b + 0.22]) pier(x, zWest(x) + 6.6, 1.95, 'envCream', 'coping', 0.22);
    const g = Math.max(hAt(a, zWest(a) + 6.6), hAt(b, zWest(b) + 6.6));
    C.sbox('site', 'fenceAlu', zW(a + 0.02, 0.2), zW(b - 0.02, 0.2), -0.03, 0.03, g + 0.05, g + 0.05, 1.7);
    for (let k = 1; k < 9; k++) C.sbox('site', 'black', zW(a + 0.04, 0.2), zW(b - 0.04, 0.2), -0.035, 0.035, g + 0.05 + k * 0.19, g + 0.05 + k * 0.19, 0.008);
  }
  hedgeRow(seg(zW(5.2, 1.3), zW(10.0, 1.3), 2), 1.1, 2.6, 71); hedgeRow(seg(zW(17.0, 1.3), zW(19.4, 1.3), 2), 1.1, 2.4, 72);
  // en face, rue des Fauvettes (côté sud) : mur crème de 1,40 m (prolongé en fond de la rue des Merlettes), portail de S1
  const xw = 27.05, gS = [15.22, 18.58];
  for (const [a, b] of [[12.5, 14.78], [19.02, 32]]) wallLine('site', 'envCream', 'coping', seg([xw, a], [xw, b], 1.6), -0.1, 0.1, 1.4);
  for (const z of [gS[0] - 0.22, gS[1] + 0.22]) pier(xw, z, 1.6, 'envCream', 'coping', 0.22);
  { const g = Math.max(hAt(xw, gS[0]), hAt(xw, gS[1])); A.box('site', xw - 0.03, xw + 0.03, g + 0.05, g + 1.5, gS[0] + 0.02, gS[1] - 0.02, 'fenceAlu'); }
  hedgeRow(seg([xw + 0.9, 23.5], [xw + 0.9, 32], 2), 1.0, 2.2, 73);
  // voisin nord, sur rue : muret enduit, grillage et haie
  const pn = seg([-26.5, zWest(-26.5)], [-11.7, zWest(-11.7)], 2.2);
  wallLine('site', 'envCream', 'coping', pn, 0, 0.2, 0.6);
  for (let i = 0; i < pn.length - 1; i++) { const a = pn[i], b = pn[i + 1], ga = hAt(a[0], a[1]), gb = hAt(b[0], b[1]); A.quadN('site', 'mesh', [[a[0], ga + 0.66, a[1] - 0.1], [b[0], gb + 0.66, b[1] - 0.1], [b[0], gb + 1.75, b[1] - 0.1], [a[0], ga + 1.75, a[1] - 0.1]], [0, 0, 1]); A.box('site', a[0] - 0.02, a[0] + 0.02, ga + 0.6, ga + 1.78, a[1] - 0.12, a[1] - 0.08, 'meshPost'); }
  hedgeRow(pn.map(p => [p[0], p[1] - 0.75]), 0.9, 2.0, 74);
  // haie haute du voisin nord derrière le muret de limite, et entre lui et la maison de maître
  hedgeRow(seg([-12.15, 0.1], [-12.15, 12.2], 2), 0.85, 2.35, 75);
  hedgeRow(seg([-17.4, 0.55], [-12.6, 0.55], 2), 0.8, 2.2, 76);
}

// ---------------------------------------------------------------- jardin du voisin est : annexe, kiosque, clôtures en plaques de béton
function eastGarden() {
  const { A, hAt, sbox, xSouth } = C;
  house({ x0: -9.5, x1: -4, z0: -27, z1: -19.5, h: 2.7, pitch: 30, roof: 'hip', wall: 'envCream', roofMat: 'envTileB2', ov: 0.35, door: 'W' });
  // kiosque à toit pyramidal sombre (lanternon), 3 × 3 m
  { const cx = 2, cz = -13, g = hAt(cx, cz), hp = 2.35, hw = 1.5;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.box('site', cx + dx * hw - 0.05, cx + dx * hw + 0.05, g, g + hp, cz + dz * hw - 0.05, cz + dz * hw + 0.05, 'envGazebo');
    for (const [a, b, c, d] of [[-hw, hw, -hw, -hw], [-hw, hw, hw, hw], [-hw, -hw, -hw, hw], [hw, hw, -hw, hw]]) A.box('site', cx + a - 0.06, cx + b + 0.06, g + hp - 0.16, g + hp, cz + c - 0.06, cz + d + 0.06, 'envGazebo');
    const t = Math.tan(24 * RAD), R = hw + 0.3, Ri = 0.55, yr0 = g + hp + (R - Ri) * t;
    for (const [p, q] of [[[-R, -R], [R, -R]], [[R, -R], [R, R]], [[R, R], [-R, R]], [[-R, R], [-R, -R]]]) rface('site', 'envGazebo', [[cx + p[0], g + hp, cz + p[1]], [cx + q[0], g + hp, cz + q[1]], [cx + q[0] * Ri / R, yr0, cz + q[1] * Ri / R], [cx + p[0] * Ri / R, yr0, cz + p[1] * Ri / R]], [Math.sign(p[0] + q[0]), 1, Math.sign(p[1] + q[1])]);
    A.box('site', cx - Ri + 0.08, cx + Ri - 0.08, yr0, yr0 + 0.22, cz - Ri + 0.08, cz + Ri - 0.08, 'envGazebo');
    hip('site', 'envGazebo', cx - Ri - 0.1, cx + Ri + 0.1, cz - Ri - 0.1, cz + Ri + 0.1, yr0 + 0.22, 30); }
  // clôture en plaques de béton au fond du jardin (z −22) et en limite sur la rue des Fauvettes
  const plates = (p0, p1, h, mat) => {
    const pts = seg(p0, p1, 2.0);
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; sbox('site', mat, a, b, -0.03, 0.03, hAt(a[0], a[1]) - 0.1, hAt(b[0], b[1]) - 0.1, h + 0.1); }
    for (const q of pts) { const g = hAt(q[0], q[1]); A.box('site', q[0] - 0.07, q[0] + 0.07, g - 0.1, g + h + 0.05, q[1] - 0.07, q[1] + 0.07, mat); }
  };
  plates([-4, -22], [19.0, -22], 1.95, 'envPlate');
  const xs = z => xSouth(z) - 0.12;
  plates([xs(-0.4), -0.4], [xs(-14.6), -14.6], 1.6, 'envPlateL'); plates([xs(-17.8), -17.8], [xs(-22), -22], 1.6, 'envPlateL');
  for (const z of [-14.8, -17.6]) pier(xs(z), z, 1.75, 'envQuoin', 'envStone', 0.2);
  { const g = hAt(xs(-16.2), -16.2); A.box('site', xs(-16.2) - 0.03, xs(-16.2) + 0.03, g + 0.05, g + 1.55, -17.38, -15.02, 'fenceAlu'); }
}

// ---------------------------------------------------------------- lampadaires (fût noir fin, fourche en Y, tête en disque)
function streetLamps() {
  const { zWest, hAt, groups, M } = C;
  const dark = [], light = [];
  const cyl = (r0, r1, h, x, y, z, seg = 10) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y + h / 2, z); return g; };
  for (const x of [-9.8, 8.9]) {
    const z = zWest(x) + 0.25, y = hAt(x, z);
    dark.push(cyl(0.12, 0.14, 0.45, x, y - 0.1, z), cyl(0.045, 0.065, 4.3, x, y, z));
    for (const s of [-1, 1]) { // branches de la fourche, dans le plan perpendiculaire à la rue
      const a = new THREE.Vector3(x, y + 4.25, z), b = new THREE.Vector3(x, y + 4.98, z + s * 0.17), d = b.clone().sub(a);
      const g = new THREE.CylinderGeometry(0.017, 0.02, d.length(), 6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); dark.push(g);
    }
    dark.push(cyl(0.3, 0.3, 0.06, x, y + 4.98, z, 24), cyl(0.12, 0.27, 0.06, x, y + 5.04, z, 24));
    light.push(cyl(0.25, 0.25, 0.012, x, y + 4.97, z, 24));
  }
  const m1 = new THREE.Mesh(mergeGeometries(dark), M.envPole); m1.castShadow = true; groups.site.add(m1);
  const m2 = new THREE.Mesh(mergeGeometries(light), M.envLampDiff); groups.site.add(m2);
}

// ---------------------------------------------------------------- point d'entrée
export function buildEnvironment(ctx) {
  C = ctx;
  const balTex = buildMaterials();
  eastBoundary();
  manor(balTex);
  eastGarden();
  northHouse();
  // en face : W2 (crépi rosé, pignon au sud) et W1 rue des Merlettes, S1 rue des Fauvettes (tuiles rouge orangé)
  house({ x0: -15.5, x1: -6, z0: 23.5, z1: 33, h: 5.0, pitch: 42, roof: 'gx', wall: 'envPeach', roofMat: 'envTileB2', chim: [-6.55, 28.25], door: 'E', shutters: 'white' });
  house({ x0: 0, x1: 10.5, z0: 34.5, z1: 44, h: 5.2, pitch: 35, roof: 'hip', wall: 'envCream', roofMat: 'envTileB', door: 'E', chim: [3.2, 41] });
  house({ x0: 28.5, x1: 37, z0: 13, z1: 23, h: 5.6, pitch: 32, roof: 'hip', wall: 'envCream', roofMat: 'envTileR', chim: [33.6, 20.6], door: 'N', shutters: 'white' });
  streetFronts();
  streetLamps();
  // arbres : cèdre au nord-est de la maison de maître, cerisier, grands arbres derrière les clôtures, massifs sombres au sud-est
  cedar(-29.5, -9.5, 1.0);
  leafy(15.5, -3.5, 1.0, { r: 1.8, n: 24, hue: 0.22, sat: 0.4, light: 0.32, trunk: 1.8 });
  for (const [x, z, s] of [[-14.5, -25.5, 1.7], [-21, -24, 1.5], [-2.5, -26.5, 1.6], [6.5, -25.8, 1.9], [12.5, -27, 1.6]]) leafy(x, z, s, { hue: 0.24, sat: 0.38, light: 0.24 });
  for (const [x, z, s] of [[16.0, -19.0, 1.9], [28.5, -6.5, 1.9], [29.5, -17.5, 2.2], [35, -10, 1.8], [27.8, -27, 2.0]]) leafy(x, z, s, { hue: 0.29, sat: 0.3, light: 0.13, r: 2.1, n: 40 });
  leafy(-1.5, 46, 1.6, { hue: 0.25, sat: 0.35, light: 0.24 }); leafy(13.5, 40, 1.4, { hue: 0.24, sat: 0.36, light: 0.26 }); leafy(-18, 27, 1.5, { hue: 0.26, sat: 0.36, light: 0.22 }); leafy(39.5, 24, 1.7, { hue: 0.25, sat: 0.36, light: 0.22 });
  flushTrees();
  flushFaces();
}
