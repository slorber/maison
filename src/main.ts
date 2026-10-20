// Maquette 3D V2 — maison Lorber / Vaz, rue des Merlettes, Deuil-la-Barre
// Sources : plans travaux v3 (22/09/2026, vectoriel), notice signée (15/12/2025), avenant 1 (08/07/2026),
// plan de masse PCMI 2, principe de clôture PCMI 5 et façades PCMI 5, plan de bornage altimétrique.
// Repère : X = longueur 12,90 m (du nord vers le sud), Z = profondeur 7,90 m (de l'est vers l'ouest), Y = hauteur.
// Origine = angle nord-est extérieur de la maison (mur en limite de propriété). RDC fini = 0,00 (NGF 55,70).
// Point d'entrée : assemble la scène (textures, matériaux, maison, terrain, intérieur), branche le panneau et la visite, lance la boucle de rendu.
import * as THREE from 'three';
import { buildTextures, TEX, makeTex, pixelNoise } from './noyau/textures';
import { buildMaterials, M, std } from './noyau/materiaux';
import { A, mergeStatic, sbox, wall } from './noyau/geometrie';
import { rng, clamp, smooth, lerp2 } from './noyau/outils';
import { groups, LAYERS, hooks, DOORS, roomLights, labels, state } from './noyau/etat';
import { renderer, scene, camera, controls, composer, gtao, fast, requestRender, markShadowDirty, saveCam, precompileInterior,
  initRendu, initPostTraitement, resize, renderIfNeeded } from './noyau/rendu';
import { initEclairage, updateSun, animateSun, applyLighting } from './noyau/soleil';
import { H, L, D, T, SH, E1, OPEN, FACE } from './maison/plan';
import { LB, buildShell } from './maison/facades';
import { buildInterior, buildFurniture, animateDoors } from './maison/cloisons';
import { hipRoof, buildRoof } from './maison/toiture';
import { buildEquipment } from './maison/equip';
import { buildOuvrants, initOuvrants } from './maison/ouvrants';
import { hAt, zWest, xSouth, BND, RUE } from './terrain/relief';
import { buildSite, tree, hedge } from './terrain/abords';
import { buildEnvironment } from './terrain/env';
import { buildRue } from './terrain/rue';
import { buildBains } from './interieur/bains';
import { buildMobilier } from './interieur/mobilier';
import { buildSousEscalier } from './interieur/sousEscalier';
import { buildChambre1 } from './interieur/chambre1';
import { buildVoiture } from './interieur/voiture';
import { buildPrises } from './interieur/prises';
import { labelRenderer, initEtiquettes } from './interface/etiquettes';
import { VIEWS, setView, applyVisibility, animateView } from './interface/vues';
import { bindUI } from './interface/panneau';
import { initNav } from './interface/nav';
import type { Ctx } from './types';

// contexte passé aux modules de construction et d'interface (voir Ctx dans types.ts)
function ctx(): Ctx {
  return { A, M, TEX, groups, scene, camera, controls, renderer, get composer() { return composer; }, get gtao() { return gtao; }, labelRenderer,
    state, VIEWS, setView, applyVisibility, applyLighting, updateSun, hooks, DOORS, roomLights, labels, requestRender, mergeStatic, get fast() { return fast; },
    hAt, zWest, xSouth, BND, RUE, L, D, T, SH, H, E1, std, makeTex, pixelNoise, rng, clamp, smooth, lerp2, sbox, hipRoof, tree, hedge, wall, LB, OPEN, FACE };
}

function init() {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  initRendu(canvas);

  buildTextures(); buildMaterials();
  for (const l of LAYERS) { groups[l] = new THREE.Group(); groups[l].name = l; scene.add(groups[l]); }
  buildShell(); buildInterior(); buildRoof(); buildFurniture(); buildSite();
  buildEquipment(ctx()); buildEnvironment(ctx()); buildRue(ctx()); buildBains(ctx()); buildMobilier(ctx()); buildChambre1(ctx()); buildVoiture(ctx()); buildSousEscalier(ctx()); buildPrises(ctx()); buildOuvrants(ctx());
  A.build(groups);

  initEclairage(); // ciel, soleil, ambiance, lampes des pièces
  initEtiquettes(); // étiquettes des pièces
  initPostTraitement(); // occlusion ambiante
  if (matchMedia('(max-width: 700px)').matches) { state.ao = false; (document.getElementById('t-ao') as HTMLInputElement).checked = false; }

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

let tickLast: number; // instant de l'image précédente
function tick(now: number) {
  const dt0 = (now - (tickLast ?? now)) / 1000, dt = Math.min(0.05, dt0); tickLast = now;
  let active = animateDoors(dt); if (active) markShadowDirty(); // un ouvrant qui bouge change les ombres
  if (animateSun(Math.min(dt0, 0.25))) active = true; // soleil animé (temps réel : 10 s par jour même à moins de 20 images/s) : images allégées en continu, image pleine qualité à l'arrêt
  if (animateView(now)) active = true; // caméra en route vers une vue (interface/vues.ts)
  for (const f of hooks.pre) f(now);
  controls.update();
  // [perf] fin de l'inertie de l'orbite : quand ce qu'il reste à parcourir devient invisible (< 0,5 px), on l'arrête net pour passer plus tôt à l'image pleine qualité
  const sd = controls._sphericalDelta, po = controls._panOffset;
  if (sd && po && controls.state === -1 && Math.abs(sd.theta) < 2e-4 && Math.abs(sd.phi) < 2e-4 && po.lengthSq() < (2e-4 * camera.position.distanceTo(controls.target)) ** 2) { sd.set(0, 0, 0); po.set(0, 0, 0); }
  for (const f of hooks.post) f(now);
  renderIfNeeded(now, active); // rendu à la demande (noyau/rendu.ts)
}

init();
