// Rendu : moteur WebGL, caméra et commandes d'orbite, occlusion ambiante, rendu à la demande
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { MAX_ANISO } from './textures';
import { hooks, state, roomLights } from './etat';
import { labelRenderer, labelScene } from '../interface/etiquettes';

export let renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls,
  composer: EffectComposer | null, gtao: GTAOPass | null;
// [perf] rendu à la demande : rien n'est dessiné tant que la caméra est immobile et que rien ne change. En mouvement (orbite, balade,
// animation de vue, porte, curseur de l'heure…) : résolution réduite et sans occlusion ambiante ; puis une image pleine qualité à l'arrêt.
// Les modules qui modifient la scène hors des fonctions du socle (noyau/, maison/, terrain/, interface/) appellent ctx.requestRender() (sinon toute action dans le panneau redessine).
// Sous Playwright (navigator.webdriver), pas d'images allégées : les captures d'essai restent identiques.
export const PERF = { adaptive: !navigator.webdriver, fastDpr: 1, settle: 220, eps: 1e-6 };
export let fast = false;
let dirty = true, shadowDirty = true, hqPending = false, lastActive = 0, activeRun = 0;
const camSig = new Float64Array(32);
export function requestRender(shadows = true) { dirty = true; if (shadows) shadowDirty = true; }
export const hqDpr = () => Math.min(window.devicePixelRatio || 1, 2);
export function setDpr(v) { if (renderer.getPixelRatio() !== v) renderer.setPixelRatio(v); }
export function saveCam() { camera.updateMatrixWorld(); camSig.set(camera.matrixWorld.elements, 0); camSig.set(camera.projectionMatrix.elements, 16); }
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
// carte d'ombre du soleil à recalculer à la prochaine image (soleil animé, ouvrant qui bouge), sans forcer un nouveau rendu
export function markShadowDirty() { shadowDirty = true; }
export function setFast(v: boolean) { fast = v; }
// [perf] variante d'éclairage intérieur compilée en tâche de fond après le chargement (évite l'à-coup à la première entrée dans la maison) ;
// seulement si le navigateur compile en parallèle, sinon la compilation bloquerait la page au hasard : elle se fera à la première entrée, comme avant
export function precompileInterior() {
  if (!renderer.compileAsync || !renderer.extensions.has('KHR_parallel_shader_compile')) return; const vis = roomLights.map(l => l.visible);
  let p; try { roomLights.forEach(l => { l.visible = true; }); p = renderer.compileAsync(scene, camera); } catch (e) { p = null; } finally { roomLights.forEach((l, i) => { l.visible = vis[i]; }); }
  if (p) p.then(() => requestRender(false), () => {});
}

export function initRendu(canvas: HTMLCanvasElement) {
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
}

// post-traitement : occlusion ambiante
export function initPostTraitement() {
  try {
    // cible lissée MSAA 4× (comme le composeur panoramique de nav.ts) : sans elle, les vues intérieures avec occlusion ambiante n'étaient pas lissées et les filets fins (jeux de 3 mm des portes, chants, montants) scintillaient au moindre mouvement
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 2, 2);
    gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao); composer.addPass(new OutputPass());
  } catch (err) { console.warn('AO indisponible', err); composer = null; }
}

export function resize() {
  const st = document.getElementById('stage'); const w = st.clientWidth, h = st.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  labelRenderer.setSize(w, h); if (composer) { composer.setPixelRatio(hqDpr()); composer.setSize(w, h); } // [perf] l'occlusion ambiante reste en pleine résolution
  requestRender();
}

// [perf] rendu à la demande (voir PERF) : changement ponctuel → pleine qualité tout de suite ; mouvement continu → images allégées,
// puis une image pleine qualité après PERF.settle ms d'immobilité ; rien du tout au repos
export function renderIfNeeded(now: number, active: boolean) {
  const moved = cameraMoved();
  if (moved || active || dirty) { const hq = !PERF.adaptive || (!moved && !active && activeRun === 0); activeRun++; lastActive = now; draw(now, hq); }
  else { activeRun = 0; if (hqPending && now - lastActive > (controls.state === -1 ? PERF.settle : 1000)) draw(now, true); } // bouton encore enfoncé : on attend un peu plus
}
