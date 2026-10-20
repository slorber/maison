// Abords : sol, rue des Fauvettes (branche sud), allée, terrasse, pergola, jardin de pluie, arbres et haies
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { L, D, SH } from '../maison/plan';
import { A, mergeStatic } from '../noyau/geometrie';
import { M } from '../noyau/materiaux';
import { rng, smooth } from '../noyau/outils';
import { groups } from '../noyau/etat';
import { fitPlane, RAIN, polyInfo, hAt, zWest, xSouth, RUE, PATH, pathTop, SEUIL, MUR } from './relief';
import { overlayQuad, overlayPoly } from './revetements';
import { buildFences } from './clotures';
import { envGround } from './env';

export function buildSite() {
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
  // rue des Merlettes, branche ouest le long de la limite A–D (profil, bordures, trottoir, carrefour, mobilier) : rue.ts ; rue des Fauvettes, branche sud le long de C–D
  // branche sud : droite le long de la limite C–D jusqu'au cerisier du voisin est, puis virage vers le sud (plan Google, vue aérienne, photos 9 et 11)
  const xq = (z, o) => [xSouth(z) + o, z], K = [27.785, 1.425], R0 = K[0] - xSouth(K[1]); // centre du virage (rayon 5,50 à l'axe), rayon du bord nord
  // pas de trottoir le long de notre clôture sud : la chaussée vient jusqu'au mur (client, 12/10) ; le trottoir ne commence qu'au pilier sud-est, dans l'angle du virage
  // chaussée calée sur les points levés R1 à R8 (enrobé 3 mm au-dessus de la surface interpolée) ; fil d'eau d'en face à 5,05 de la limite (plan : x 24,52 → 24,60),
  // trottoir d'en face (10 cm, R6) à partir du lampadaire (z 5,74, début de la bordure au plan) jusqu'au nu du n° 6 : rue.ts ; avant, chaussée jusqu'au nu
  const FAR = z => RUE.xS6(z) - xSouth(z), FS = z => RUE.xFS(z) - xSouth(z), zF = zWest(24.6);
  overlayQuad('site', 'asphalt', [xq(K[1], 0), xq(K[1], 0.45), xq(zWest(19.9), 0.45), xq(zWest(19.5), 0)], 0.003, 2, 26);
  overlayQuad('site', 'asphalt', [xq(K[1], 0.45), xq(K[1], FS(K[1])), xq(zF, FS(zF)), xq(zWest(19.9), 0.45)], 0.003, 6, 26);
  overlayQuad('site', 'asphalt', [xq(K[1], FS(K[1])), xq(K[1], FAR(K[1])), xq(5.74, FAR(5.74)), xq(5.74, FS(5.74))], 0.003, 2, 8);
  { // virage et branche vers le sud jusqu'en x 60 ; o : décalage depuis le bord nord de la rue droite (0 = limite, 0,45 → 5,30 chaussée)
    // côté extérieur, trottoir à partir de notre pilier sud-est jusqu'aux clôtures du voisin (mur sud en x 19,41, plaques en z −7,66) ; côté intérieur, bordure de 1,10 réduite à 0,45
    const tC = Math.asin(K[1] / R0) / (Math.PI / 2); // droit du pilier sud-est de notre clôture (z 0) : début du trottoir
    const T = [...Array(31).keys()].map(i => i / 30).concat([...Array(16).keys()].map(i => 1 + (i + 1) / 16), Math.atan2(K[1] + 7.62, R0) / (Math.PI / 2), tC, tC + 1e-4, 0.25, 0.25 + 1e-4).sort((p, q) => p - q); // + angle des clôtures, début du trottoir extérieur
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
    // côté extérieur du virage : pas de bordure au plan au droit du point 54,79 (R3, chaussée) ; trottoir (10 cm) à partir de t = 0,25, nu du n° 6 (6,04) puis 5,74
    const tF = 0.25, oFar = t => 6.04 - 0.30 * smooth(0, 1, t);
    strip('asphalt', 0.003, t => t <= tC ? out(t) : 0.45, t => t <= tF ? oFar(t) : 5.10, 6);
    strip('curb', 0.016, out, () => 0.45, 2, T.filter(t => t > tC));
    strip('curb', 0.10, () => 5.10, oFar, 2, T.filter(t => t >= tF));
    { const TT = T.filter(t => t >= tF), P = TT.map(t => at(t, 5.10)); // face de la bordure
      for (let i = 0; i < P.length - 1; i++) { const [a, b] = [P[i], P[i + 1]], ya = hAt(a[0], a[1]), yb = hAt(b[0], b[1]), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        A.quadN('site', 'curb', [[a[0], ya + 0.003, a[1]], [b[0], yb + 0.003, b[1]], [b[0], yb + 0.10, b[1]], [a[0], ya + 0.10, a[1]]], [dz / l, 0, -dx / l]); }
      const e = [at(tF, 5.10), at(tF, oFar(tF))], ye = e.map(p => hAt(p[0], p[1])); // about nord
      A.quadN('site', 'curb', [[e[0][0], ye[0] + 0.003, e[0][1]], [e[1][0], ye[1] + 0.003, e[1][1]], [e[1][0], ye[1] + 0.10, e[1][1]], [e[0][0], ye[0] + 0.10, e[0][1]]], [-Math.sin(tF * Math.PI / 2), 0, Math.cos(tF * Math.PI / 2)]); }
  }
  // allée gravillonnée (1,00 m) du portillon à la porte d'entrée, et place de stationnement en gravillon devant le garage
  overlayQuad('site', 'gravel', [[PATH.x0, PATH.z0], [PATH.x1, PATH.z0], [PATH.x1, zWest(PATH.x1) - 0.03], [PATH.x0, zWest(PATH.x0) - 0.03]], 0.03, 4, 60); // jusqu'au trottoir (seuil du portillon)
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
  // contexte : haies et arbres en face (voisins, murs sur rue, arbres du voisin est, lampadaires : rue.ts)
  tree(-8, 20.5, 1.3); tree(9, 24.0, 1.2); tree(30.5, 3.5, 1.4); tree(31, -12, 1.5);
  hedge(-60, 4.6, 6.4, 1.7); hedge(1.0, 12.5, 0, 1.8); // au sud de la rue, à l'ouest du virage
  // PAC : unité extérieure sur le pignon nord, devant le WC (plan RDC « Ext. Mod. »)
  // (dessinée dans equip.ts, centrée sous la fenêtre du WC)
  // appliques extérieures (façades PCMI 5 et plan électrique RDC) : de part et d'autre de la baie ouest, au-dessus du garage : interieur/electricite.ts
  // (celle de l'entrée est remplacée par le spot de l'auvent ci-dessus)
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
  // table de jardin pour 6 sous la pergola : mobilier.ts (calque pergola)
  buildFences();
}

export function tree(x, z, s) {
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
export function hedge(a0, a1, off, h) {
  const r = rng(Math.floor(a0 * 10 + 7));
  if (off === 6.4) { // rue ouest, côté opposé
    for (let x = a0; x < a1; x += 2.2) { if (r() < 0.12) continue; const x1 = x + 2.0 + r() * 0.2, z = zWest(x) + off + 0.6, y = hAt(x, z); const hh = h * (0.85 + r() * 0.3); A.box('site', x, x1, y - 0.1, y + hh, z, z + 0.9 + r() * 0.3, 'hedge'); }
  } else { // rue sud, côté opposé
    for (let z = a0; z < a1; z += 2.2) { if (r() < 0.12) continue; const x = xSouth(z) + 6.4 + 0.6, y = hAt(x, z); const hh = h * (0.85 + r() * 0.3); A.box('site', x, x + 0.9 + r() * 0.3, y - 0.1, y + hh, z, z + 2.0 + r() * 0.2, 'hedge'); }
  }
}
