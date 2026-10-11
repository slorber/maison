// Salles de bains et WC : meubles Balmani Moon (chêne naturel à tasseaux, plan Solid Surface, grands miroirs rectangulaires rétroéclairés), colonne assortie,
// douches (Bains 160×90 du plan, cabine 140×100 de la salle d'eau parentale), faïence toute hauteur et sol terrazzo de la salle d'eau,
// packs WC au sol Roca The Gap Round à réservoir attenant, sèche-serviettes Atlantic Adélis en sortie de douche, lave-mains du WC du RDC. Appelé avant A.build(groups).
// Repère local des meubles muraux : x le long du mur (vers la droite face au meuble), z sortant du mur, y depuis le sol fini.
import * as THREE from 'three';

const PI = Math.PI, HP = PI / 2;

// ---------------------------------------------------------------- constructeur de maillages (normales explicites, couleur de sommet pour assombrir rainures et joints)
class MB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.ix = []; }
  v(x, y, z, nx, ny, nz, u = 0, w = 0, c = 1) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.c.push(c, c, c); return this.p.length / 3 - 1; }
  tri(a, b, c) { // sens corrigé d'après la normale moyenne des sommets
    const P = this.p, N = this.n, A = a * 3, B = b * 3, C = c * 3;
    const ux = P[B] - P[A], uy = P[B + 1] - P[A + 1], uz = P[B + 2] - P[A + 2], vx = P[C] - P[A], vy = P[C + 1] - P[A + 1], vz = P[C + 2] - P[A + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (Math.abs(cx) + Math.abs(cy) + Math.abs(cz) < 1e-13) return;
    const d = cx * (N[A] + N[B] + N[C]) + cy * (N[A + 1] + N[B + 1] + N[C + 1]) + cz * (N[A + 2] + N[B + 2] + N[C + 2]);
    if (d < 0) this.ix.push(a, c, b); else this.ix.push(a, b, c);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  add(geo, m, c = 1) { // ajoute une géométrie three (primitives, tubes) transformée par la matrice m : un seul maillage par matériau
    const g = m ? geo.clone().applyMatrix4(m) : geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, i0 = this.p.length / 3;
    for (let i = 0; i < P.count; i++) this.v(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i), U ? U.getX(i) : 0, U ? U.getY(i) : 0, c);
    if (g.index) for (let i = 0; i < g.index.count; i++) this.ix.push(i0 + g.index.getX(i)); else for (let i = 0; i < P.count; i++) this.ix.push(i0 + i);
    return this;
  }
  mesh(mat, parent, shadow = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.ix);
    const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
}

// ---------------------------------------------------------------- contours en plan (x, z) : segments droits et arcs, normale sortante = (-tz, tx)
const seg = {
  L(a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), tx = dx / (len || 1), tz = dz / (len || 1); return { len, n: 1, at: t => ({ x: a[0] + tx * t, z: a[1] + tz * t, tx, tz, nx: -tz, nz: tx }) }; },
  A(c, r, a0, a1) { const sg = Math.sign(a1 - a0), len = Math.abs(a1 - a0) * r; return { len, n: Math.max(2, Math.ceil(Math.abs(a1 - a0) / (PI / 20))), at: t => { const a = a0 + sg * t / r, ca = Math.cos(a), sa = Math.sin(a), tx = -sa * sg, tz = ca * sg; return { x: c[0] + r * ca, z: c[1] + r * sa, tx, tz, nx: -tz, nz: tx }; } }; },
};
function sample(segs, closed) { // points du contour avec abscisse curviligne s ; un angle vif garde deux points (deux normales)
  const out = []; let s = 0;
  for (const g of segs) {
    if (g.len < 1e-6) continue;
    for (let i = 0; i <= g.n; i++) { const t = g.len * i / g.n, q = g.at(t); q.s = s + t; const l = out[out.length - 1]; if (l && Math.hypot(l.x - q.x, l.z - q.z) < 1e-7 && Math.abs(l.nx - q.nx) + Math.abs(l.nz - q.nz) < 1e-4) continue; out.push(q); }
    s += g.len;
  }
  if (closed && out.length > 2) { const f = out[0], l = out[out.length - 1]; if (Math.hypot(l.x - f.x, l.z - f.z) < 1e-7 && Math.abs(l.nx - f.nx) + Math.abs(l.nz - f.nz) < 1e-4) out.pop(); }
  return out;
}
// rectangle arrondi fermé ; r : rayon unique ou [avant-gauche, avant-droit, arrière-droit, arrière-gauche] (avant = z1)
function rrect(x0, x1, z0, z1, r) {
  const [fl, fr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  return [seg.L([x0 + fl, z1], [x1 - fr, z1]), seg.A([x1 - fr, z1 - fr], fr, HP, 0), seg.L([x1, z1 - fr], [x1, z0 + br]), seg.A([x1 - br, z0 + br], br, 0, -HP),
    seg.L([x1 - br, z0], [x0 + bl, z0]), seg.A([x0 + bl, z0 + bl], bl, -HP, -PI), seg.L([x0, z0 + bl], [x0, z1 - fl]), seg.A([x0 + fl, z1 - fl], fl, -PI, -3 * HP)];
}
// contour ouvert d'un meuble mural (dos au mur z = 0) : joue gauche, angle quart-de-rond, façade découpée en nd portes, angle, joue droite
function frontPath(xl, xr, d, rl, rr, nd = 1) {
  const s = [];
  if (rl > 0) s.push(seg.L([xl, 0], [xl, d - rl]), seg.A([xl + rl, d - rl], rl, PI, HP));
  const a = xl + rl, b = xr - rr; for (let i = 0; i < nd; i++) s.push(seg.L([a + (b - a) * i / nd, d], [a + (b - a) * (i + 1) / nd, d]));
  if (rr > 0) s.push(seg.A([xr - rr, d - rr], rr, HP, 0), seg.L([xr, d - rr], [xr, 0]));
  return s;
}
function polyC(pts) { // contour fermé quelconque : normales lissées (moyenne des arêtes voisines), parcours retourné si besoin pour des normales sortantes
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  if (a > 0) pts = [...pts].reverse();
  const P = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  const n = P.length, out = []; let s = 0;
  for (let i = 0; i < n; i++) {
    const p = P[i], pr = P[(i - 1 + n) % n], nx = P[(i + 1) % n];
    const l1 = Math.hypot(p[0] - pr[0], p[1] - pr[1]), l2 = Math.hypot(nx[0] - p[0], nx[1] - p[1]);
    let tx = (p[0] - pr[0]) / l1 + (nx[0] - p[0]) / l2, tz = (p[1] - pr[1]) / l1 + (nx[1] - p[1]) / l2; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    out.push({ x: p[0], z: p[1], tx, tz, nx: -tz, nz: tx, s }); s += l2;
  }
  return out;
}
// balayage d'un profil [o (décalage selon la normale du contour), y, no, ny (normale dans le plan du profil)] le long d'un contour
function sweep(mb, C, prof, closed, c = 1) {
  const I = C.map(q => prof.map(([o, y, no, ny]) => mb.v(q.x + q.nx * o, y, q.z + q.nz * o, q.nx * no, ny, q.nz * no, q.s, y, c)));
  const n = closed ? C.length : C.length - 1;
  for (let i = 0; i < n; i++) { const a = I[i], b = I[(i + 1) % C.length]; for (let j = 0; j < prof.length - 1; j++) mb.quad(a[j], b[j], b[j + 1], a[j + 1]); }
}
// profil de chant : congé haut rT, chant droit, congé bas rB
function edgeProf(yb, yt, rT, rB, k = 4) {
  const p = [];
  for (let i = 0; i <= k; i++) { const f = HP * (1 - i / k); p.push([-rT + rT * Math.cos(f), yt - rT + rT * Math.sin(f), Math.cos(f), Math.sin(f)]); }
  for (let i = 0; i <= k; i++) { const f = -HP * i / k; p.push([-rB + rB * Math.cos(f), yb + rB + rB * Math.sin(f), Math.cos(f), Math.sin(f)]); }
  return p;
}
// face horizontale (polygone avec trous, triangulé par earcut), UV en mètres
function cap(mb, outer, holes, y, up, c = 1) {
  const V2 = a => a.map(p => new THREE.Vector2(p[0], p[1]));
  const o = V2(outer), hs = holes.map(V2);
  const faces = THREE.ShapeUtils.triangulateShape(o, hs);
  const ids = o.concat(...hs).map(p => mb.v(p.x, y, p.y, 0, up, 0, p.x, p.y, c));
  for (const [a, b, d] of faces) mb.tri(ids[a], ids[b], ids[d]);
}
// contour ouvert refermé le long du mur (z = 0)
function closeBack(pts) { const f = pts[0], l = pts[pts.length - 1], r = [...pts]; if (Math.abs(f[1]) > 1e-4) r.unshift([f[0], 0]); if (Math.abs(l[1]) > 1e-4) r.push([l[0], 0]); return r; }
// matrice de placement (position, rotations d'Euler) pour MB.add
const TM = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
// profil fermé de rectangle arrondi dans un plan (u, v) : points [u, v, nu, nv]
function rrProf(u0, u1, v0, v1, r, k = 3) {
  const p = [];
  for (const [cu, cv, a0] of [[u1 - r, v1 - r, 0], [u0 + r, v1 - r, HP], [u0 + r, v0 + r, PI], [u1 - r, v0 + r, 3 * HP]])
    for (let i = 0; i <= k; i++) { const a = a0 + HP * i / k, c = Math.cos(a), s = Math.sin(a); p.push([cu + r * c, cv + r * s, c, s]); }
  return p;
}
// extrusion droite d'un profil fermé le long de l'axe ax de a0 à a1 ; plan du profil : 'x' → (z, y), 'y' → (x, z), 'z' → (x, y) ; bouchons en éventail (profil convexe)
function ext(mb, ax, a0, a1, prof, caps = true, c = 1) {
  const P = (a, u, v) => ax === 'x' ? [a, v, u] : ax === 'y' ? [u, a, v] : [u, v, a];
  const I = [a0, a1].map(a => prof.map(([u, v, nu, nv]) => mb.v(...P(a, u, v), ...P(0, nu, nv), a, v, c)));
  for (let i = 0; i < prof.length; i++) { const j = (i + 1) % prof.length; mb.quad(I[0][i], I[1][i], I[1][j], I[0][j]); }
  if (!caps) return;
  const cu = prof.reduce((s, q) => s + q[0], 0) / prof.length, cv = prof.reduce((s, q) => s + q[1], 0) / prof.length;
  for (const [a, sg] of [[a0, -1], [a1, 1]]) {
    const n = P(sg, 0, 0), o = mb.v(...P(a, cu, cv), ...n, cu, cv, c), ids = prof.map(([u, v]) => mb.v(...P(a, u, v), ...n, u, v, c));
    for (let i = 0; i < ids.length; i++) mb.tri(o, ids[i], ids[(i + 1) % ids.length]);
  }
}
// surface réglée entre sections horizontales de même nombre de points (contours [x, z]) : normale = tangente du contour × tangente verticale
function loft(mb, secs, c = 1) {
  const C = secs.map(s => polyC(s.pts)), n = C[0].length, last = C.length - 1;
  const ids = C.map((cs, k) => cs.map((q, i) => {
    const a = C[Math.max(k - 1, 0)][i], b = C[Math.min(k + 1, last)][i], vx = b.x - a.x, vy = secs[Math.min(k + 1, last)].y - secs[Math.max(k - 1, 0)].y, vz = b.z - a.z;
    let nx = vy * q.tz, ny = vz * q.tx - vx * q.tz, nz = -vy * q.tx; if (nx * q.nx + nz * q.nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    return mb.v(q.x, secs[k].y, q.z, nx / l, ny / l, nz / l, q.s, secs[k].y, c);
  }));
  for (let k = 0; k < last; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; mb.quad(ids[k][i], ids[k][j], ids[k + 1][j], ids[k + 1][i]); }
  return C;
}

// ---------------------------------------------------------------- façade à tasseaux : joncs demi-ronds au pas de 16 mm, rainures sombres, joints de portes plus marqués
function fluted(mb, segs, joints, y0, y1, o = {}) {
  const P0 = o.pitch || 0.016, d = o.depth || 0.0034, g = o.groove || 0.13, jw = 0.004, jd = 0.005;
  const U = [-1, -0.94, -0.78, -0.5, -0.17, 0.17, 0.5, 0.78, 0.94, 1];
  let s0 = 0;
  segs.forEach((sg, k) => {
    if (sg.len < 1e-6) return;
    const strip = pts => { let prev = null; for (const [t, off, th, c] of pts) {
      const q = sg.at(Math.min(Math.max(t, 0), sg.len)), ct = Math.cos(th), st = Math.sin(th), nx = q.nx * ct + q.tx * st, nz = q.nz * ct + q.tz * st, x = q.x + q.nx * off, z = q.z + q.nz * off;
      const a = mb.v(x, y0, z, nx, 0, nz, s0 + t, y0, c), b = mb.v(x, y1, z, nx, 0, nz, s0 + t, y1, c); if (prev) mb.quad(prev[0], a, b, prev[1]); prev = [a, b]; } };
    const n = Math.max(1, Math.round(sg.len / P0)), p = sg.len / n;
    for (let i = 0; i < n; i++) {
      const t0 = i * p; let tr0;
      if (i === 0 && joints.includes(k)) { const cj = 0.16; strip([[t0, 0, HP, cj], [t0, -jd, HP, cj]]); strip([[t0, -jd, 0, cj], [t0 + jw, -jd, 0, cj]]); strip([[t0 + jw, -jd, -HP, cj], [t0 + jw, 0, -HP, cj]]); tr0 = t0 + jw; }
      else { strip([[t0, 0, 0, 0.5], [t0 + g * p, 0, 0, 0.5]]); tr0 = t0 + g * p; }
      const a = (t0 + p - tr0) / 2;
      strip(U.map(u => { const sq = Math.sqrt(Math.max(0, 1 - u * u)); return [tr0 + a * (u + 1), d * sq, Math.atan2(d * u, a * Math.max(sq, 0.2)), 0.74 + 0.26 * sq]; }));
    }
    s0 += sg.len;
  });
  return d;
}

// cuve intégrée au plan : congé de bord, parois en légère dépouille, fond arrondi, fond plat
function basin(mb, b, yt) {
  const C = sample(rrect(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, b.r), true).map(q => ({ ...q, nx: -q.nx, nz: -q.nz })); // normales vers le centre de la cuve
  const { rim, dw, rb } = b, yb = yt - b.depth, prof = [], k = 4;
  for (let i = 0; i <= k; i++) { const f = HP * (1 - i / k); prof.push([-rim + rim * Math.cos(f), yt - rim + rim * Math.sin(f), Math.cos(f), Math.sin(f)]); }
  for (let i = 0; i <= k; i++) { const f = HP * i / k; prof.push([dw + rb - rb * Math.cos(f), yb + rb - rb * Math.sin(f), Math.cos(f), Math.sin(f)]); }
  sweep(mb, C, prof, true);
  cap(mb, C.map(q => [q.x + q.nx * (dw + rb), q.z + q.nz * (dw + rb)]), [], yb, 1);
  return yb;
}
// plan Solid Surface (ou céramique) : chant arrondi, cuves intégrées ; contour ouvert (dos au mur) ou fermé
function solidTop(mb, segs, yb, yt, rT, rB, basins, closed = false) {
  const C = sample(segs, closed);
  sweep(mb, C, edgeProf(yb, yt, rT, rB), closed);
  const off = r => C.map(q => [q.x - q.nx * r, q.z - q.nz * r]);
  const holes = basins.map(b => sample(rrect(b.x - b.w / 2 - b.rim, b.x + b.w / 2 + b.rim, b.z - b.d / 2 - b.rim, b.z + b.d / 2 + b.rim, b.r + b.rim), true).map(q => [q.x, q.z]));
  cap(mb, closed ? off(rT) : closeBack(off(rT)), holes, yt, 1);
  cap(mb, closed ? off(rB) : closeBack(off(rB)), [], yb, -1);
  return basins.map(b => basin(mb, b, yt));
}

// ---------------------------------------------------------------- petits éléments
function cyl(parent, mat, r, h, x, y, z, rx = 0, rz = 0, seg = 28, ry = 0) { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
function box(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; }
// mitigeur monocommande fin (corps rond, bec et levier plats), bec vers +z local
function mixer(parent, mat, x, y, z, ry = 0, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); parent.add(g);
  cyl(g, mat, 0.023, 0.006, 0, 0.003, 0, 0, 0, 32); cyl(g, mat, 0.0165, 0.165, 0, 0.0885, 0, 0, 0, 32);
  box(g, mat, 0.024, 0.011, 0.128, 0, 0.138, 0.071); // bec plat
  box(g, mat, 0.016, 0.006, 0.078, 0, 0.176, 0.032, -0.2); // levier
  return g;
}
// miroir rond rétroéclairé : glace face +z local, bord sombre, halo LED sur le mur (plan additif, pas de source lumineuse)
function roundMirror(parent, M, x, y, z, r) {
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 72), M.bnMirror); face.position.set(x, y, z + 0.0335); parent.add(face);
  cyl(parent, M.bnMirrorEdge, r, 0.006, x, y, z + 0.029, HP, 0, 72);
  cyl(parent, M.bnMirrorEdge, r - 0.04, 0.024, x, y, z + 0.013, HP, 0, 48);
  const led = new THREE.Mesh(new THREE.RingGeometry(r - 0.034, r - 0.02, 96), M.bnLed); led.position.set(x, y, z + 0.0345); parent.add(led); // bandeau sablé éclairé
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.9, r * 2.9), M.bnGlow); glow.position.set(x, y, z + 0.0015); glow.renderOrder = 2; parent.add(glow);
}

// grand miroir rectangulaire rétroéclairé (demande de Sébastien pour la salle de bains commune) : angles arrondis 3 cm, glace face +z local,
// chant sombre, entretoise murale, bandeau LED sablé en périphérie, halo sur le mur (plan additif, pas de source lumineuse).
// Le chant est reculé de 1 mm derrière la glace : sa face avant coïncidait avec elle (scintillement en triangles et tirets sur toute la glace).
// Glace non métallique et satinée (bnMirrorRect) : reflet clair et doux, sans horizon sombre sur une grande surface plane.
function rectMirror(parent, M, x, y, z, w, h) {
  const shape = (ww, hh, rr) => { const s = new THREE.Shape(), a = ww / 2, b = hh / 2; s.moveTo(-a + rr, -b); s.lineTo(a - rr, -b); s.absarc(a - rr, -b + rr, rr, -HP, 0); s.lineTo(a, b - rr);
    s.absarc(a - rr, b - rr, rr, 0, HP); s.lineTo(-a + rr, b); s.absarc(-a + rr, b - rr, rr, HP, PI); s.lineTo(-a, -b + rr); s.absarc(-a + rr, -b + rr, rr, PI, PI + HP); return s; };
  const r = 0.03, glass = new THREE.ShapeGeometry(shape(w, h, r), 8), uv = glass.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h); // texture de reflet étalée sur toute la glace
  const face = new THREE.Mesh(glass, M.bnMirrorRect); face.position.set(x, y, z + 0.0335); parent.add(face);
  const edge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(w, h, r), { depth: 0.006, bevelEnabled: false, curveSegments: 8 }), M.bnMirrorEdge); edge.position.set(x, y, z + 0.0265); edge.castShadow = true; parent.add(edge);
  box(parent, M.bnMirrorEdge, w - 0.10, h - 0.10, 0.024, x, y, z + 0.0155);
  const band = shape(w - 0.04, h - 0.04, r - 0.02 > 0.005 ? r - 0.02 : 0.005); band.holes.push(shape(w - 0.068, h - 0.068, 0.005));
  const led = new THREE.Mesh(new THREE.ShapeGeometry(band, 8), M.bnLed); led.position.set(x, y, z + 0.0345); parent.add(led);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.45, h + 0.45), M.bnGlow); glow.position.set(x, y, z + 0.0015); glow.renderOrder = 2; parent.add(glow);
}

// ---------------------------------------------------------------- Balmani Moon : caisson suspendu à tasseaux, extrémités quart-de-rond, plan blanc à cuves intégrées
function moon(ctx, parent, xc, zw, w, bx, mirR) {
  const M = ctx.M, g = new THREE.Group(); g.position.set(xc, ctx.E1, zw); g.rotation.y = PI; parent.add(g); // dos sur un mur z = zw, façade vers -z monde
  const D = 0.46, R = 0.20, y0 = 0.45, y1 = 0.865, yt = 0.905, ov = 0.012;
  const segs = frontPath(-w / 2, w / 2, D, R, R, 2); // joues + angles (panneaux fixes), deux portes à ouverture par pression
  const oak = new MB(), d = fluted(oak, segs, [2, 3, 4], y0, y1);
  cap(oak, closeBack(sample(segs).map(q => [q.x + q.nx * d, q.z + q.nz * d])), [], y0, -1, 0.85);
  oak.mesh(M.bnOak, g);
  const top = new MB(), basins = bx.map(x => ({ x, z: 0.262, w: w > 1.4 ? 0.46 : 0.50, d: 0.30, r: 0.075, rim: 0.01, dw: 0.018, rb: 0.042, depth: 0.11 }));
  const ybs = solidTop(top, frontPath(-w / 2 - ov, w / 2 + ov, D + ov, R + ov, R + ov), y1, yt, 0.014, 0.004, basins);
  top.mesh(M.bnSolid, g);
  basins.forEach((b, i) => { cyl(g, M.bnCopper, 0.021, 0.003, b.x, ybs[i] + 0.0015, b.z, 0, 0, 32); mixer(g, M.bnCopper, b.x, yt, 0.066); if (!Array.isArray(mirR)) roundMirror(g, M, b.x, yt + 0.15 + mirR, 0, mirR); });
  if (Array.isArray(mirR)) rectMirror(g, M, 0, yt + 0.15 + mirR[1] / 2, 0, mirR[0], mirR[1]); // [largeur, hauteur] : un seul grand miroir
  return g;
}
// colonne haute assortie : 35 × 30 × 160, angle extérieur quart-de-rond côté vasque, suspendue au même niveau que le meuble
function moonColumn(ctx, parent, xc, zw) {
  const g = new THREE.Group(); g.position.set(xc, ctx.E1, zw); g.rotation.y = PI; parent.add(g);
  const w = 0.35, D = 0.30, R = 0.15, y0 = 0.45, y1 = 2.05;
  const segs = [seg.L([-w / 2, 0], [-w / 2, D - R]), seg.A([-w / 2 + R, D - R], R, PI, HP), seg.L([-w / 2 + R, D], [w / 2, D])];
  const oak = new MB(), d = fluted(oak, segs, [2], y0, y1);
  const pl = closeBack(sample(segs).map(q => [q.x + q.nx * d, q.z + q.nz * d]));
  cap(oak, pl, [], y0, -1, 0.85); cap(oak, pl, [], y1, 1, 0.95);
  oak.mesh(ctx.M.bnOak, g);
  return g;
}

// ---------------------------------------------------------------- colonne de douche thermostatique murale, pomme ronde Ø 25 (repère local : mur z = 0, sortie vers +z ; ry tourne la colonne autour de son point d'accroche)
function showerColumn(parent, mat, matDark, x, e, zw, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, e, zw); g.rotation.y = ry; parent.add(g);
  const yT = 1.12, zc = 0.065, yH = 2.13, arm = 0.32;
  cyl(g, mat, 0.03, 0.29, 0, yT, zc, 0, HP, 32); // corps du mitigeur thermostatique
  for (const sx of [-1, 1]) { cyl(g, mat, 0.033, 0.05, sx * 0.168, yT, zc, 0, HP, 32); for (let i = 0; i < 10; i++) { const a = i / 10 * 2 * PI; box(g, matDark, 0.046, 0.003, 0.003, sx * 0.168, yT + 0.0335 * Math.cos(a), zc + 0.0335 * Math.sin(a), a); } } // manettes striées
  for (const sx of [-0.075, 0.075]) { cyl(g, mat, 0.011, zc, sx, yT, zc / 2, HP); cyl(g, mat, 0.03, 0.008, sx, yT, 0.004, HP, 0, 32); } // excentriques et rosaces
  cyl(g, mat, 0.012, yH - yT - 0.02, 0, (yT + yH) / 2 + 0.01, zc); // colonne montante
  cyl(g, mat, 0.009, zc, 0, 1.92, zc / 2, HP); cyl(g, mat, 0.022, 0.008, 0, 1.92, 0.004, HP); // patte murale
  const el = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 16, 12), mat); el.position.set(0, yH, zc); g.add(el);
  cyl(g, mat, 0.0115, arm, 0, yH, zc + arm / 2, HP); // bras
  cyl(g, mat, 0.016, 0.025, 0, yH - 0.012, zc + arm, 0, 0, 20); cyl(g, mat, 0.125, 0.009, 0, yH - 0.03, zc + arm, 0, 0, 64); cyl(g, matDark, 0.112, 0.002, 0, yH - 0.0355, zc + arm, 0, 0, 64); // pomme de tête ronde extra-plate
  box(g, mat, 0.034, 0.05, 0.03, 0, 1.56, zc + 0.02); // support coulissant de la douchette
  const hs = new THREE.Group(); hs.position.set(0, 1.56, zc + 0.05); hs.rotation.x = 0.32; g.add(hs);
  cyl(hs, mat, 0.013, 0.20, 0, -0.02, 0, 0, 0, 20); cyl(hs, mat, 0.045, 0.02, 0, 0.09, 0.01, HP - 0.25, 0, 40); // douchette
  const hose = new THREE.CatmullRomCurve3([[0, yT - 0.03, zc], [0.01, yT - 0.2, zc + 0.03], [0.05, 0.62, zc + 0.07], [0.09, 0.60, zc + 0.08], [0.06, 0.95, zc + 0.08], [0.01, 1.40, zc + 0.065], [0, 1.47, zc + 0.03]].map(p => new THREE.Vector3(...p)));
  const ho = new THREE.Mesh(new THREE.TubeGeometry(hose, 48, 0.007, 8), mat); ho.castShadow = true; g.add(ho); // flexible
  return g;
}

// ---------------------------------------------------------------- pack WC au sol Roca The Gap Round (A34D0N2000, demande client : pas de WC suspendu ni de tablette)
// cuvette Rimless sur pied à sortie duale A3420N8000, réservoir attenant à alimentation latérale A3410N1000, abattant Silencio slim A801D12003.
// Cotes Roca : 655 × 370 × 790 (longueur × largeur × hauteur), réservoir 365 × 150 × 390 posé sur la plage arrière de la cuvette (400 de haut).
// Repère local : x sortant du mur (dos du réservoir à 1 cm du mur), z latéral, y depuis le sol fini. Abattant fermé : pas d'intérieur de cuvette à dessiner.
// Porcelaine et chromes regroupés en un maillage chacun ; raccord d'évacuation horizontal au mur, robinet d'arrêt équerre et flexible côté +z.
// contour en plan d'une section : arrière à congés rr, flancs droits, avant arrondi en super-ellipse sur la longueur fl (nombre de points constant pour le lissage entre sections)
function wcOutline(xa, xb, b, fl, rr, n = 2.3) {
  const h = [];
  for (let i = 0; i <= 12; i++) { const t = HP * i / 12; h.push([xb - fl + fl * Math.pow(Math.cos(t), 2 / n), b * Math.pow(Math.sin(t), 2 / n)]); }
  for (let i = 1; i <= 3; i++) h.push([xb - fl + (xa + rr - xb + fl) * i / 3, b]);
  for (let i = 1; i <= 5; i++) { const t = HP * i / 5; h.push([xa + rr - rr * Math.sin(t), b - rr + rr * Math.cos(t)]); }
  h.push([xa, 0]);
  return h.concat(h.slice(1, -1).reverse().map(([x, z]) => [x, -z]));
}
function wcRound(parent, M, px, py, pz, ry) {
  const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.y = ry; parent.add(g);
  const P = new MB(), C = new MB(), X0 = 0.01, X1 = X0 + 0.655, yR = 0.40;
  // gabarit de la cuvette et de son pied selon la hauteur : [y, arrière, avant, demi-largeur, avant arrondi, congé arrière] ; col concave sous la plage du réservoir, avant rentrant vers le pied
  const K = [[0, 0.214, 0.550, 0.127, 0.17, 0.08], [0.03, 0.211, 0.545, 0.122, 0.17, 0.08], [0.10, 0.200, 0.547, 0.124, 0.18, 0.075], [0.15, 0.188, 0.556, 0.131, 0.20, 0.07],
    [0.20, 0.170, 0.572, 0.141, 0.22, 0.06], [0.25, 0.146, 0.595, 0.154, 0.25, 0.05], [0.30, 0.113, 0.625, 0.168, 0.28, 0.04], [0.33, 0.080, 0.645, 0.177, 0.30, 0.03],
    [0.355, 0.036, 0.659, 0.183, 0.31, 0.022], [0.375, X0 + 0.002, 0.664, 0.185, 0.32, 0.02], [0.392, X0, X1, 0.185, 0.32, 0.02], [0.397, X0 + 0.003, X1 - 0.003, 0.182, 0.317, 0.017], [yR, X0 + 0.009, X1 - 0.009, 0.176, 0.311, 0.011]];
  loft(P, K.map(([y, xa, xb, b, fl, rr]) => ({ y, pts: wcOutline(xa, xb, b, fl, rr) })));
  cap(P, wcOutline(X0 + 0.009, X1 - 0.009, 0.176, 0.311, 0.011), [], yR, 1);
  // abattant double slim (453 × 350, 40 d'épaisseur avec le couvercle), fermé
  const so = d => polyC(wcOutline(0.208 + d, 0.660 - d, 0.175 - d, 0.30 - d, 0.075 - d));
  const seat = so(0); sweep(P, seat, edgeProf(yR + 0.001, yR + 0.015, 0.006, 0.003, 2), true); cap(P, seat.map(q => [q.x - q.nx * 0.006, q.z - q.nz * 0.006]), [], yR + 0.015, 1);
  const lid = so(0.003); sweep(P, lid, edgeProf(yR + 0.017, yR + 0.041, 0.012, 0.004, 3), true); cap(P, lid.map(q => [q.x - q.nx * 0.012, q.z - q.nz * 0.012]), [], yR + 0.041, 1);
  // réservoir 365 × 150 × 390 aux angles avant arrondis, couvercle marqué par une gorge
  const cs = d => sample(rrect(-0.1825 + d, 0.1825 - d, X0 + d, X0 + 0.15 - d, [0.045 - d, 0.045 - d, 0.015 - d, 0.015 - d]), true).map(q => [q.z, q.x]);
  const yT = yR + 0.39;
  loft(P, [[yR, 0.004], [yR + 0.004, 0], [yT - 0.03, 0], [yT - 0.0275, 0.0025], [yT - 0.0235, 0.0025], [yT - 0.021, 0], [yT - 0.007, 0], [yT - 0.003, 0.003], [yT, 0.009]].map(([y, d]) => ({ y, pts: cs(d) })));
  cap(P, cs(0.009), [], yT, 1);
  P.add(new THREE.CylinderGeometry(0.055, 0.055, 0.20, 24, 1, true), TM(0.10, 0.18, 0, 0, 0, HP)); // raccord d'évacuation Ø 110 vers la chute (sortie horizontale)
  P.mesh(M.bnPorc, g);
  // chromes : bouton double touche, charnières, cache-vis du pied, robinet d'arrêt équerre et flexible d'alimentation latérale
  C.add(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 32), TM(X0 + 0.075, yT + 0.002, 0)); C.add(new THREE.CylinderGeometry(0.0115, 0.0115, 0.008, 24), TM(X0 + 0.075, yT + 0.003, -0.008));
  for (const s of [-1, 1]) {
    C.add(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 16), TM(0.222, yR + 0.009, s * 0.075, HP));
    C.add(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 16), TM(0.31, 0.04, s * 0.1235, HP));
  }
  const vz = 0.26, vy = 0.25;
  C.add(new THREE.CylinderGeometry(0.024, 0.024, 0.008, 24), TM(0.004, vy, vz, 0, 0, HP)); C.add(new THREE.CylinderGeometry(0.012, 0.012, 0.055, 16), TM(0.0335, vy, vz, 0, 0, HP));
  C.add(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 16), TM(0.035, vy, vz + 0.017, HP)); C.add(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 12), TM(0.052, vy + 0.012, vz));
  const flex = new THREE.CatmullRomCurve3([[0.052, vy + 0.025, vz], [0.056, 0.33, vz - 0.006], [0.064, 0.41, vz - 0.03], [0.07, 0.45, 0.205], [0.07, 0.452, 0.19]].map(p => new THREE.Vector3(...p)));
  C.add(new THREE.TubeGeometry(flex, 24, 0.0055, 8)); C.add(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), TM(0.07, 0.452, 0.1885, HP));
  C.mesh(M.bnChrome, g);
  return g;
}

// ---------------------------------------------------------------- sèche-serviettes électrique Atlantic Adélis blanc brillant, sans soufflerie : largeur 55 cm, épaisseur 4,6 cm, saillie 10 cm,
// hauteur H = 102,7 cm (500 W, réf. 861911), 140,2 cm (750 W, réf. 861912) ou 177,7 cm (1000 W).
// Cadre à deux montants plats, larges lames plates horizontales groupées en 3 blocs séparés par des espaces pour glisser les serviettes,
// boîtier de commande digital en bas à droite, patère latérale en haut à gauche, 4 pattes murales. Un seul maillage (afficheur assombri par la couleur de sommet).
// Repère local : x le long du mur (vers la droite face à l'appareil), z sortant du mur, y depuis le sol fini.
// Hauteur de pose (notice Atlantic) : barreau chauffant le plus bas à 600 mm au moins du sol ; la lame du bas, factice, ne chauffe pas → bas de l'appareil à 51 cm.
function adelis(parent, M, px, py, pz, ry, H = 1.402) {
  const g = new THREE.Group(); g.position.set(px, py, pz); g.rotation.y = ry; parent.add(g);
  const mb = new MB(), W = 0.55, y0 = 0.51, y1 = y0 + H, zb = 0.054, zf = 0.10, cw = 0.03, hb = 0.068, gp = 0.014, en = 0.016;
  const grp = H > 1.6 ? [5, 5, 7] : H > 1.2 ? [4, 4, 6] : [2, 3, 5], nb = grp.reduce((a, b) => a + b, 0), G = (H - 2 * en - nb * hb - (nb - grp.length) * gp) / (grp.length - 1);
  for (const s of [-1, 1]) ext(mb, 'y', y0, y1, rrProf(s < 0 ? -W / 2 : W / 2 - cw, s < 0 ? -W / 2 + cw : W / 2, zb, zf - 0.004, 0.008)); // montants
  let y = y1 - en;
  for (const n of grp) { for (let i = 0; i < n; i++) { ext(mb, 'x', -W / 2 + cw - 0.003, W / 2 - cw + 0.003, rrProf(zb + 0.012, zf, y - hb, y, 0.011), false); y -= hb + gp; } y += gp - G; } // lames
  ext(mb, 'y', y0 - 0.012, y0 + 0.17, rrProf(W / 2 - 0.082, W / 2 + 0.004, zb - 0.004, zf + 0.008, 0.012)); // boîtier de commande
  ext(mb, 'z', zf + 0.008, zf + 0.0095, rrProf(W / 2 - 0.066, W / 2 - 0.012, y0 + 0.10, y0 + 0.135, 0.004), true, 0.12); // afficheur
  mb.add(new THREE.CylinderGeometry(0.007, 0.007, 0.002, 16), TM(W / 2 - 0.039, y0 + 0.07, zf + 0.009, HP), 0.62); // touche
  ext(mb, 'x', -W / 2 - 0.045, -W / 2 + 0.004, rrProf(0.068, 0.088, y1 - 0.135, y1 - 0.115, 0.006)); ext(mb, 'y', y1 - 0.135, y1 - 0.09, rrProf(-W / 2 - 0.047, -W / 2 - 0.031, 0.069, 0.087, 0.006)); // patère
  for (const sx of [-1, 1]) for (const yy of [y0 + 0.14, y1 - 0.14]) { const x = sx * (W / 2 - cw / 2); mb.add(new THREE.CylinderGeometry(0.011, 0.011, zb, 8, 1, true), TM(x, yy, zb / 2, HP)); mb.add(new THREE.CylinderGeometry(0.021, 0.021, 0.006, 12), TM(x, yy, 0.003, HP)); } // pattes murales
  mb.mesh(M.bnRad, g);
  return g;
}
// dérouleur de papier (face locale +z)
function rollHolder(parent, M, x, y, z, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  cyl(g, M.bnChrome, 0.022, 0.008, 0, 0, 0.004, HP); cyl(g, M.bnChrome, 0.006, 0.07, 0, 0, 0.035, HP); cyl(g, M.bnChrome, 0.006, 0.14, 0.07, 0, 0.07, 0, HP);
  cyl(g, M.bnPaper, 0.055, 0.10, 0.08, -0.012, 0.07, 0, HP, 32);
  return g;
}

// ---------------------------------------------------------------- textures et matériaux
function materials(ctx) {
  const { M, std, makeTex, rng } = ctx;
  // chêne naturel clair : fil vertical fin (UV : abscisse le long du contour, hauteur)
  const oak = makeTex(512, 0.4, (g, s, w, h) => {
    const r = rng(501); g.fillStyle = '#d8b18c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 560; i++) {
      const x0 = r() * w, dark = r() < 0.62, a = 0.025 + r() * 0.085, amp = 1 + r() * 4, k = 1 + Math.floor(r() * 3), ph = r() * 7;
      g.strokeStyle = dark ? `rgba(128,82,48,${a})` : `rgba(250,222,186,${a})`; g.lineWidth = 0.6 + r() * 2.4;
      for (const off of [-w, 0, w]) { g.beginPath(); for (let y = 0; y <= h; y += 16) { const x = x0 + off + amp * Math.sin(y / h * 2 * PI * k + ph); y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    }
    const img = g.getImageData(0, 0, w, h), dd = img.data; for (let i = 0; i < dd.length; i += 4) { const n = (r() - 0.5) * 10; dd[i] += n; dd[i + 1] += n; dd[i + 2] += n; } g.putImageData(img, 0, 0);
  }, { w: 512, h: 1024, metersV: 0.8 });
  M.bnOak = std({ map: oak, vertexColors: true, roughness: 0.62 });
  M.bnSolid = std({ color: '#f6f5f2', roughness: 0.3 }); // Solid Surface blanc mat satiné
  M.bnCopper = std({ color: '#c9845a', metalness: 0.55, roughness: 0.32 }); // cuivre brossé
  M.bnBlack = std({ color: '#222326', roughness: 0.48, metalness: 0.3 }); // noir mat (profilés, colonne de douche)
  M.bnBlackDark = std({ color: '#111213', roughness: 0.7 });
  M.bnTray = std({ color: '#f1f0ec', roughness: 0.55 }); // receveur extra-plat en résine minérale blanche
  M.bnPorc = std({ color: '#f9f9f7', roughness: 0.14 }); // porcelaine vitrifiée
  M.bnChrome = std({ color: '#e1e4e7', metalness: 0.5, roughness: 0.2 }); // chromé (métallicité modérée : l'éclairage intérieur a peu d'environnement à refléter)
  M.bnTrim = std({ color: '#c3c6c8', metalness: 0.55, roughness: 0.35 }); // profilés de finition alu
  M.bnPaper = std({ color: '#f4f2ee', roughness: 0.95 });
  M.bnRad = std({ color: '#f7f7f4', roughness: 0.28, vertexColors: true }); // laqué blanc brillant (sèche-serviettes), afficheur assombri par la couleur de sommet
  // glace : reflet flou dessiné (plafond clair en haut, mur plus sombre en bas), légèrement émissive pour ne pas virer au gris
  const mir = makeTex(256, 1, (g, s) => { const gr = g.createLinearGradient(0, 0, s * 0.3, s); gr.addColorStop(0, '#eef1f2'); gr.addColorStop(0.45, '#d5dbde'); gr.addColorStop(1, '#a9b1b5'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    const sh = g.createLinearGradient(0, 0, s, s); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.42, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, s, s); });
  mir.repeat.set(1, 1);
  M.bnMirror = std({ map: mir, emissive: '#ffffff', emissiveMap: mir, emissiveIntensity: 0.16, roughness: 0.08, metalness: 0.25 });
  M.bnMirrorRect = std({ map: mir, emissive: '#ffffff', emissiveMap: mir, emissiveIntensity: 0.34, roughness: 0.42, metalness: 0, envMapIntensity: 0.5 }); // grands miroirs : reflet clair et doux, sans horizon
  M.bnMirrorEdge = std({ color: '#3b3e41', roughness: 0.4, metalness: 0.4 });
  M.bnLed = std({ color: '#fbf7f0', emissive: '#fff1dc', emissiveIntensity: 1.6, roughness: 0.6 });
  const glow = makeTex(256, 1, (g, s) => { g.clearRect(0, 0, s, s); const c = s / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.34, 'rgba(255,255,255,1)'); gr.addColorStop(0.365, 'rgba(255,255,255,0.62)'); gr.addColorStop(0.41, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.47, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); });
  glow.repeat.set(1, 1);
  M.bnGlow = new THREE.MeshBasicMaterial({ map: glow, color: '#ffd8a0', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  // faïence 7,5 × 30 blanc satiné posée verticalement à joints alignés, joint gris clair 2,5 mm (texture = 60 × 60 cm, 8 × 2 carreaux)
  const wt = makeTex(1024, 0.6, (g, s) => {
    const r = rng(502), cols = 8, rows = 2, tw = s / cols, th = s / rows, j = 2.2;
    g.fillStyle = '#b9b5ae'; g.fillRect(0, 0, s, s);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = col * tw + j, y = row * th + j, w = tw - 2 * j, h = th - 2 * j, f = 0.975 + r() * 0.04, wm = (r() - 0.5) * 4;
      g.fillStyle = `rgb(${241 * f + wm},${240 * f},${236 * f - wm})`; g.fillRect(x, y, w, h);
      const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(90,80,70,0.06)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(80,70,60,0.10)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); // bord adouci du carreau
    }
    const img = g.getImageData(0, 0, s, s), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 5; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  });
  M.bnWallTile = std({ map: wt, bumpMap: wt, bumpScale: 1.2, roughness: 0.26 });
  // sol terrazzo clair 60 × 60 à petits éclats (gris, sable, blanc, terre cuite pâle), joint 3 mm (texture = 2 × 2 dalles)
  const tz = makeTex(1024, 1.2, (g, s) => {
    ctx.pixelNoise(g, s, '#dcd6cc', 0.025, 0.018, 6, 504); const r = rng(505);
    const pal = [['#b9b0a2', 0.26], ['#9a938a', 0.18], ['#f1ede6', 0.2], ['#cfa98c', 0.1], ['#6f6b66', 0.08], ['#e2d3bb', 0.18]];
    for (let i = 0; i < 24000; i++) {
      let u = r(), k = 0; while (k < pal.length - 1 && u > pal[k][1]) { u -= pal[k][1]; k++; }
      const big = r() < 0.12, rad = big ? 2.2 + r() * 3.5 : 0.6 + r() * 1.6, x = r() * s, y = r() * s, nv = 5 + Math.floor(r() * 3), a0 = r() * 7;
      g.fillStyle = pal[k][0]; g.beginPath(); for (let v = 0; v < nv; v++) { const a = a0 + v / nv * 2 * PI, rr = rad * (0.6 + r() * 0.6); v ? g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)) : g.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.fill();
    }
    g.fillStyle = '#b4ac9f'; for (const p of [0, s / 2]) { g.fillRect(p - 1.4, 0, 2.8, s); g.fillRect(0, p - 1.4, s, 2.8); } g.fillRect(s - 1.4, 0, 1.4, s); g.fillRect(0, s - 1.4, s, 1.4);
  });
  M.bnTerrazzo = std({ map: tz, roughness: 0.46 });
}

// ---------------------------------------------------------------- carrelage : plans à 1 cm du mur, UV en mètres depuis l'angle de départ et le sol fini (joints calés)
function tileWall(mb, ax, c, sg, a0, a1, y0, y1, ua, va) { // ax 'x' : plan x = c (normale ±x), s'étend en z de a0 à a1 ; ax 'z' : plan z = c, s'étend en x
  const f = ax === 'x' ? -sg : sg, N = ax === 'x' ? [sg, 0, 0] : [0, 0, sg];
  const ids = [[a0, y0], [a1, y0], [a1, y1], [a0, y1]].map(([a, y]) => { const p = ax === 'x' ? [c, y, a] : [a, y, c]; return mb.v(p[0], p[1], p[2], N[0], N[1], N[2], f * (a - ua), y - va); });
  mb.quad(...ids);
}
function tileFloor(mb, x0, x1, z0, z1, y, uo, vo) { const ids = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => mb.v(x, y, z, 0, 1, 0, x - uo, z - vo)); mb.quad(...ids); }

// ---------------------------------------------------------------- assemblage
export function buildBains(ctx) {
  materials(ctx);
  const { A, M, groups, E1: e, H, T } = ctx, c = H.r1Ceil, f1 = groups.furn1, f0 = groups.furn0;
  const B = (l, x0, x1, y0, y1, z0, z1, m) => A.box(l, x0, x1, y0, y1, z0, z1, m);
  const n0 = f0.children.length, n1 = f1.children.length; // [perf] repères pour fusionner à la fin les maillages ajoutés ici

  // --- Bains (x 0,36 → 3,86, z 0,36 → 3,10) : Balmani Moon 160 double vasque sur la cloison de l'escalier (z 3,10), colonne haute dans l'angle nord à sa droite
  moon(ctx, f1, 1.66, 3.10, 1.60, [-0.40, 0.40], [1.40, 0.80]); // un grand miroir 140 × 80 au lieu de deux ronds
  moonColumn(ctx, f1, T + 0.175, 3.10);
  // douche 160 × 90 du plan (angle sud-est), receveur extra-plat, ouverte au nord face à la fenêtre (pas de porte : face d'entrée libre de 90) ;
  // une seule paroi fixe en verre clair de 160 cm côté ouest (z 1,255), profilé mural sur la cloison du WC, barre de stabilisation vers le mur est ; profilés noirs fins
  const zf = 1.255, xr = 2.262, ef = 0.368, xs = 3.852;
  B('furn1', 2.26, xs, e, e + 0.025, ef, 1.262, 'bnTray');
  B('furn1', 2.48, 2.60, e + 0.025, e + 0.0265, 0.73, 0.85, 'bnBlack'); // bonde carrée
  B('furn1', xr + 0.012, xs - 0.02, e + 0.03, e + 2.0, zf - 0.004, zf + 0.004, 'glassShower'); // paroi fixe de 160
  B('furn1', xs - 0.02, xs, e + 0.025, e + 2.0, zf - 0.012, zf + 0.012, 'bnBlack'); // profilé mural (cloison du WC)
  B('furn1', xr, xs - 0.02, e + 0.025, e + 0.03, zf - 0.007, zf + 0.007, 'bnBlack'); // profilé bas
  B('furn1', xr, xr + 0.012, e + 0.025, e + 2.0, zf - 0.006, zf + 0.006, 'bnBlack'); // chant libre côté entrée
  B('furn1', xr + 0.03, xr + 0.05, e + 1.95, e + 1.97, ef, zf - 0.006, 'bnBlack'); // barre de stabilisation (haut du chant libre → mur est)
  showerColumn(f1, M.bnBlack, M.bnBlackDark, xs, e, (ef + 1.262) / 2, -HP); // colonne sur la cloison du WC (demande client), au milieu de la profondeur du receveur
  // sèche-serviettes Atlantic Adélis 750 W blanc (140,2 × 55, seul chauffage de la pièce d'environ 9,6 m²) en sortie de douche, à son emplacement d'origine :
  // sur le mur est juste au nord de l'entrée de la douche (x 1,175 → 1,725), de 0,51 à 1,91 m du sol
  adelis(f1, M, 1.45, e, T, 0);

  // --- Salle d'eau parentale (x 4,90 → 6,29, z 0,36 → 3,10, sans fenêtre ; passage sans porte vers le dressing dans la cloison x 6,29 à z 1,62 → 2,42)
  const t = 0.01, X0 = 4.90 + t, X1 = 6.29 - t, Z0 = T + t, Z1 = 3.10 - t, fl = e + 0.003, yo = e + 2.04;
  // faïence toute hauteur sur les 4 murs, douche comprise ; le passage et ses tableaux restent peints
  const wt = new MB();
  tileWall(wt, 'z', Z0, 1, X0, X1, e, c, X0, fl); // mur est (doublage)
  tileWall(wt, 'x', X0, 1, Z0, Z1, e, c, Z0, fl); // cloison WC
  tileWall(wt, 'z', Z1, -1, X0, X1, e, c, X0, fl); // cloison palier
  tileWall(wt, 'x', X1, -1, Z0, 1.62, e, c, Z0, fl); tileWall(wt, 'x', X1, -1, 2.42, Z1, e, c, Z0, fl); tileWall(wt, 'x', X1, -1, 1.62, 2.42, yo, c, Z0, fl); // cloison dressing, autour du passage
  wt.mesh(M.bnWallTile, groups.r1, false);
  B('r1', X1 - 0.002, 6.292, e, yo + 0.006, 1.615, 1.623, 'bnTrim'); B('r1', X1 - 0.002, 6.292, e, yo + 0.006, 2.417, 2.425, 'bnTrim'); B('r1', X1 - 0.002, 6.292, yo - 0.002, yo + 0.006, 1.615, 2.425, 'bnTrim'); // profilés d'arrêt
  const tf = new MB(); tileFloor(tf, X0, X1, Z0, Z1, fl, 5.295, 1.36); tileFloor(tf, X1, 6.37, 1.622, 2.418, fl, 5.295, 1.36); tf.mesh(M.bnTerrazzo, groups.slab1, false); // dalles centrées sur la pièce
  B('slab1', 6.362, 6.372, e - 0.006, fl + 0.002, 1.622, 2.418, 'bnTrim'); // barre de seuil vers le parquet du dressing
  // Balmani Moon 120 simple vasque contre la cloison du palier, grand miroir rectangulaire rétroéclairé 100 × 80 (au lieu du miroir rond Ø 70)
  moon(ctx, f1, 5.595, Z1, 1.20, [0], [1.00, 0.80]);
  // cabine de douche 140 × 100 : receveur extra-plat, panneau fixe + porte coulissante en verre clair, rail haut et profilés noirs mats
  const zt = 1.36, zp = 1.304, zd = 1.326;
  B('furn1', X0, X1, e, e + 0.025, Z0, zt, 'bnTray'); B('furn1', 5.06, 5.18, e + 0.025, e + 0.0265, 0.62, 0.74, 'bnBlack');
  B('furn1', X0 + 0.02, 5.70, e + 0.045, e + 2.0, zp - 0.004, zp + 0.004, 'glassShower'); // panneau fixe
  B('furn1', 5.62, X1 - 0.025, e + 0.035, e + 1.985, zd - 0.004, zd + 0.004, 'glassShower'); // porte coulissante
  B('furn1', X0, X0 + 0.02, e + 0.025, e + 2.0, zp - 0.012, zp + 0.012, 'bnBlack'); B('furn1', X1 - 0.02, X1, e + 0.025, e + 2.0, zd - 0.012, zd + 0.012, 'bnBlack'); // profilés muraux
  B('furn1', X0 + 0.02, 5.70, e + 0.025, e + 0.045, zp - 0.008, zp + 0.008, 'bnBlack'); B('furn1', 5.688, 5.70, e + 0.045, e + 2.0, zp - 0.007, zp + 0.007, 'bnBlack'); // profilés du fixe
  for (const x of [5.62, X1 - 0.037]) B('furn1', x, x + 0.012, e + 0.035, e + 1.985, zd - 0.007, zd + 0.007, 'bnBlack'); // montants de porte
  B('furn1', X0, X1, e + 2.0, e + 2.04, zp - 0.016, zd + 0.016, 'bnBlack'); // rail haut
  for (const x of [5.70, 6.16]) B('furn1', x - 0.03, x + 0.03, e + 1.975, e + 2.0, zd + 0.004, zd + 0.016, 'bnBlack'); // chariots
  B('furn1', 6.135, 6.149, e + 0.78, e + 1.32, zd + 0.042, zd + 0.056, 'bnBlack'); for (const y of [0.84, 1.26]) B('furn1', 6.137, 6.147, e + y - 0.006, e + y + 0.006, zd + 0.004, zd + 0.042, 'bnBlack'); // poignée bâton
  showerColumn(f1, M.bnBlack, M.bnBlackDark, 5.595, e, Z0);
  // sèche-serviettes Atlantic Adélis 500 W blanc (102,7 × 55, pièce d'environ 3,8 m²) sur la cloison du WC, au plus près de la cabine (z 1,445 → 1,995),
  // de 0,51 à 1,54 m du sol ; la cloison du dressing, côté porte de la cabine, n'offre que 26 cm avant le passage
  adelis(f1, M, X0, e, 1.72, HP, 1.027);

  // --- WC du RDC (x 0,36 → 2,36, z 0,36 → 1,36) : pack WC au sol Roca The Gap Round dos au mur nord, sous la fenêtre (axe z 0,86), dérouleur
  wcRound(f0, M, T, 0, 0.86, 0); rollHolder(f0, M, 0.80, 0.72, T, 0);
  // lave-mains suspendu 40 × 24 en céramique, cuve décalée, robinet sur plage latérale, siphon chromé (cloison x 2,36)
  { const g = new THREE.Group(); g.position.set(2.36, 0, 0.86); g.rotation.y = -HP; f0.add(g);
    const mb = new MB(), yb = solidTop(mb, rrect(-0.20, 0.20, 0, 0.24, [0.05, 0.05, 0.004, 0.004]), 0.73, 0.85, 0.012, 0.022, [{ x: -0.035, z: 0.125, w: 0.27, d: 0.15, r: 0.06, rim: 0.008, dw: 0.012, rb: 0.035, depth: 0.085 }], true)[0];
    mb.mesh(M.bnPorc, g); cyl(g, M.bnChrome, 0.016, 0.003, -0.035, yb + 0.0015, 0.125, 0, 0, 24);
    mixer(g, M.bnChrome, 0.15, 0.85, 0.105, -HP, 0.82);
    cyl(g, M.bnChrome, 0.014, 0.14, -0.035, 0.70, 0.125); cyl(g, M.bnChrome, 0.028, 0.10, -0.035, 0.60, 0.125, 0, 0, 28); cyl(g, M.bnChrome, 0.014, 0.125, -0.035, 0.58, 0.0625, HP); cyl(g, M.bnChrome, 0.03, 0.008, -0.035, 0.58, 0.004, HP); } // siphon

  // --- WC de l'étage (x 3,93 → 4,83, z 0,36 → 2,11) : pack WC au sol Roca The Gap Round dos au mur est (axe x 4,43), à côté du coffre de décompression
  wcRound(f1, M, 4.43, e, T, -HP); rollHolder(f1, M, 4.83, e + 0.72, 0.86, -HP);
  // [perf] sanitaires statiques : petits maillages fusionnés par matériau (un appel de dessin chacun) ; verres et halos restent à part
  if (ctx.mergeStatic) { ctx.mergeStatic(f0.children.slice(n0), f0); ctx.mergeStatic(f1.children.slice(n1), f1); }
}
