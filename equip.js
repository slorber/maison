// Équipements : PAC Atlantic Alféa Extensa Duo A.I. R32 5 kW (module intérieur au garage, unité extérieure sur le pignon nord),
// spots LED encastrés du dressing et de la salle d'eau, proposition de garde-corps acier RAL 7016 pour l'escalier. Appelé avant A.build(groups).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function buildEquipment(ctx) {
  const { M, std } = ctx;
  M.pacUI = std({ color: '#f8f8f6', roughness: 0.17, metalness: 0 }); // tôle laquée blanc brillant
  M.pacUE = std({ color: '#e6e7e3', roughness: 0.42, metalness: 0.05 }); // tôle prélaquée blanc grisé
  M.pacBracket = std({ color: '#b8bcbe', roughness: 0.45, metalness: 0.45 }); // équerres murales en acier galvanisé
  M.pacSeam = std({ color: '#c3c6c6', roughness: 0.5 });
  M.pacPanel = std({ color: '#e4e7e8', roughness: 0.3 });
  M.pacScreen = std({ color: '#161d22', roughness: 0.12, emissive: '#3f7896', emissiveIntensity: 0.35 }); // écran LCD rétroéclairé
  M.pacKnob = std({ color: '#dfe2e3', roughness: 0.28 });
  M.pacGrille = std({ color: '#dcddd9', roughness: 0.45, metalness: 0.1 });
  M.fanDark = std({ color: '#33373a', roughness: 0.75, side: THREE.DoubleSide });
  M.fanBell = std({ color: '#d9dbd8', roughness: 0.5, side: THREE.DoubleSide }); // pavillon et fond clairs, comme sur la photo
  M.fanBack = std({ color: '#b9bcba', roughness: 0.7 });
  M.fanBlade = std({ color: '#3a3e42', roughness: 0.55, side: THREE.DoubleSide });
  M.pipeIns = std({ color: '#1f2022', roughness: 0.85 }); // isolant caoutchouc noir des liaisons frigorifiques
  M.pipeGrey = std({ color: '#9ea2a4', roughness: 0.7 }); // isolant PE gris du circuit de chauffage
  M.copper = std({ color: '#b97a4e', roughness: 0.32, metalness: 0.85 });
  M.ral7016 = std({ color: '#4d5459', roughness: 0.55 }); // même teinte affichée que RAL7016 de main.js // acier thermolaqué gris anthracite RAL 7016
  M.spotTrim = std({ color: '#f5f5f2', roughness: 0.35, metalness: 0.1 });
  M.spotLed = std({ color: '#fffaf2', emissive: '#fff0dc', emissiveIntensity: 0, roughness: 0.3 });
  const n0 = Object.fromEntries(Object.entries(ctx.groups).map(([k, g]) => [k, g.children.length])); // [perf] repères pour la fusion ci-dessous
  pacInterieure(ctx); nourrice(ctx); pacExterieure(ctx); spots(ctx); gardeCorps(ctx);
  // [perf] petits maillages statiques (PAC, spots) fusionnés par calque et matériau : moins d'appels de dessin, rendu identique
  if (ctx.mergeStatic) for (const [k, g] of Object.entries(ctx.groups)) { const added = g.children.slice(n0[k] ?? 0); if (added.length > 1) ctx.mergeStatic(added, g); }
}

// ---------------------------------------------------------------- outils
function mk(ctx, layer, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; ctx.groups[layer].add(m); return m;
}
// texture dessinée sur canvas, plaquée une seule fois sur sa face (logos, décors)
function decal(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// plan w×h centré en (x, y, z), tourné vers n ('+x', '-x', '+z', '-z') ; le sens u de la texture suit la droite de l'observateur
function plane(ctx, layer, mat, w, h, x, y, z, n) {
  const g = new THREE.PlaneGeometry(w, h); g.rotateY({ '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[n]);
  return mk(ctx, layer, g, mat, x, y, z, false);
}
// tube suivant une polyligne à angles cintrés (rayon rb)
function tube(ctx, layer, mat, pts, rad, rb) {
  const path = new THREE.CurvePath(), V = p => new THREE.Vector3(...p);
  let prev = V(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const c = V(pts[i]);
    if (i === pts.length - 1) { path.add(new THREE.LineCurve3(prev, c)); break; }
    const n = V(pts[i + 1]), a = c.clone().add(prev.clone().sub(c).setLength(rb)), b = c.clone().add(n.clone().sub(c).setLength(rb));
    path.add(new THREE.LineCurve3(prev, a)); path.add(new THREE.QuadraticBezierCurve3(a, c, b)); prev = b;
  }
  return mk(ctx, layer, new THREE.TubeGeometry(path, 12 * pts.length, rad, 12, false), mat);
}
// prisme x0..x1 × z0..z1, dessous yb0→yb1 et dessus yt0→yt1 (valeurs en x0 puis x1) : barreaux et lisses rampants, pattes
function prismX(A, layer, mat, x0, x1, z0, z1, yb0, yb1, yt0, yt1) {
  const a = [x0, yb0, z0], b = [x1, yb1, z0], c = [x1, yt1, z0], d = [x0, yt0, z0], e = [x0, yb0, z1], f = [x1, yb1, z1], g = [x1, yt1, z1], h = [x0, yt0, z1];
  const nt = new THREE.Vector3(-(yt1 - yt0) / (x1 - x0), 1, 0).normalize(), nb = new THREE.Vector3((yb1 - yb0) / (x1 - x0), -1, 0).normalize();
  A.quadN(layer, mat, [a, b, c, d], [0, 0, -1]); A.quadN(layer, mat, [e, f, g, h], [0, 0, 1]);
  A.quadN(layer, mat, [a, d, h, e], [-1, 0, 0]); A.quadN(layer, mat, [b, c, g, f], [1, 0, 0]);
  A.quadN(layer, mat, [d, c, g, h], [nt.x, nt.y, 0]); A.quadN(layer, mat, [a, b, f, e], [nb.x, nb.y, 0]);
}
const FONT = 'Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif';

// ---------------------------------------------------------------- PAC : module intérieur (ballon ECS intégré), garage, dos au mur est
// 1863 × 648 × 700 mm, posé sur la dalle du local technique (−0,13), façade vers l'ouest (+Z), à 5 cm du lave-linge (collé à 1 cm de la cloison du garage),
// nourrice à sa gauche contre la cloison de l'entrée ; interface en bas à droite comme sur la photo Atlantic
function pacInterieure(ctx) {
  const { A, M, SH, H } = ctx, L0 = 'furn0';
  const w = 0.648, d = 0.700, h = 1.863, x0 = 5.702, x1 = x0 + w, y0 = -0.13, yt = y0 + h, z0 = SH, z1 = z0 + d, r = 0.032, bv = 0.006, pl = 0.02;
  // caisson : rectangle à angles verticaux arrondis (R 32) extrudé, arêtes haute et basse adoucies, socle en retrait de 2 cm
  const s = new THREE.Shape(), a = w / 2 - bv, b = d / 2 - bv, rr = r - bv;
  s.moveTo(-a + rr, -b); s.lineTo(a - rr, -b); s.absarc(a - rr, -b + rr, rr, -Math.PI / 2, 0); s.lineTo(a, b - rr); s.absarc(a - rr, b - rr, rr, 0, Math.PI / 2);
  s.lineTo(-a + rr, b); s.absarc(-a + rr, b - rr, rr, Math.PI / 2, Math.PI); s.lineTo(-a, -b + rr); s.absarc(-a + rr, -b + rr, rr, Math.PI, Math.PI * 1.5);
  let g = new THREE.ExtrudeGeometry(s, { depth: h - pl - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 8 });
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); g.computeVertexNormals(); // arrondis lissés
  g.rotateX(-Math.PI / 2); g.translate(x0 + w / 2, y0 + pl + bv, z0 + d / 2);
  mk(ctx, L0, g, M.pacUI);
  A.box(L0, x0 + 0.015, x1 - 0.015, y0, y0 + pl, z0 + 0.01, z1 - 0.015, 'blackMatte');
  // joint vertical fin de la façade
  A.box(L0, x0 + 0.437, x0 + 0.442, y0 + 0.65, y0 + 1.53, z1 - 0.001, z1 + 0.0008, 'pacSeam');
  // interface : platine gris clair, écran sombre, bouton rond, deux touches
  const xi = x0 + 0.5575;
  A.box(L0, xi - 0.056, xi + 0.056, y0 + 0.19, y0 + 0.52, z1 - 0.001, z1 + 0.004, 'pacPanel');
  A.box(L0, xi - 0.043, xi + 0.043, y0 + 0.395, y0 + 0.495, z1 + 0.004, z1 + 0.0055, 'pacScreen');
  const kg = new THREE.CylinderGeometry(0.024, 0.025, 0.014, 32); kg.rotateX(Math.PI / 2); mk(ctx, L0, kg, M.pacKnob, xi, y0 + 0.31, z1 + 0.011);
  const kr = new THREE.TorusGeometry(0.027, 0.0015, 6, 40); mk(ctx, L0, kr, M.pacSeam, xi, y0 + 0.31, z1 + 0.0045);
  for (const dx of [-0.03, 0.03]) A.box(L0, xi + dx - 0.006, xi + dx + 0.006, y0 + 0.222, y0 + 0.234, z1 + 0.004, z1 + 0.005, 'pacSeam');
  const lab = decal(256, 48, (c, W, Hc) => { c.fillStyle = '#f8f8f6'; c.fillRect(0, 0, W, Hc); c.fillStyle = '#6f7275'; c.font = `600 30px ${FONT}`; c.textBaseline = 'middle'; c.fillText('alféa', 18, Hc / 2 + 1); c.fillStyle = '#2c2f31'; c.beginPath(); c.arc(112, Hc / 2, 6, 0, 7); c.fill(); c.fillRect(124, Hc / 2 - 1, 110, 2); });
  plane(ctx, L0, std2({ map: lab, roughness: 0.17 }), 0.11, 0.0206, xi, y0 + 0.548, z1 + 0.0007, '+z');
  // logotype « atlantic » gris, vertical, en haut du flanc droit
  const atl = decal(64, 384, (c, W, Hc) => { c.fillStyle = '#f8f8f6'; c.fillRect(0, 0, W, Hc); c.translate(W / 2, Hc / 2); c.rotate(-Math.PI / 2); c.fillStyle = '#a6a9ab'; c.font = `300 52px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('atlantic', 0, 2); });
  plane(ctx, L0, std2({ map: atl, roughness: 0.17 }), 0.036, 0.216, x1 + 0.0007, yt - 0.165, z1 - 0.052, '+x');
  // raccordements en partie haute vers le plafond du garage : départ / retour chauffage (isolés), eau froide / ECS (cuivre),
  // liaisons frigorifiques gaz et liquide (isolant noir) vers l'unité extérieure, gaine électrique
  const yc = H.rdcCeil, zc = z0 + 0.11;
  for (const [xr, rad, m] of [[0.10, 0.0225, M.pipeGrey], [0.185, 0.0225, M.pipeGrey], [0.265, 0.011, M.copper], [0.325, 0.011, M.copper], [0.435, 0.0175, M.pipeIns], [0.505, 0.0125, M.pipeIns], [0.58, 0.01, M.pipeGrey]]) {
    const x = x0 + xr;
    mk(ctx, L0, new THREE.CylinderGeometry(rad, rad, yc - yt + 0.006, 16), m, x, (yt - 0.006 + yc) / 2, zc);
    mk(ctx, L0, new THREE.CylinderGeometry(rad + 0.006, rad + 0.006, 0.028, 16), M.blackMatte, x, yt + 0.012, zc); // passe-tôle
    mk(ctx, L0, new THREE.CylinderGeometry(rad + 0.014, rad + 0.014, 0.006, 20), M.white, x, yc - 0.003, zc, false); // rosace au plafond
  }
}
const std2 = o => new THREE.MeshStandardMaterial(o);

// ---------------------------------------------------------------- nourrice du local technique (plan travaux v3) : sur la cloison de l'entrée (x 5,31), entre z 0,43 et 1,07, à gauche de la PAC
// Entre 1,00 et 1,70 m au-dessus du sol du local (−0,13) : arrivée d'eau montant du vide sanitaire, vanne générale à levier rouge, réducteur de pression et manomètre,
// puis deux collecteurs laiton horizontaux à vannes quart de tour : eau froide en haut (6 départs, poignées et PER bleus), eau chaude sanitaire en bas
// (5 départs, poignées et PER rouges) alimentée par le ballon de la PAC depuis le plafond ; départs PER descendant vers le vide sanitaire.
function nourrice(ctx) {
  const { A, M, std, H } = ctx, L0 = 'furn0', yF = -0.13, xw = 5.31, G = {};
  M.laiton = std({ color: '#c9a34c', roughness: 0.3, metalness: 0.85 }); M.perBleu = std({ color: '#2f6db5', roughness: 0.5 }); M.perRouge = std({ color: '#c23a2e', roughness: 0.5 });
  M.manoFace = std({ color: '#f4f4f0', roughness: 0.25 }); M.levierRouge = std({ color: '#cf2f29', roughness: 0.4 });
  const add = (m, g) => (G[m] = G[m] || []).push(g);
  const cyl = (m, r, l, x, y, z, ax, seg = 14) => { const g = new THREE.CylinderGeometry(r, r, l, seg); if (ax === 'z') g.rotateX(Math.PI / 2); if (ax === 'x') g.rotateZ(Math.PI / 2); g.translate(x, y, z); add(m, g); };
  const cY = (m, r, y0, y1, x, z) => cyl(m, r, y1 - y0, x, (y0 + y1) / 2, z), cZ = (m, r, z0, z1, x, y) => cyl(m, r, z1 - z0, x, y, (z0 + z1) / 2, 'z');
  const za = 0.50, zb = 1.02, zi = 0.43, zr = 1.07, dz = 0.088;
  const EF = { y: yF + 1.50, x: xw + 0.085, m: 'perBleu', n: 6, z0: za + 0.04 }, EC = { y: yF + 1.16, x: xw + 0.052, m: 'perRouge', n: 5, z0: za + 0.04 + dz / 2 };
  for (const r of [EF, EC]) {
    cZ('laiton', 0.016, za, zb, r.x, r.y); cZ('laiton', 0.019, zb, zb + 0.012, r.x, r.y); // collecteur 1" et bouchon
    for (const z of [za + 0.015, zb - 0.02]) A.box(L0, xw, r.x - 0.012, r.y - 0.022, r.y + 0.022, z - 0.011, z + 0.011, 'pacSeam'); // colliers muraux
    for (let i = 0; i < r.n; i++) {
      const z = r.z0 + i * dz;
      cY('laiton', 0.009, r.y - 0.045, r.y, r.x, z); A.box(L0, r.x - 0.013, r.x + 0.013, r.y - 0.076, r.y - 0.045, z - 0.013, z + 0.013, 'laiton'); // vanne quart de tour
      A.box(L0, r.x + 0.013, r.x + 0.019, r.y - 0.071, r.y - 0.05, z - 0.024, z + 0.024, r.m); // poignée papillon
      cY('laiton', 0.011, r.y - 0.096, r.y - 0.076, r.x, z); cY(r.m, 0.008, yF - 0.02, r.y - 0.096, r.x, z); // raccord à compression, tube PER 16
    }
  }
  // arrivée générale (PEHD Ø 25) depuis le vide sanitaire : vanne à levier rouge, réducteur de pression à manomètre, coude dans le collecteur d'eau froide
  cY('perBleu', 0.0125, yF - 0.02, yF + 1.02, EF.x, zi); cY('laiton', 0.017, yF + 1.02, yF + 1.10, EF.x, zi);
  A.box(L0, EF.x + 0.017, EF.x + 0.027, yF + 1.035, yF + 1.14, zi - 0.009, zi + 0.009, 'levierRouge');
  cY('laiton', 0.022, yF + 1.12, yF + 1.24, EF.x, zi); cyl('laiton', 0.007, 0.03, EF.x + 0.032, yF + 1.30, zi, 'x');
  cyl('laiton', 0.031, 0.02, EF.x + 0.055, yF + 1.30, zi, 'x', 24); cyl('manoFace', 0.026, 0.003, EF.x + 0.0665, yF + 1.30, zi, 'x', 24); // manomètre
  cY('laiton', 0.016, yF + 1.24, EF.y, EF.x, zi); cZ('laiton', 0.016, zi, za, EF.x, EF.y);
  // eau chaude sanitaire du ballon de la PAC : descente PER rouge depuis le plafond, coude dans le collecteur bas
  cY('perRouge', 0.0095, EC.y, H.rdcCeil, EC.x, zr); cZ('perRouge', 0.0095, zb + 0.012, zr, EC.x, EC.y);
  for (const k in G) mk(ctx, L0, mergeGeometries(G[k]), M[k]);
}

// ---------------------------------------------------------------- PAC : unité extérieure Fujitsu / Atlantic, pignon nord, centrée sous la fenêtre du WC (z 0,86)
// 632 × 886 × 325 mm, grand côté le long du mur (Z), dos à 12 cm de l'enduit, sur équerres murales et plots anti-vibratiles ; tout reste à z < 1,40 (parvis d'entrée).
// D'après la photo : grille à fils soudés rectangulaire devant l'hélice (2/3 gauche), capot de façade en relief à rainures avec logos rouges
// FUJITSU et atlantic (1/3 droit), capot des vannes galbé et poignée sur le flanc droit, pieds emboutis débordant à l'avant.
function pacExterieure(ctx) {
  const { A, M, hAt } = ctx, LS = 'site';
  const W = 0.886, Hh = 0.632, Dp = 0.325, xb = -0.12, xf = xb - Dp, z0 = 0.86 - W / 2, z1 = z0 + W;
  // sur équerres murales en acier galvanisé (pas de dalle) : bras de 50 cm à 35 cm au-dessus du terrain fini, jambe de force, platine chevillée
  const yp = Math.max(hAt(xf - 0.05, z0), hAt(xf - 0.05, z1)) + 0.35, xa = xf - 0.06;
  for (const zc of [z0 + 0.075, z1 - 0.105]) {
    A.box(LS, -0.008, 0, yp - 0.30, yp + 0.01, zc - 0.03, zc + 0.03, 'pacBracket'); // platine murale
    A.box(LS, xa, -0.008, yp - 0.04, yp, zc - 0.02, zc + 0.02, 'pacBracket'); // bras horizontal
    prismX(A, LS, 'pacBracket', -0.34, -0.008, zc - 0.016, zc + 0.016, yp - 0.075, yp - 0.29, yp - 0.04, yp - 0.255); // jambe de force
    A.box(LS, xa - 0.004, xa, yp - 0.04, yp, zc - 0.02, zc + 0.02, 'blackMatte'); // embout
  }
  const yr = yp + 0.035, yb = yr + 0.03, yt = yb + Hh; // plots 35 mm, pieds 30 mm
  for (const zc of [z0 + 0.075, z1 - 0.105]) {
    A.box(LS, xf + 0.03, xb - 0.03, yp, yr, zc - 0.03, zc + 0.03, 'blackMatte');
    A.box(LS, xf, xb, yr, yb, zc - 0.022, zc + 0.022, 'pacUE');
    prismX(A, LS, 'pacUE', xf - 0.035, xf, zc - 0.022, zc + 0.022, yr, yr, yr + 0.011, yb); // patte avant emboutie
    prismX(A, LS, 'pacUE', xb, xb + 0.03, zc - 0.022, zc + 0.022, yr, yr, yb, yr + 0.011);
    A.box(LS, xf - 0.026, xf - 0.010, yr + 0.0125, yr + 0.0135, zc - 0.008, zc + 0.008, 'fanDark'); // lumière de fixation
  }
  // caisson (la façade est un panneau percé, posé à part)
  A.box(LS, xf, xb, yb, yt, z0, z1, { def: 'pacUE', nx: null });
  const g0 = 0.025, g1 = 0.575, v0 = 0.025, v1 = Hh - 0.045, uc = (g0 + g1) / 2, vc = (v0 + v1) / 2, rf = 0.262, fy = yb + vc, fz = z0 + uc;
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(W, 0); fs.lineTo(W, Hh); fs.lineTo(0, Hh); fs.lineTo(0, 0);
  const hole = new THREE.Path(); hole.absarc(uc, vc, rf, 0, Math.PI * 2, true); fs.holes.push(hole);
  const fg = new THREE.ShapeGeometry(fs, 48); fg.rotateY(-Math.PI / 2); mk(ctx, LS, fg, M.pacUE, xf - 0.0003, yb, z0);
  // pavillon clair, fond, hélice tripale sombre à pales larges
  const cyl = new THREE.CylinderGeometry(rf, rf * 0.93, 0.13, 48, 1, true); cyl.rotateZ(Math.PI / 2); mk(ctx, LS, cyl, M.fanBell, xf + 0.065, fy, fz, false);
  const bd = new THREE.CircleGeometry(rf * 0.93, 40); bd.rotateY(-Math.PI / 2); mk(ctx, LS, bd, M.fanBack, xf + 0.13, fy, fz, false);
  const fan = new THREE.Group(); fan.position.set(xf + 0.07, fy, fz); fan.rotation.y = -Math.PI / 2; ctx.groups[LS].add(fan);
  const hub = new THREE.CylinderGeometry(0.045, 0.06, 0.05, 24); hub.rotateX(Math.PI / 2); fan.add(new THREE.Mesh(hub, M.fanBlade));
  const bs = new THREE.Shape(); bs.moveTo(0.04, -0.045); bs.quadraticCurveTo(0.17, -0.14, 0.245, -0.06); bs.quadraticCurveTo(0.262, 0.045, 0.2, 0.105); bs.quadraticCurveTo(0.12, 0.095, 0.04, 0.045); bs.lineTo(0.04, -0.045);
  const bgeo = new THREE.ShapeGeometry(bs, 10);
  for (let k = 0; k < 3; k++) { const ho = new THREE.Group(); ho.rotation.z = k * 2 * Math.PI / 3 + 1.2; const bl = new THREE.Mesh(bgeo, M.fanBlade); bl.rotation.x = 0.32; ho.add(bl); fan.add(ho); }
  // cadre en relief et grille à fils soudés : fils verticaux au pas de 12,5 mm, fils horizontaux au pas de 26 mm, deux fils renforcés
  const Z = u => z0 + u, Y = v => yb + v, xg = xf - 0.006;
  for (const [a0, a1, b0, b1] of [[g0 - 0.012, g1 + 0.012, v1, v1 + 0.012], [g0 - 0.012, g1 + 0.012, v0 - 0.012, v0], [g0 - 0.012, g0, v0, v1], [g1, g1 + 0.012, v0, v1]]) A.box(LS, xg, xf, Y(b0), Y(b1), Z(a0), Z(a1), 'pacUE');
  for (let u = g0 + 0.009; u < g1 - 0.004; u += 0.0125) A.box(LS, xg + 0.0005, xg + 0.0028, Y(v0), Y(v1), Z(u) - 0.0012, Z(u) + 0.0012, 'pacGrille');
  for (let v = v0 + 0.013; v < v1 - 0.004; v += 0.026) { const t = Math.abs(v - 0.27) < 0.013 || Math.abs(v - 0.43) < 0.013 ? 0.002 : 0.001; A.box(LS, xg + 0.0028, xg + 0.0052, Y(v) - t, Y(v) + t, Z(g0), Z(g1), 'pacGrille'); }
  // capot de façade en relief (1/3 droit) : rainures, logos rouges
  const c0 = 0.595, c1 = W - 0.02, cv0 = 0.02, cv1 = Hh - 0.04, cw = c1 - c0, ch = cv1 - cv0;
  A.box(LS, xf - 0.010, xf, Y(cv0), Y(cv1), Z(c0), Z(c1), { def: 'pacUE', nx: null });
  const logo = decal(256, 584, (c, Wc, Hc) => {
    c.fillStyle = '#e6e7e3'; c.fillRect(0, 0, Wc, Hc);
    const sh = (y, h, col) => { c.fillStyle = col; c.fillRect(6, y, Wc - 12, h); };
    for (const f of [0.34, 0.59]) { sh(Hc * f - 2, 2, '#c3c5c1'); sh(Hc * f, 2, '#f4f5f2'); }
    c.strokeStyle = '#d2d4d0'; c.lineWidth = 4; c.beginPath(); c.roundRect(2, 2, Wc - 4, Hc - 4, 14); c.stroke();
    c.fillStyle = '#d2232d'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `bold 36px ${FONT}`; c.save(); c.translate(Wc / 2, Hc * 0.107); c.scale(0.9, 1.1); c.fillText('FUJITSU', 0, 0); c.restore();
    c.fillStyle = '#e4402e'; c.font = `bold 34px ${FONT}`; c.fillText('atlantic', Wc / 2, Hc * 0.39);
  });
  plane(ctx, LS, std2({ map: logo, roughness: 0.42, metalness: 0.05 }), cw, ch, xf - 0.0105, Y(cv0 + ch / 2), Z(c0 + cw / 2), '-x');
  // flanc gauche : batterie à ailettes derrière sa grille de protection
  const coil = decal(128, 256, (c, Wc, Hc) => { c.fillStyle = '#4c5154'; c.fillRect(0, 0, Wc, Hc); c.fillStyle = '#6c7174'; for (let x = 0; x < Wc; x += 4) c.fillRect(x, 0, 1, Hc); c.fillStyle = '#d9dad6'; for (let y = 10; y < Hc; y += 22) c.fillRect(0, y, Wc, 2); for (let x = 12; x < Wc; x += 22) c.fillRect(x, 0, 2, Hc); });
  plane(ctx, LS, std2({ map: coil, roughness: 0.6, metalness: 0.2 }), Dp - 0.06, Hh - 0.07, (xf + 0.04 + xb - 0.02) / 2, yb + Hh / 2, z0 - 0.0008, '-z');
  // flanc droit : capot des vannes galbé (plus large en pied) et poignée
  const sc = new THREE.Shape(); sc.moveTo(0.015, 0.02); sc.lineTo(0.015, Hh - 0.05); sc.lineTo(0.112, Hh - 0.05); sc.quadraticCurveTo(0.125, Hh * 0.42, 0.205, 0.17); sc.lineTo(0.215, 0.02); sc.lineTo(0.015, 0.02);
  mk(ctx, LS, new THREE.ExtrudeGeometry(sc, { depth: 0.014, bevelEnabled: false, curveSegments: 16 }), M.pacUE, xf, yb, z1);
  A.box(LS, xf + 0.032, xf + 0.078, yt - 0.165, yt - 0.03, z1 + 0.014, z1 + 0.032, 'pacUE');
  A.box(LS, xf + 0.040, xf + 0.070, yt - 0.150, yt - 0.06, z1 + 0.032, z1 + 0.0325, 'fanDark');
  // liaisons frigorifiques gaz / liquide (isolant noir) et câble d'alimentation : sortie du capot des vannes, coude, le long du flanc, traversée du mur
  const zl = z1 + 0.035;
  for (const [x, y, rad, m] of [[xf + 0.09, yb + 0.075, 0.017, M.pipeIns], [xf + 0.13, yb + 0.115, 0.012, M.pipeIns], [xf + 0.16, yb + 0.20, 0.007, M.pipeGrey]])
    tube(ctx, LS, m, [[x, y, z1 + 0.005], [x, y, zl], [-0.004, y, zl]], rad, 0.026);
  A.box(LS, -0.022, -0.008, yb + 0.04, yb + 0.235, z1 + 0.005, z1 + 0.075, 'white'); // plaque de traversée
}

// ---------------------------------------------------------------- spots LED encastrés (Ø 8,5 cm) et leurs lumières
// 2 dans le dressing (axe de l'allée entre les placards), 2 dans la salle d'eau parentale (axe de la pièce, aux quarts)
function spots(ctx) {
  const { M, H, roomLights, hooks } = ctx, yc = H.r1Ceil, lights = [];
  const pts = [[6.87, 1.705, 1.0], [7.88, 1.705, 1.0], [5.595, 1.045, 0.8], [5.595, 2.415, 0.8]];
  const trim = new THREE.CylinderGeometry(0.0425, 0.0425, 0.005, 32, 1, true);
  const ring = new THREE.RingGeometry(0.031, 0.0425, 32); ring.rotateX(Math.PI / 2);
  const led = new THREE.CircleGeometry(0.031, 32); led.rotateX(Math.PI / 2);
  for (const [x, z, k] of pts) {
    mk(ctx, 'ceil1', trim, M.spotTrim, x, yc - 0.0025, z, false); mk(ctx, 'ceil1', ring, M.spotTrim, x, yc - 0.005, z, false); mk(ctx, 'ceil1', led, M.spotLed, x, yc - 0.0032, z, false);
    const sp = new THREE.SpotLight(0xffedd8, 0, 4.2, 0.95, 0.6, 2); sp.position.set(x, yc - 0.01, z); sp.add(sp.target); sp.target.position.set(0, -1, 0);
    sp.userData.lv = 1; sp.userData.k = k; ctx.scene.add(sp); roomLights.push(sp); lights.push(sp);
  }
  hooks.pre.push(() => { M.spotLed.emissiveIntensity = lights[0].intensity > 0 ? 2.2 : 0; });
}

// ---------------------------------------------------------------- garde-corps de l'escalier (proposition), acier thermolaqué RAL 7016
// Fixation à l'anglaise sur la joue béton au jour (z 3,27), à 12 mm : poteaux 40×40, main courante plate 40×10 à 0,90 m au-dessus
// de la ligne des nez, lisse basse 40×10 rampante sur la joue, barreaux 20×20 (vide ≤ 10 cm). Poteau de départ sur la marche 1
// (les balancées convergent au jour : il porte la main courante à la hauteur de la volée droite), poteau d'arrivée à 1,00 m
// au-dessus du palier, retourné sur l'about du mur WC / bains. La trémie est fermée par des murs sur ses trois autres côtés.
// Découpé au niveau du plancher de l'étage : la partie basse dans 'rdc', la partie haute dans 'r1' (vues en coupe).
function gardeCorps(ctx) {
  const { A, E1 } = ctx, mat = 'ral7016';
  const rise = E1 / 16, xs = 1.31, zj = 3.27, go = (3.91 - xs) / 11, ov = 0.02;
  const yN = x => rise * (5 + (x + ov - xs) / go), yH = x => yN(x) + 0.90; // ligne des nez au jour, dessus de main courante
  const zp0 = zj - 0.052, zp1 = zj - 0.012, zc = (zp0 + zp1) / 2;
  const prism = (layer, x0, x1, z0, z1, yb0, yb1, yt0, yt1) => prismX(A, layer, mat, x0, x1, z0, z1, yb0, yb1, yt0, yt1);
  // découpe à +2,87 entre les deux calques
  const part = (x0, x1, z0, z1, yb0, yb1, yt0, yt1) => {
    const lin = (p, q, t) => p + (q - p) * t, cuts = [0, 1];
    for (const [p, q] of [[yb0, yb1], [yt0, yt1]]) if ((p - E1) * (q - E1) < 0) cuts.push((E1 - p) / (q - p));
    cuts.sort((p, q) => p - q);
    for (let i = 0; i < cuts.length - 1; i++) {
      const t0 = cuts[i], t1 = cuts[i + 1]; if (t1 - t0 < 1e-6) continue;
      const xa = lin(x0, x1, t0), xb = lin(x0, x1, t1), b0 = lin(yb0, yb1, t0), b1 = lin(yb0, yb1, t1), u0 = lin(yt0, yt1, t0), u1 = lin(yt0, yt1, t1);
      if (Math.min(u0, E1) - b0 > 1e-4 || Math.min(u1, E1) - b1 > 1e-4) prism('rdc', xa, xb, z0, z1, b0, b1, Math.min(u0, E1), Math.min(u1, E1));
      if (u0 - Math.max(b0, E1) > 1e-4 || u1 - Math.max(b1, E1) > 1e-4) prism('r1', xa, xb, z0, z1, Math.max(b0, E1), Math.max(b1, E1), u0, u1);
    }
  };
  const box = (x0, x1, y0, y1, z0, z1) => part(x0, x1, z0, z1, y0, y0, y1, y1);
  // main courante plate 40×10, du poteau de départ au poteau d'arrivée
  const xd = 1.315, xa = 3.85;
  part(xd, xa, zp0, zp1, yH(xd) - 0.01, yH(xa) - 0.01, yH(xd), yH(xa));
  // poteau de départ sur platine (marche 1), patte sur la joue de la marche 2
  box(xd - 0.03, xd + 0.07, rise, rise + 0.008, zp0 - 0.028, zj - 0.002);
  part(xd, xd + 0.04, zp0, zp1, rise + 0.008, rise + 0.008, yH(xd) - 0.01, yH(xd + 0.04) - 0.01);
  box(xd + 0.005, xd + 0.035, 0.235, 0.315, zp1, zj);
  // poteau intermédiaire et poteau d'arrivée fixés à l'anglaise (deux platines d'écartement chacun)
  const xm = 2.60;
  part(xm, xm + 0.04, zp0, zp1, yN(xm + 0.02) - 0.375, yN(xm + 0.02) - 0.375, yH(xm) - 0.01, yH(xm + 0.04) - 0.01);
  box(xa, xa + 0.04, yN(xa + 0.02) - 0.375, E1 + 1.00, zp0, zp1);
  for (const x of [xm + 0.02, xa + 0.02]) for (const dy of [-0.365, -0.26]) box(x - 0.03, x + 0.03, yN(x) + dy, yN(x) + dy + 0.05, zp1, zj);
  // retours du poteau d'arrivée sur l'about du mur (z 3,17) : lisse haute à 1,00 m et entretoise, platines murales
  box(xa, xa + 0.04, E1 + 0.99, E1 + 1.00, 3.176, zp0); box(xa + 0.01, xa + 0.03, E1 + 0.45, E1 + 0.47, 3.176, zp0);
  box(xa - 0.005, xa + 0.045, E1 + 0.95, E1 + 1.005, 3.17, 3.176); box(xa - 0.005, xa + 0.045, E1 + 0.425, E1 + 0.495, 3.17, 3.176);
  // travées : lisse basse rampante sur la joue (entretoises), barreaux 20×20 répartis à vide ≤ 10 cm
  for (const [p, q] of [[xd + 0.04, xm], [xm + 0.04, xa]]) {
    part(p, q, zc - 0.005, zc + 0.005, yN(p) - 0.31, yN(q) - 0.31, yN(p) - 0.27, yN(q) - 0.27);
    for (const t of [0.22, 0.78]) { const x = p + (q - p) * t; box(x - 0.015, x + 0.015, yN(x) - 0.305, yN(x) - 0.275, zc + 0.005, zj); }
    const n = Math.ceil((q - p - 0.10) / 0.12), gp = (q - p - 0.02 * n) / (n + 1);
    for (let i = 0; i < n; i++) { const x0 = p + gp * (i + 1) + 0.02 * i, x1 = x0 + 0.02; part(x0, x1, zc - 0.01, zc + 0.01, yN(x0) - 0.27, yN(x1) - 0.27, yH(x0) - 0.01, yH(x1) - 0.01); }
  }
}
