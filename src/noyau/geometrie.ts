// Construction de la géométrie : accumulateur de faces par calque et matériau, fusion de maillages statiques, prismes et murs
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M } from './materiaux';

// ---------------------------------------------------------------- accumulateur de géométrie
export class Acc {
  declare b: Map<string, { layer: string; mat: string; pos: number[]; nor: number[]; uv: number[]; idx: number[] }>;
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
export const A = new Acc();

// [perf] fusion de petits maillages statiques (touffes, quincaillerie, sanitaires…) : un seul maillage, donc un seul appel de dessin,
// par matériau, réglage d'ombre et jeu d'attributs ; les transformations sont appliquées aux sommets (rendu identique).
// roots : objets (maillages ou groupes) déjà enfants de dst ou détachés ; les sous-arbres contenant autre chose que des maillages
// et des groupes (lumières, lignes…) ou masqués sont laissés tels quels ; les maillages transparents, instanciés, multi-matériaux
// ou à renderOrder sont rattachés à dst sans fusion (tri par profondeur conservé). Renvoie les maillages fusionnés.
export function mergeStatic(roots: THREE.Object3D[], dst: THREE.Object3D): THREE.Mesh[] {
  dst.updateWorldMatrix(true, false);
  const inv = dst.matrixWorld.clone().invert(), B = new Map(), loose = [], used = [], out = [];
  for (const r of roots) {
    let ok = r.visible; r.traverse((o: any) => { if ((!o.isMesh && !o.isGroup && o.type !== 'Object3D') || o.userData.noMerge) ok = false; }); // userData.noMerge : sous-arbre laissé intact (objet animé ou retrouvé plus tard)
    if (!ok) continue;
    r.updateWorldMatrix(true, true); used.push(r);
    r.traverse((o: any) => {
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
        else for (const at of Object.values(c.attributes) as THREE.BufferAttribute[]) { const s = at.itemSize, a = at.array; for (let i = 0; i + 2 < at.count; i += 3) for (let k = 0; k < s; k++) { const t = a[(i + 1) * s + k]; a[(i + 1) * s + k] = a[(i + 2) * s + k]; a[(i + 2) * s + k] = t; } }
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
export function sbox(layer: string, mat: string, p0: number[], p1: number[], t0: number, t1: number, yb0: number, yb1: number, h: number, acc = A) {
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

export type Opening = { a0: number; a1: number; y0: number; y1: number };
export type WallMats = { neg: string | null; pos: string | null; end: string | null; top?: string | null; bottom?: string | null };
// mur droit avec ouvertures. axis 'x' : court selon X, épaisseur selon Z (c0..c1)
// Les tableaux ne sont dessinés qu'au droit des ouvertures (pas de faces internes entre tronçons, qui créaient des filets parasites).
export function wall(layer: string, axis: string, c0: number, c1: number, a0: number, a1: number, y0: number, y1: number, openings: Opening[], mats: WallMats) {
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
