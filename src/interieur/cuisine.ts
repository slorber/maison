// Cuisine (demande du 20/10/2026 : croquis de Sébastien sur le plan v3, photos de sa cuisine actuelle), calque 'furn0', appelé par buildMobilier.
// Style des photos : meubles hauts laqués crème brillant sans poignée (gorge en bas) dans un caisson apparent en chêne grisé, façades basses
// en bois gris-brun à fil horizontal avec poignées barres inox, plan stratifié beige effet pierre. Retouches du 20/10 : bois des bas un peu plus
// clair, crédence en carreaux de ciment 20 × 20 à la place des grands carreaux gris clair.
// Implantation (x vers le sud depuis la façade nord, z vers l'ouest depuis la cloison de l'escalier ; pièce x 0,36 → 3,79, z 4,24 → 7,54) :
// - sous la fenêtre nord (meubles bas de 65) : angle Le Mans, coulissant de 26, meuble sous évier 60, lave-vaisselle intégré 60, joue, puis
//   réfrigérateur combiné en pose libre dans l'angle nord-ouest, à 2 cm du mur, charnières côté mur ; évier 1 grand bac + égouttoir à gauche
//   (au-dessus du lave-vaisselle), bac et mitigeur devant le semi-fixe : le premier vantail (côté escalier) s'ouvre sans les toucher ;
// - cloison de l'escalier (bas 65, hauts 37 de 1,45 à 2,15, surmeubles 60 jusqu'au plafond) : fileur, tiroirs 74, plaque 60 au milieu du plan
//   restant (sur un casserolier), tiroirs 79, colonne four contre le retour (tiroir, four, micro-ondes à hauteur d'enfant, porte, abattant) ;
//   groupe filtrant de 86 à extraction extérieure dans un meuble haut de 90 centré sur la plaque (conduit visible), rangements de part et d'autre ; angle : hauts et surmeubles
//   filants jusqu'au mur nord, bas en angle Le Mans sous la fenêtre (fileurs de 4 et 5 cm pour dégager les poignées) ;
// - épi 145 × 100 contre la façade ouest, passage de 1,20 devant la colonne : 2 × 3 grands tiroirs de 60 côté cuisine, placards de 40 côté séjour.
// Portes, tiroirs, abattants, four, micro-ondes, lave-vaisselle et portes du réfrigérateur s'ouvrent au clic (ctx.DOORS, kind 'cuisine') :
// chaque pièce mobile est un groupe hors fusion dont les maillages restent légers (obstacles dynamiques de la balade, nav.ts).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Ctx, Door, Vec3 } from '../types';

let C, M; const BK = new Map();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const cl = t => t < 0 ? 0 : t > 1 ? 1 : t, ez = t => { t = cl(t); return t * t * (3 - 2 * t); };
const HP = Math.PI / 2;
// hauteurs : plan de travail à 96 cm (demande du 20/10, « on est grands ») = plinthe 14,2 + caissons hauts de 78 + plan 3,8 ; façades 19 mm, jeux de 3 mm
const PL = 0.142, CT = 0.922, WT = 0.96, FT = 0.019, G = 0.0015;

// ---------------------------------------------------------------- outils géométriques (repris de mobilier.js)
function mtx(x, y, z, ry = 0, rx = 0, rz = 0) { return new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(1, 1, 1)); }
// UV en mètres par projection sur l'axe dominant de la normale (textures à l'échelle, fil du bois horizontal sur les façades)
function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = n.getX(i), ay = n.getY(i), az = n.getZ(i), X = Math.abs(ax), Y = Math.abs(ay), Z = Math.abs(az), x = p.getX(i), y = p.getY(i), z = p.getZ(i), j = i * 2;
    if (X >= Y && X >= Z) { uv[j] = ax > 0 ? -z : z; uv[j + 1] = y; } else if (Y >= Z) { uv[j] = x; uv[j + 1] = -z; } else { uv[j] = az > 0 ? x : -x; uv[j + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function prep(mat, geo, m4, o: any = {}) {
  const g = geo.clone();
  if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  if (m4) g.applyMatrix4(m4);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  g.clearGroups(); g.morphAttributes = {};
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!o.keepUV || !g.attributes.uv) worldUV(g);
  return g;
}
function put(layer, mat, geo, m4, o?) { const key = layer + '|' + mat; let b = BK.get(key); if (!b) BK.set(key, b = { layer, mat, list: [] }); b.list.push(prep(mat, geo, m4, o)); }
function flush() {
  for (const b of BK.values()) { const m = new THREE.Mesh(mergeGeometries(b.list, false), M[b.mat]); m.name = 'cuisine'; m.castShadow = !M[b.mat].transparent; m.receiveShadow = true; C.groups[b.layer].add(m); }
  BK.clear();
}
function sinkTo() { const map = new Map(), f: any = (mat, geo, m4, o) => { let l = map.get(mat); if (!l) map.set(mat, l = []); l.push(prep(mat, geo, m4, o)); }; f.map = map; return f; }
function meshesOf(sink, g, out) { for (const [mat, l] of sink.map) { const m = new THREE.Mesh(mergeGeometries(l, false), M[mat]); m.name = 'cuisine'; m.castShadow = !M[mat].transparent; m.receiveShadow = true; g.add(m); out.push(m); } }
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylZ = (r, len, seg = 16) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
function rodG(a, b, r, seg = 12, r2?) { // cylindre de a (rayon r) à b (rayon r2)
  const pa = V3(...(a as Vec3)), pb = V3(...(b as Vec3)), d = pb.clone().sub(pa), len = d.length();
  const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg, 1);
  return g.applyMatrix4(new THREE.Matrix4().compose(pa.add(pb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()), V3(1, 1, 1)));
}
function rrect(x0, z0, x1, z1, r, n = 6) { const p = []; for (const [cx, cz, q] of [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 1], [x0 + r, z0 + r, 2], [x1 - r, z0 + r, 3]]) for (let i = 0; i <= n; i++) { const a = (q + i / n) * HP; p.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } return p; }
// plateau horizontal extrudé (contour [x, z], trous), arêtes adoucies
function slab(pts, holes, y0, th, b = 0.002) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes || []) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: th - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-HP); g.translate(0, y0 + b, 0); return g;
}
class Kit {
  declare l: string; declare F: THREE.Matrix4; declare s: ((mat, geo, m4, o) => void) | undefined;
  constructor(layer, F?, sink?) { this.l = layer; this.F = F || new THREE.Matrix4(); this.s = sink; }
  m(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return this.F.clone().multiply(mtx(x, y, z, ry, rx, rz)); }
  p(mat, geo, m4, o?) { if (this.s) this.s(mat, geo, m4, o); else put(this.l, mat, geo, m4, o); return this; }
  g(mat, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, o?) { return this.p(mat, geo, this.m(x, y, z, ry, rx, rz), o); }
  box(mat, x0, x1, y0, y1, z0, z1, o?) { return this.g(mat, boxG(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, o); }
  rod(mat, a, b, r, seg = 12, r2?, o?) { return this.p(mat, rodG(a, b, r, seg, r2), this.F, o); }
}

// ---------------------------------------------------------------- repères des linéaires
// repère local d'une ligne de meubles : u le long de la ligne, y vertical, z sortant de la façade (z = 0 : nu des façades, caissons en z < 0) ;
// base directe (ex × ey = ez) : une rotation de la pièce mobile autour de y ou de u se lit de la même façon dans le monde
const frame = (ex: Vec3, ez: Vec3, o: Vec3) => new THREE.Matrix4().makeBasis(V3(...ex), V3(0, 1, 0), V3(...ez)).setPosition(...o);
const FN = frame([0, 0, -1], [1, 0, 0], [1.01, 0, 0]);   // sous la fenêtre nord : u = −z, nu à x 1,01 (65 cm)
const FS = frame([1, 0, 0], [0, 0, 1], [0, 0, 4.89]);    // cloison de l'escalier, bas et colonne : u = x, nu à z 4,89 (65 cm)
const FH = frame([1, 0, 0], [0, 0, 1], [0, 0, 4.61]);    // meubles hauts de 37
const FT2 = frame([1, 0, 0], [0, 0, 1], [0, 0, 4.84]);   // surmeubles de 60
const FE = frame([0, 0, 1], [-1, 0, 0], [2.875, 0, 0]);  // épi côté cuisine : u = z, nu à x 2,875 (plan en débord de 1,5 cm)
const FW = frame([0, 0, -1], [1, 0, 0], [3.845, 0, 0]);  // épi côté séjour : u = −z, nu à x 3,845

// ---------------------------------------------------------------- pièces mobiles
// parts : [{ p, build, motion }] ; build reçoit un Kit dans le repère local décalé de −p, motion(mov) rend la fonction d'ouverture v ∈ [0, 1]
function mover(F, parts, speed = 1.2) {
  const root = new THREE.Group(); root.name = 'cuisine (ouvrant)'; root.userData.noMerge = true; C.groups.furn0.add(root);
  const d: Door = { g: root, meshes: [], open: 0, target: 0, speed, kind: 'cuisine' }, fns = [];
  for (const { p, build, motion } of parts) {
    const outer = new THREE.Group(), mov = new THREE.Group();
    F.clone().multiply(new THREE.Matrix4().makeTranslation(p[0], p[1], p[2])).decompose(outer.position, outer.quaternion, outer.scale);
    outer.add(mov); root.add(outer);
    const s = sinkTo(); build(new Kit('furn0', new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2]), s));
    meshesOf(s, mov, d.meshes); fns.push(motion(mov));
  }
  for (const m of d.meshes) m.userData.door = d;
  d.apply = v => { for (const f of fns) f(v); }; d.apply(0); C.DOORS.push(d); return d;
}
const part = (p, build, motion) => ({ p, build, motion });
const rotY = (a, r = [0, 1]) => g => v => { g.rotation.y = a * ez((v - r[0]) / (r[1] - r[0])); };
const rotX = a => g => v => { g.rotation.x = a * ez(v); };
const slideZ = (s, r = [0, 1]) => g => v => { g.position.z = s * ez((v - r[0]) / (r[1] - r[0])); };
// angle d'ouverture d'une porte à charnières verticales : le chant libre part vers l'avant (z > 0), pivot sur l'arête avant côté charnières
const swing = hu0 => (hu0 ? -1 : 1) * HP;

// poignée barre inox Ø 12 (photos) à 3,2 cm de la façade sur deux pieds
function bar(k, uc, y, L, vert?) {
  const z = 0.032, e = L / 2 - 0.02;
  if (vert) { k.rod('cuInox', [uc, y - L / 2, z], [uc, y + L / 2, z], 0.006, 8); for (const s of [-1, 1]) k.rod('cuInox', [uc, y + s * e, 0], [uc, y + s * e, z], 0.005, 6); }
  else { k.rod('cuInox', [uc - L / 2, y, z], [uc + L / 2, y, z], 0.006, 8); for (const s of [-1, 1]) k.rod('cuInox', [uc + s * e, y, 0], [uc + s * e, y, z], 0.005, 6); }
}
const hlen = w => Math.min(0.448, Math.max(0.16, Math.round(w * 0.55 / 0.032) * 0.032)); // entraxes multiples de 32 mm

// porte basse en bois, poignée horizontale en haut
function baseDoor(F, a, b, ya, yb, hu0) {
  return mover(F, [part([hu0 ? a : b, 0, 0], k => { k.box('cuBas', a, b, ya, yb, -FT, 0); bar(k, (a + b) / 2, yb - 0.05, hlen(b - a)); }, rotY(swing(hu0)))], 1.2);
}
// tiroir : façade bois + caisson gris clair ; sortie = profondeur − 12 cm
function drawer(F, u0, u1, ya, yb, dep, o: any = {}) {
  const fh = yb - ya, h = Math.min(0.24, Math.max(0.07, fh - 0.07));
  return mover(F, [part([0, 0, 0], k => {
    k.box(o.mat || 'cuBas', u0 + G, u1 - G, ya, yb, -FT, 0);
    const a = u0 + 0.03, b = u1 - 0.03, y0 = ya + 0.025, y1 = y0 + h, z0 = -dep + 0.06, z1 = -FT - 0.003;
    k.box('cuMel', a, b, y0, y0 + 0.012, z0, z1); k.box('cuMel', a, a + 0.014, y0, y1, z0, z1); k.box('cuMel', b - 0.014, b, y0, y1, z0, z1); k.box('cuMel', a, b, y0, y1, z0, z0 + 0.014);
    if (o.inner) o.inner(k, a, b, y0, z0, z1);
    bar(k, (u0 + u1) / 2, yb - 0.045, hlen(u1 - u0));
  }, slideZ(dep - 0.12))], 1.3);
}
// caisson bas creux en mélaminé (côtés, fond, dessus sauf sous l'évier, dos, tablettes)
function carcass(k, u0, u1, y0, y1, dep, o: any = {}) {
  const t = 0.016, z0 = -dep, z1 = -FT - 0.002, m = 'cuMel', top = o.top !== false;
  k.box(m, u0, u0 + t, y0, y1, z0, z1); k.box(m, u1 - t, u1, y0, y1, z0, z1); k.box(m, u0 + t, u1 - t, y0, y0 + t, z0, z1);
  if (top) k.box(m, u0 + t, u1 - t, y1 - t, y1, z0, z1);
  k.box(m, u0 + t, u1 - t, y0 + t, y1 - (top ? t : 0), z0, z0 + 0.008);
  for (const ys of o.shelves || []) k.box(m, u0 + t, u1 - t, ys - 0.008, ys + 0.008, z0 + 0.008, z1 - 0.02);
}
// bloc haut à caisson apparent en chêne grisé (photos) : façades crème insérées dans le cadre, gorge de prise de main en bas ;
// doors : [u0, u1, charnière côté u0] ; lift : abattants relevants (surmeubles) ; o.open : sans fond (hotte)
function upperBlock(F, u0, u1, y0, y1, dep, doors, o: any = {}) {
  const k = new Kit('furn0', F), t = 0.016, m = 'cuChene', ya = o.ya ?? y0 + t + 0.002, yb = y1 - t - 0.002;
  k.box(m, u0, u0 + t, y0, y1, -dep, 0); k.box(m, u1 - t, u1, y0, y1, -dep, 0); k.box(m, u0 + t, u1 - t, y1 - t, y1, -dep, 0);
  if (!o.open) k.box(m, u0 + t, u1 - t, y0, y0 + t, -dep, 0);
  k.box(m, u0 + t, u1 - t, o.open ? ya - 0.016 : y0 + t, y1 - t, -dep, -dep + 0.008);
  if (o.open) k.box(m, u0 + t, u1 - t, ya - 0.018, ya - 0.002, -dep + 0.008, -0.002); // fond au-dessus du groupe filtrant
  for (const ys of o.shelves || []) k.box(m, u0 + t, u1 - t, ys - 0.008, ys + 0.008, -dep + 0.008, -0.03);
  for (const [a, b, hu0] of doors) {
    const build = kk => { kk.box('cuLaque', a, b, ya, yb, -FT - 0.001, -0.001); kk.box('cuGorge', a, b, ya + 0.012, ya + 0.019, -0.001, -0.0005); };
    if (o.lift) mover(F, [part([0, yb, -0.001], build, rotX(-85 * Math.PI / 180))], 1.0);
    else mover(F, [part([hu0 ? a : b, 0, -0.001], build, rotY(swing(hu0)))], 1.2);
  }
  return k;
}
// grille de four ou panier : cadre et barreaux en tiges fines
function rack(k, mat, u0, u1, y, z0, z1, n = 6) {
  const t = 0.004;
  k.box(mat, u0, u1, y, y + t, z0, z0 + t); k.box(mat, u0, u1, y, y + t, z1 - t, z1); k.box(mat, u0, u0 + t, y, y + t, z0, z1); k.box(mat, u1 - t, u1, y, y + t, z0, z1);
  for (let i = 1; i < n; i++) { const u = u0 + (u1 - u0) * i / n; k.box(mat, u - t / 2, u + t / 2, y, y + t, z0, z1); }
}

// ---------------------------------------------------------------- textures et matériaux
function materials() {
  const { makeTex, pixelNoise, rng, std } = C;
  // bois à fil horizontal (façades basses gris-brun clair, caissons des hauts en chêne grisé) : veines ondulées raccordées en largeur
  const wood = (base, seed, k) => makeTex(1024, 1.2, (g, s) => {
    pixelNoise(g, s, base, 0.018, 0.035, 3, seed); const r = rng(seed + 1);
    for (let i = 0; i < 70; i++) { const y = r() * s, h = 3 + r() * 26; g.fillStyle = r() < 0.5 ? `rgba(255,248,236,${(0.03 + r() * 0.07) * k})` : `rgba(40,30,22,${(0.03 + r() * 0.08) * k})`; g.fillRect(0, y, s, h); }
    for (let i = 0; i < 260; i++) {
      const y = r() * s, n = 1 + Math.floor(r() * 2), ph = r() * 6.28, a = 1 + r() * 5;
      g.strokeStyle = r() < 0.6 ? `rgba(45,34,26,${(0.06 + r() * 0.16) * k})` : `rgba(255,245,230,${(0.05 + r() * 0.1) * k})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath();
      for (let x = 0; x <= s; x += 16) { const yy = y + Math.sin(x / s * 6.2832 * n + ph) * a; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke();
    }
  });
  // stratifié beige effet pierre (photos) : fond moucheté, fines fibres horizontales
  const stone = makeTex(1024, 0.9, (g, s) => {
    pixelNoise(g, s, '#d8d1c4', 0.03, 0.045, 5, 921); const r = rng(922);
    for (let i = 0; i < 900; i++) { g.strokeStyle = r() < 0.5 ? `rgba(150,138,120,${0.05 + r() * 0.12})` : `rgba(255,252,245,${0.06 + r() * 0.12})`; g.lineWidth = 0.5 + r(); const x = r() * s, y = r() * s, l = 6 + r() * 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 3); g.stroke(); }
    for (let i = 0; i < 2500; i++) { g.fillStyle = r() < 0.6 ? `rgba(120,108,92,${0.1 + r() * 0.25})` : `rgba(255,255,250,${0.2 + r() * 0.3})`; g.fillRect(r() * s, r() * s, 1 + r() * 1.5, 1 + r() * 1.5); }
  });
  // carreaux de ciment 20 × 20, joints de 1 mm : étoile à 8 branches gris chaud et fleur anthracite au centre, pétales anthracite dans les angles
  // (une fleur tous les 4 carreaux, cerclée d'un filet gris), triangles aux milieux des bords (losanges entre carreaux) ; fond crème mat, nuancé
  const cement = makeTex(1024, 0.4, (g, s) => {
    const T = s / 2, cr = '#ece5d7', an = '#50565a', gc = '#a39a8b';
    const disc = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    const ell = (x, y, rx, ry, a, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); };
    const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
    const sq = (r, a, c) => poly([0, 1, 2, 3].map(i => [0.5 + r * Math.cos(a + i * HP), 0.5 + r * Math.sin(a + i * HP)]), c);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      g.save(); g.translate(i * T, j * T); g.scale(T, T); g.beginPath(); g.rect(0, 0, 1, 1); g.clip();
      g.fillStyle = cr; g.fillRect(0, 0, 1, 1);
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const a = Math.atan2(y ? -1 : 1, x ? -1 : 1);
        g.strokeStyle = gc; g.lineWidth = 0.014; g.beginPath(); g.arc(x, y, 0.3, 0, Math.PI * 2); g.stroke();
        ell(x + 0.13 * Math.cos(a), y + 0.13 * Math.sin(a), 0.12, 0.05, a, an);
        for (const da of [-Math.PI / 4, Math.PI / 4]) ell(x + 0.09 * Math.cos(a + da), y + 0.09 * Math.sin(a + da), 0.07, 0.028, a + da, gc);
        disc(x, y, 0.045, gc); disc(x, y, 0.02, cr);
      }
      for (const a of [0, HP, Math.PI, 3 * HP]) { const c = Math.cos(a), d = Math.sin(a); poly([[0.5 + 0.5 * c - 0.05 * d, 0.5 + 0.5 * d + 0.05 * c], [0.5 + 0.5 * c + 0.05 * d, 0.5 + 0.5 * d - 0.05 * c], [0.5 + 0.42 * c, 0.5 + 0.42 * d]], an); }
      sq(0.3, 0, gc); sq(0.3, Math.PI / 4, gc); sq(0.245, 0, cr); sq(0.245, Math.PI / 4, cr);
      for (let k = 0; k < 4; k++) { const a = k * HP; ell(0.5 + 0.1 * Math.cos(a), 0.5 + 0.1 * Math.sin(a), 0.1, 0.042, a, an); ell(0.5 + 0.085 * Math.cos(a + Math.PI / 4), 0.5 + 0.085 * Math.sin(a + Math.PI / 4), 0.07, 0.03, a + Math.PI / 4, gc); }
      disc(0.5, 0.5, 0.035, cr); disc(0.5, 0.5, 0.018, an);
      g.restore();
    }
    const n = document.createElement('canvas'); n.width = n.height = s; pixelNoise(n.getContext('2d'), s, '#808080', 0.05, 0.12, 8, 931);
    g.globalCompositeOperation = 'soft-light'; g.drawImage(n, 0, 0); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#cdc7bc'; for (let k = 0; k <= 2; k++) { g.fillRect(0, k * T - 1.2, s, 2.4); g.fillRect(k * T - 1.2, 0, 2.4, s); }
  });
  // calepinage : rangée entière posée sur le plan de travail, carreaux entiers dans l'angle nord-est (u = x sur la cloison, u = −z au mur nord)
  cement.offset.set(-0.366 / 0.4, -WT / 0.4);
  const cementN = cement.clone(); cementN.offset.set(4.246 / 0.4, -WT / 0.4);
  M.cuBas = std({ map: wood('#988a7b', 941, 0.8), roughness: 0.5 });   // façades basses, joues, plinthes (éclairci le 20/10)
  M.cuChene = std({ map: wood('#b9ab98', 951, 0.65), roughness: 0.55 }); // caissons des meubles hauts
  M.cuLaque = std({ color: '#ece5d4', roughness: 0.1 });                // laqué crème brillant
  M.cuGorge = std({ color: '#a9a191', roughness: 0.4 });
  M.cuPlan = std({ map: stone, roughness: 0.45 });
  M.cuFaience = std({ map: cement, roughness: 0.55 });                 // crédence, cloison de l'escalier
  M.cuFaienceN = std({ map: cementN, roughness: 0.55 });               // crédence, mur nord
  M.cuMel = std({ color: '#dcdbd6', roughness: 0.7 });                  // intérieurs mélaminés
  M.cuInox = std({ color: '#d0d3d5', roughness: 0.28, metalness: 0.5 });
  M.cuInoxB = std({ color: '#b9bcbf', roughness: 0.36, metalness: 0.5 }); // inox brossé du réfrigérateur
  M.cuChrome = std({ color: '#e8eaec', roughness: 0.1, metalness: 0.6 });
  M.cuVerreNoir = std({ color: '#0c0d0f', roughness: 0.06 });
  M.cuVitre = std({ color: '#22272b', roughness: 0.05, metalness: 0.3 });
  M.cuEmail = std({ color: '#2a2c30', roughness: 0.5 });
  M.cuBlanc = std({ color: '#f1f1ee', roughness: 0.45 });
  M.cuGrisClair = std({ color: '#c8cacc', roughness: 0.5 });
  M.cuNoir = std({ color: '#1b1c1e', roughness: 0.5 });
  M.cuGris = std({ color: '#9a9da0', roughness: 0.45, metalness: 0.3 });
  M.cuPVC = std({ color: '#8d9093', roughness: 0.6 });
  M.cuVerre = std({ color: '#d4e4e6', roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false });
  M.cuBac = std({ color: '#e9f0f1', roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
  M.cuAff = std({ color: '#000000', emissive: '#41f07a', emissiveIntensity: 1.2 });
  M.cuLed = std({ color: '#ffffff', emissive: '#fff0d6', emissiveIntensity: 1.1 });
}

// ---------------------------------------------------------------- sous la fenêtre nord
function northRun() {
  const k = new Kit('furn0', FN), yA = PL + 0.003, yB = CT - 0.003;
  // angle Le Mans 120 (z 4,24 → 5,44) : partie aveugle derrière les tiroirs de la cloison, fileur de 4 cm, porte de 50 charnières côté évier,
  // deux plateaux qui sortent par la porte ouverte
  carcass(k, -5.44, -4.24, PL, CT, 0.65);
  k.box('cuMel', -4.89, -4.24, PL, CT, -FT, 0); k.box('cuBas', -4.93, -4.89, PL, CT, -FT, 0);
  mover(FN, [
    part([-5.437, 0, 0], kk => { kk.box('cuBas', -5.437, -4.933, yA, yB, -FT, 0); bar(kk, -5.185, yB - 0.05, hlen(0.50)); }, rotY(swing(true), [0, 0.45])),
    part([0, 0, 0], kk => {
      for (const y of [0.30, 0.60]) {
        kk.g('cuGris', slab(rrect(-5.40, -0.58, -4.96, -0.06, 0.09, 3), [rrect(-5.37, -0.55, -4.99, -0.09, 0.07, 3)], y + 0.008, 0.035, 0.001)); // rebord chromé
        kk.g('cuMel', slab(rrect(-5.39, -0.57, -4.97, -0.07, 0.08, 3), null, y, 0.012, 0.001));
      }
      kk.rod('cuChrome', [-5.38, 0.17, -0.07], [-5.38, 0.80, -0.07], 0.012, 8);
    }, slideZ(0.50, [0.4, 1])),
  ], 0.9);
  // coulissant de 26 (bouteilles, produits d'entretien) : trois paniers
  carcass(k, -5.70, -5.44, PL, CT, 0.65);
  mover(FN, [part([0, 0, 0], kk => {
    kk.box('cuBas', -5.6985, -5.4415, yA, yB, -FT, 0); bar(kk, -5.57, yB - 0.05, 0.16);
    for (const y of [0.20, 0.44, 0.68]) { rack(kk, 'cuGris', -5.67, -5.47, y, -0.58, -0.04, 4); kk.box('cuGris', -5.67, -5.47, y + 0.07, y + 0.075, -0.58, -0.575); kk.box('cuGris', -5.672, -5.668, y, y + 0.08, -0.58, -0.04); kk.box('cuGris', -5.472, -5.468, y, y + 0.08, -0.58, -0.04); }
    kk.box('cuGris', -5.60, -5.54, 0.17, 0.82, -0.585, -0.575);
  }, slideZ(0.50))], 1.3);
  // sous évier 60 : porte charnières côté angle, sans dessus (cuve), siphon
  carcass(k, -6.30, -5.70, PL, CT, 0.65, { top: false });
  baseDoor(FN, -6.2985, -5.7015, yA, yB, false);
  // lave-vaisselle intégré 60 XXL (86,5 de haut pour la niche de 92) : cuve inox, deux paniers, porte abattante (façade bois + contre-porte inox, bandeau de commande sur le chant)
  { const a = -6.87, b = -6.33, z0 = -0.60, z1 = -0.075;
    k.box('cuInoxB', a, b, 0.155, 0.17, z0, z1); k.box('cuInoxB', a, b, 0.89, 0.905, z0, z1); k.box('cuInoxB', a - 0.01, a, 0.155, 0.905, z0, z1); k.box('cuInoxB', b, b + 0.01, 0.155, 0.905, z0, z1); k.box('cuInoxB', a, b, 0.17, 0.89, z0, z0 + 0.01);
    for (const [y, h] of [[0.22, 0.17], [0.52, 0.14]]) { rack(k, 'cuGris', a + 0.02, b - 0.02, y, z0 + 0.03, z1 - 0.03, 8); rack(k, 'cuGris', a + 0.02, b - 0.02, y + h, z0 + 0.03, z1 - 0.03, 1); for (const u of [a + 0.02, b - 0.024]) for (const z of [z0 + 0.03, z1 - 0.034]) k.box('cuGris', u, u + 0.004, y, y + h, z, z + 0.004); }
    k.box('cuGris', a + 0.06, b - 0.06, 0.48, 0.488, (z0 + z1) / 2 - 0.01, (z0 + z1) / 2 + 0.01); // bras de lavage
    mover(FN, [part([0, 0.16, -0.025], kk => {
      kk.box('cuBas', -6.8985, -6.3015, yA, yB, -FT, 0); bar(kk, -6.60, yB - 0.05, hlen(0.60));
      kk.box('cuInoxB', a + 0.005, b - 0.005, 0.17, 0.885, -0.07, -FT);
      kk.box('cuNoir', a, b, 0.885, 0.912, -0.07, -FT); kk.box('cuAff', -6.45, -6.40, 0.912, 0.9125, -0.05, -0.035);
    }, rotX(HP))], 0.8);
  }
  k.box('cuBas', -6.919, -6.90, 0, CT, -0.65, 0); // joue de fin de linéaire contre le réfrigérateur
  k.box('cuBas', -6.90, -4.824, 0, PL - 0.002, -0.066, -0.05); // plinthe
  // réfrigérateur combiné en pose libre 59,5 × 66 × 189 (inox comme l'actuel), 2 cm du mur ouest, charnières côté mur : portes à 90° sans toucher le mur
  { const u0 = -7.52, u1 = -6.925, zb = -0.63, zf = -0.025, w = 0.04;
    k.box('cuBlanc', u0, u0 + w, 0.02, 1.89, zb, zf); k.box('cuBlanc', u1 - w, u1, 0.02, 1.89, zb, zf);
    k.box('cuBlanc', u0 + w, u1 - w, 1.84, 1.89, zb, zf); k.box('cuBlanc', u0 + w, u1 - w, 0.02, 0.07, zb, zf); k.box('cuBlanc', u0 + w, u1 - w, 0.77, 0.86, zb, zf);
    k.box('cuBlanc', u0 + w, u1 - w, 0.07, 1.84, zb, zb + 0.04);
    k.box('cuInoxB', u0 - 0.0015, u0, 0.02, 1.8915, zb, zf); k.box('cuInoxB', u1, u1 + 0.0015, 0.02, 1.8915, zb, zf); k.box('cuInoxB', u0, u1, 1.89, 1.8915, zb, zf);
    k.box('cuNoir', u0, u1, 0.797, 0.813, zf, 0.015); // bandeau noir entre les portes (photo)
    for (const y of [1.12, 1.35, 1.58]) k.box('cuVerre', u0 + w, u1 - w, y, y + 0.005, zb + 0.04, -0.17);
    k.box('cuBac', u0 + w + 0.01, u1 - w - 0.01, 0.87, 1.06, zb + 0.05, -0.18); k.box('cuVerre', u0 + w, u1 - w, 1.065, 1.07, zb + 0.04, -0.17);
    for (const [y0, y1] of [[0.08, 0.30], [0.32, 0.53], [0.55, 0.76]]) k.box('cuBac', u0 + w + 0.01, u1 - w - 0.01, y0, y1, zb + 0.05, -0.12);
    for (const u of [u0 + 0.05, u1 - 0.05]) for (const z of [zb + 0.06, zf - 0.05]) k.g('cuNoir', new THREE.CylinderGeometry(0.015, 0.015, 0.02, 10), u, 0.01, z);
    const fdoor = (y0, y1, balc, hy) => mover(FN, [part([u0, 0, 0.035], kk => {
      kk.box('cuInoxB', u0, u1, y0, y1, zf, 0.035);
      kk.box('cuBlanc', u0 + 0.045, u1 - 0.045, y0 + 0.03, y1 - 0.03, -0.075, zf);
      kk.box('cuNoir', u1 - 0.03, u1 - 0.022, hy[0], hy[1], 0.035, 0.0365); // poignée encastrée côté libre
      for (const b of balc) { kk.box('cuBac', u0 + 0.05, u1 - 0.05, b, b + 0.008, -0.135, -0.075); kk.box('cuBac', u0 + 0.05, u1 - 0.05, b, b + 0.07, -0.14, -0.135); }
    }, rotY(swing(true)))], 1.0);
    fdoor(0.025, 0.795, [], [0.55, 0.76]); fdoor(0.815, 1.885, [1.0, 1.28, 1.56], [0.86, 1.30]);
  }
}

// ---------------------------------------------------------------- cloison de l'escalier : bas, plaque, colonne four, hauts, hotte, surmeubles
function stairRun() {
  const k = new Kit('furn0', FS), yA = PL + 0.003, yB = CT - 0.003;
  const d3 = [[yA, 0.442], [0.445, 0.762], [0.765, yB]], d2 = [[yA, 0.529], [0.532, yB]];
  k.box('cuBas', 1.01, 1.06, PL, CT, -FT, 0); // fileur de 5 cm : les tiroirs passent devant la poignée de la porte Le Mans
  for (const [u0, u1, st] of [[1.06, 1.80, d3], [1.80, 2.40, d2], [2.40, 3.19, d3]] as [number, number, number[][]][]) { carcass(k, u0, u1, PL, CT, 0.65); for (const [a, b] of st) drawer(FS, u0, u1, a, b, 0.65); }
  k.box('cuBas', 0.944, 3.79, 0, PL - 0.002, -0.066, -0.05); // plinthe (colonne comprise)
  // colonne four 60 × 65 du sol au plafond contre le retour : tiroir, four (bas à 45 cm), micro-ondes encastrable (1,05 → 1,43), porte, abattant
  { const a = 3.19, b = 3.79, t = 0.019, i0 = a + t, i1 = b - t;
    k.box('cuBas', a, i0, 0, 2.498, -0.65, -FT); k.box('cuBas', i1, b, 0, 2.498, -0.65, -FT); k.box('cuBas', i0, i1, 2.479, 2.498, -0.65, -FT);
    k.box('cuMel', i0, i1, PL, 2.479, -0.65, -0.642);
    for (const y of [PL + 0.008, 0.440, 1.037, 1.440, 2.150]) k.box('cuMel', i0, i1, y - 0.008, y + 0.008, -0.642, -FT - 0.002);
    for (const y of [1.70, 1.93]) k.box('cuMel', i0, i1, y - 0.008, y + 0.008, -0.62, -0.04);
    drawer(FS, a, b, yA, 0.446, 0.65);
    // four : cavité émaillée, deux grilles, bandeau inox (afficheur, manettes), porte abattante (vitre noire, barre)
    const o0 = 3.1925, o1 = 3.7875;
    k.box('cuEmail', 3.22, 3.76, 0.47, 0.48, -0.56, -0.022); k.box('cuEmail', 3.22, 3.76, 0.92, 0.947, -0.56, -0.022);
    k.box('cuEmail', 3.21, 3.22, 0.47, 0.947, -0.56, -0.022); k.box('cuEmail', 3.76, 3.77, 0.47, 0.947, -0.56, -0.022); k.box('cuEmail', 3.22, 3.76, 0.48, 0.92, -0.56, -0.55);
    for (const y of [0.60, 0.74]) rack(k, 'cuChrome', 3.225, 3.755, y, -0.53, -0.05, 7);
    k.box('cuInox', o0, o1, 0.947, 1.043, -0.022, 0); k.box('cuVerreNoir', 3.36, 3.62, 0.965, 1.025, 0, 0.0008); k.box('cuAff', 3.46, 3.52, 0.987, 1.003, 0.0008, 0.0012);
    for (const x of [3.26, 3.72]) k.g('cuInox', cylZ(0.018, 0.02), x, 0.995, 0.01);
    mover(FS, [part([0, 0.455, 0], kk => {
      kk.box('cuInox', o0, o1, 0.452, 0.944, -0.022, 0); kk.box('cuVerreNoir', 3.25, 3.73, 0.50, 0.86, 0, 0.0008); kk.box('cuVitre', 3.30, 3.68, 0.54, 0.82, 0.0008, 0.0012);
      kk.rod('cuInox', [3.23, 0.905, 0.045], [3.75, 0.905, 0.045], 0.008, 8); for (const x of [3.25, 3.73]) kk.rod('cuInox', [x, 0.905, 0], [x, 0.905, 0.045], 0.006, 6);
    }, rotX(HP))], 0.9);
    // micro-ondes : cadre en verre noir, cavité, plateau tournant, porte à charnières à gauche, commandes à droite
    k.box('cuVerreNoir', o0, o1, 1.047, 1.428, -0.022, -0.004); k.box('cuVerreNoir', 3.645, o1, 1.058, 1.418, -0.004, 0.012); k.box('cuAff', 3.675, 3.755, 1.37, 1.39, 0.012, 0.0125);
    k.g('cuInox', cylZ(0.016, 0.016), 3.715, 1.22, 0.02);
    k.box('cuGrisClair', 3.22, 3.62, 1.07, 1.08, -0.36, -0.022); k.box('cuGrisClair', 3.22, 3.62, 1.40, 1.41, -0.36, -0.022);
    k.box('cuGrisClair', 3.21, 3.22, 1.07, 1.41, -0.36, -0.022); k.box('cuGrisClair', 3.62, 3.63, 1.07, 1.41, -0.36, -0.022); k.box('cuGrisClair', 3.22, 3.62, 1.08, 1.40, -0.36, -0.35);
    k.g('cuVerre', new THREE.CylinderGeometry(0.13, 0.13, 0.006, 24), 3.42, 1.088, -0.19);
    mover(FS, [part([3.196, 0, 0.012], kk => { kk.box('cuVerreNoir', 3.196, 3.64, 1.058, 1.418, -0.004, 0.012); kk.box('cuVitre', 3.23, 3.56, 1.10, 1.38, 0.012, 0.0125); kk.box('cuInox', 3.603, 3.616, 1.12, 1.36, 0.012, 0.028); }, rotY(swing(true)))], 1.0);
    // porte crème au-dessus du micro-ondes (charnières côté retour) et abattant du haut
    const lq = kk => (y0, y1) => { kk.box('cuLaque', a + 0.0015, b - 0.0015, y0, y1, -FT, 0); kk.box('cuGorge', a + 0.0015, b - 0.0015, y0 + 0.012, y0 + 0.019, 0, 0.0004); };
    mover(FS, [part([b - 0.0015, 0, 0], kk => lq(kk)(1.4335, 2.1465), rotY(swing(false)))], 1.2);
    mover(FS, [part([0, 2.4965, 0], kk => lq(kk)(2.1535, 2.4965), rotX(-85 * Math.PI / 180))], 1.0);
  }
  // plaque induction 60 au milieu du plan libre entre l'angle (x 1,01) et la colonne (x 3,19) : x 1,80 → 2,40, sur le casserolier
  new Kit('furn0').g('mobHob', boxG(0.60, 0.006, 0.52), 2.10, WT + 0.003, 4.57, 0, 0, 0, { keepUV: true });
  // meubles hauts de 37 (1,45 → 2,15) : 3 portes jusqu'au mur nord, meuble de 90 centré sur la plaque avec la hotte, 1 porte jusqu'à la colonne
  const yH0 = 1.45, yH1 = 2.15, ya = 1.566;
  upperBlock(FH, 0.36, 1.65, yH0, yH1, 0.37, [[0.378, 0.794, true], [0.797, 1.213, true], [1.216, 1.632, false]], { shelves: [1.80] });
  upperBlock(FH, 2.55, 3.19, yH0, yH1, 0.37, [[2.568, 3.172, false]], { shelves: [1.80] });
  const kh = upperBlock(FH, 1.65, 2.55, yH0, yH1, 0.37, [[1.668, 2.0985, true], [2.1015, 2.532, false]], { open: true, ya });
  // groupe filtrant de 86 à extraction extérieure (demande du 20/10, photo Mobalpa) : corps inox, 2 filtres à graisse, bandeau de commande
  // au nu des portes, 2 spots ; cache-conduit inox Ø 17 jusqu'au haut du meuble, étagères en verre de part et d'autre
  kh.box('cuInoxB', 1.67, 2.53, yH0, ya - 0.018, -0.33, -0.02);
  for (const [x0, x1] of [[1.70, 2.085], [2.115, 2.50]]) kh.box('cuGris', x0, x1, yH0 - 0.002, yH0, -0.30, -0.07);
  kh.box('cuInox', 1.67, 2.53, yH0, ya - 0.004, -0.02, -0.001);
  for (let i = 0; i < 5; i++) kh.box('cuNoir', 2.02 + i * 0.022, 2.034 + i * 0.022, 1.50, 1.512, -0.001, 0);
  kh.box('cuAff', 2.135, 2.165, 1.50, 1.512, -0.001, -0.0005);
  for (const x of [1.85, 2.35]) kh.g('cuLed', new THREE.CylinderGeometry(0.025, 0.025, 0.002, 16), x, yH0 - 0.002, -0.18);
  kh.g('cuInox', new THREE.CylinderGeometry(0.085, 0.085, yH1 - 0.016 - ya, 32), 2.10, (ya + yH1 - 0.016) / 2, -0.185);
  for (const [x0, x1] of [[1.666, 2.005], [2.195, 2.534]]) kh.box('cuVerre', x0, x1, 1.857, 1.863, -0.352, -0.03);
  // conduit Ø 150 (hors meuble du dessus) : monte dans le surmeuble, puis file au fond des surmeubles jusqu'au mur nord ; sortie en façade nord
  // par une grille à clapet RAL 7016 (tracé supposé, percement à valider avec le constructeur)
  const kd = new Kit('furn0'), yd = 2.33, zd = 4.425;
  kd.rod('cuGris', [2.10, yH1 - 0.016, zd], [2.10, yd, zd], 0.075, 20); kd.g('cuGris', new THREE.SphereGeometry(0.075, 20, 12), 2.10, yd, zd);
  kd.rod('cuGris', [2.10, yd, zd], [0.30, yd, zd], 0.075, 20);
  const kx = new Kit('site');
  kx.box('grille', -0.014, -0.002, yd - 0.11, yd + 0.11, zd - 0.11, zd + 0.11);
  for (let i = 0; i < 7; i++) { const y = yd - 0.081 + i * 0.027; kx.box('cuNoir', -0.0145, -0.012, y - 0.006, y + 0.006, zd - 0.085, zd + 0.085); }
  const kl = new Kit('furn0', FH); kl.box('cuLed', 0.40, 1.61, 1.446, 1.45, -0.06, -0.04); kl.box('cuLed', 2.59, 3.15, 1.446, 1.45, -0.06, -0.04); // rubans LED sous les hauts
  // surmeubles de 60 jusqu'au plafond (2,15 → 2,50), abattants relevants alignés sur les portes du dessous
  upperBlock(FT2, 0.36, 1.65, yH1, 2.498, 0.60, [[0.378, 0.794], [0.797, 1.213], [1.216, 1.632]], { lift: true });
  upperBlock(FT2, 1.65, 2.55, yH1, 2.498, 0.60, [[1.668, 2.0985], [2.1015, 2.532]], { lift: true });
  upperBlock(FT2, 2.55, 3.19, yH1, 2.498, 0.60, [[2.568, 3.172]], { lift: true });
}

// ---------------------------------------------------------------- plan de travail, évier, crédence
function worktopSink() {
  const k = new Kit('furn0');
  // plan en L d'un seul tenant (débord de 1,5 cm sur les façades), découpe de l'évier ; plan de l'épi 145 × 100
  k.g('cuPlan', slab([[0.36, 4.24], [3.19, 4.24], [3.19, 4.905], [1.025, 4.905], [1.025, 6.919], [0.36, 6.919]], [rrect(0.45, 5.75, 0.91, 6.71, 0.01, 3)], CT, WT - CT, 0.003));
  k.g('cuPlan', slab([[2.86, 6.09], [3.86, 6.09], [3.86, 7.54], [2.86, 7.54]], null, CT, WT - CT, 0.003));
  // évier inox à poser 100 × 50 : grand bac 40 × 44 × 20 devant le semi-fixe (axe z 6,00), égouttoir rainuré à gauche au-dessus du lave-vaisselle
  const yb = WT - 0.20;
  k.g('cuInox', slab(rrect(0.43, 5.73, 0.93, 6.73, 0.015, 3), [rrect(0.48, 5.78, 0.88, 6.22, 0.03, 3)], WT, 0.004, 0.0015));
  k.box('cuInox', 0.478, 0.482, yb, WT, 5.78, 6.22); k.box('cuInox', 0.878, 0.882, yb, WT, 5.78, 6.22);
  k.box('cuInox', 0.48, 0.88, yb, WT, 5.778, 5.782); k.box('cuInox', 0.48, 0.88, yb, WT, 6.218, 6.222); k.box('cuInox', 0.478, 0.882, yb - 0.004, yb, 5.778, 6.222);
  k.g('cuChrome', new THREE.CylinderGeometry(0.035, 0.035, 0.004, 20), 0.68, yb + 0.002, 6.00);
  for (let i = 0; i < 9; i++) { const z = 6.30 + i * 0.045; k.box('cuInox', 0.47, 0.89, WT + 0.004, WT + 0.0065, z - 0.004, z + 0.004); }
  k.rod('cuPVC', [0.68, yb, 6.00], [0.68, yb - 0.17, 6.00], 0.02, 10); k.rod('cuPVC', [0.68, yb - 0.17, 6.00], [0.38, yb - 0.17, 6.00], 0.02, 10);
  // mitigeur à douchette (comme l'actuel), 30 cm de haut, sur la plage arrière de l'évier
  const tx = 0.455, tz = 6.00, y0 = WT + 0.004;
  k.g('cuChrome', new THREE.CylinderGeometry(0.026, 0.028, 0.01, 20), tx, y0 + 0.005, tz);
  k.rod('cuChrome', [tx, y0, tz], [tx, y0 + 0.30, tz], 0.017, 16);
  k.rod('cuChrome', [tx, y0 + 0.29, tz], [tx + 0.20, y0 + 0.29, tz], 0.011, 12);
  k.rod('cuChrome', [tx + 0.20, y0 + 0.30, tz], [tx + 0.20, y0 + 0.22, tz], 0.014, 12);
  k.rod('cuChrome', [tx, y0 + 0.12, tz - 0.012], [tx + 0.01, y0 + 0.14, tz - 0.07], 0.006, 8);
  // crédence en carreaux de ciment (dessinée en 6 mm) : cloison de l'escalier jusqu'aux hauts (les prises K1 et K4 y sont posées), mur nord jusqu'à l'appui de fenêtre
  k.box('cuFaience', 0.36, 3.19, WT, 1.45, 4.24, 4.246);
  k.box('cuFaienceN', 0.36, 0.366, WT, 1.10, 4.246, 6.919); k.box('cuFaienceN', 0.36, 0.366, 1.10, 1.45, 4.246, 5.18); k.box('cuFaienceN', 0.36, 0.366, 1.10, 1.45, 6.58, 6.919);
}

// ---------------------------------------------------------------- épi 145 × 100 contre la façade ouest
function epi() {
  const yA = PL + 0.003, yB = CT - 0.003;
  new Kit('furn0').box('cuBas', 2.875, 3.845, 0, CT, 6.105, 6.124); // joue côté passage
  // côté cuisine : deux colonnes de 3 grands tiroirs de 60 de profondeur (largeur 70,8)
  const ke = new Kit('furn0', FE);
  for (const [u0, u1] of [[6.124, 6.832], [6.832, 7.54]]) { carcass(ke, u0, u1, PL, CT, 0.585); for (const [a, b] of [[yA, 0.400], [0.403, 0.658], [0.661, yB]]) drawer(FE, u0, u1, a, b, 0.585); }
  ke.box('cuBas', 6.124, 7.54, 0, PL - 0.002, -0.066, -0.05);
  // côté séjour : placards de 40 de profondeur, 3 portes, une tablette
  const kw = new Kit('furn0', FW);
  carcass(kw, -7.54, -6.124, PL, CT, 0.385, { shelves: [0.53] });
  baseDoor(FW, -6.5945, -6.1255, yA, yB, false); baseDoor(FW, -7.0665, -6.5975, yA, yB, false); baseDoor(FW, -7.5385, -7.0695, yA, yB, true);
  kw.box('cuBas', -7.54, -6.124, 0, PL - 0.002, -0.066, -0.05);
}

export function buildCuisine(ctx: Ctx) {
  C = ctx; M = ctx.M; BK.clear();
  materials(); northRun(); stairRun(); worktopSink(); epi();
  flush();
}
