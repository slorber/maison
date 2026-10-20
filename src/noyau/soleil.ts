// Soleil et éclairage : ciel, soleil selon le mois et l'heure, ambiance, lampes des pièces, carte d'environnement, animation sur 24 h
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { clamp } from './outils';
import { M } from './materiaux';
import { H } from '../maison/plan';
import { state, roomLights } from './etat';
import { renderer, scene, gtao, requestRender, markShadowDirty } from './rendu';

export let sun: THREE.DirectionalLight;
let hemi: THREE.HemisphereLight, sky: Sky, pmrem: THREE.PMREMGenerator, envRT: THREE.WebGLRenderTarget, amb: THREE.AmbientLight;

export function initEclairage() {
  sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 5; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.8;
  pmrem = new THREE.PMREMGenerator(renderer);
  sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 170;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03; sun.target.position.set(4, 0, 6); scene.add(sun); scene.add(sun.target);
  hemi = new THREE.HemisphereLight(0xe4ebf2, 0xa19f99, 0.35); scene.add(hemi);
  scene.fog = new THREE.Fog(0xcfd8de, 60, 200);
  amb = new THREE.AmbientLight(0xf6f7fa, 0); scene.add(amb);
  for (const [lv, x, z] of [[0, 6.5, 5.6], [0, 10.5, 5.6], [0, 1.95, 5.45], [0, 3.33, 6.85], [0, 3.0, 2.0], [0, 9.0, 1.8], [1, 1.9, 1.7], [1, 10.5, 2.2], [1, 6.5, 3.67], [1, 2.7, 5.9], [1, 6.6, 5.9], [1, 10.4, 5.9]]) {
    const pl = new THREE.PointLight(0xfff2e4, 0, 9, 2); pl.position.set(x, lv ? H.r1Ceil - 0.35 : H.rdcCeil - 0.35, z); pl.userData.lv = lv; scene.add(pl); roomLights.push(pl);
  }
}

// position du soleil (lat. 48,97° N, long. 2,33° E), heure légale
function sunDir(month, hour) {
  const N = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1];
  const dst = month >= 4 && month <= 10 ? 2 : 1;
  const solar = hour - dst + 2.33 / 15;
  const rad = Math.PI / 180, lat = 48.97 * rad;
  const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (N + 10)) * rad;
  const Hh = (solar - 12) * 15 * rad;
  const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(Hh));
  const az = Math.atan2(Math.sin(Hh), Math.cos(Hh) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) + Math.PI;
  return { el, az, v: new THREE.Vector3(-Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el)) };
}
let envTimer = null;
export function updateSun(deferEnv?: boolean) {
  placeSun(); applyLighting();
  clearTimeout(envTimer); envTimer = setTimeout(updateEnv, deferEnv ? 250 : 0);
}
// [perf] partie légère de updateSun (uniformes et intensités seulement), appelée à chaque image pendant l'animation du soleil
function placeSun() {
  const { el, az, v } = sunDir(state.month, state.hour);
  const elc = Math.max(el, -0.05);
  const d = new THREE.Vector3(v.x, Math.sin(elc), v.z).normalize();
  sky.material.uniforms.sunPosition.value.copy(d);
  sun.position.copy(sun.target.position).addScaledVector(d, 80);
  const k = clamp(Math.sin(elc) * 3, 0, 1);
  sun.intensity = 5 * k; sun.color.setHSL(0.09, 0.6 * (1 - k) + 0.1, 0.55 + 0.4 * k);
  hemi.intensity = 0.15 + 0.45 * clamp(Math.sin(elc) * 4 + 0.3, 0, 1);
  renderer.toneMappingExposure = (0.62 + 0.36 * clamp(Math.sin(elc) * 4 + 0.2, 0, 1)) * (state.inside ? 0.92 : 1);
  // soleil sous l'horizon : brume du lointain amenée au bleu nuit de l'horizon du ciel (sinon bande claire sous le ciel noir, la nuit) ; de jour, inchangée
  const nt = clamp(1 + elc / 0.05, 0, 1); scene.fog.color.setHSL(0.58 + 0.077 * (1 - nt), 0.18 + 0.476 * (1 - nt), (0.55 + 0.25 * k) * (0.0144 + 0.9856 * nt ** 2.4));
  const e = document.getElementById('sun-info');
  if (e) { const a = az * 180 / Math.PI, t = `hauteur ${Math.round(el * 180 / Math.PI)}°, azimut ${Math.round(a)}° (${cardinal(a)})`; if (e.textContent !== t) e.textContent = t; }
  return { el, d, k };
}
// animation du soleil (curseur « Animation ») : une journée de 24 h en 10 s à la vitesse 1, en 10 s / v en dessous, sur le mois choisi ;
// l'heure repart de 0 h après 23 h 59, le curseur de l'heure suit, et la reprend là où on la pose (animation suspendue pendant qu'on le tire)
export const SUN_DAY = 10, shD = new THREE.Vector3(); let sunHold = false, sunNight = false, showHour = null;
export function animateSun(dt) {
  if (!(state.sunSpeed > 0) || sunHold || !(dt > 0)) return false;
  state.hour = (state.hour + 24 * state.sunSpeed * dt / SUN_DAY) % 24; if (showHour) showHour();
  const { el, d, k } = placeSun();
  // [perf] carte d'ombre recalculée soleil levé seulement, dès qu'il a tourné de 0,05° (à chaque image à vitesse moyenne ou rapide, moins souvent au ralenti)
  if (k > 0 && d.dot(shD) < 0.9999996) { shD.copy(d); markShadowDirty(); }
  // ambiance (PMREM) régénérée par paliers de 2 % quand elle varie (soleil entre 0 et 20° de hauteur), pas à chaque image
  const g = envGain(el); if (Math.abs(g - envK) > 0.02 || (g !== envK && (g === 1 || g === 0.55))) { clearTimeout(envTimer); updateEnv(); }
  // [perf] nuit (soleil à plus de 3° sous l'horizon) : ciel, lumières et exposition figés, rien à redessiner
  const night = el <= -0.05, was = sunNight; sunNight = night; return !(night && was);
}
export function applyLighting() {
  const m = state.mode, inside = state.inside;
  for (const pl of roomLights) pl.intensity = (inside || (m === 'rdc' && pl.userData.lv === 0) || (m === 'r1' && pl.userData.lv === 1)) ? state.lampI * (pl.userData.k ?? 1) : 0;
  // [perf] vues extérieures : les lampes intérieures (toutes éteintes) sont retirées du rendu, sinon chaque pixel calcule 16 lumières nulles.
  // Deux jeux de lumières seulement (extérieur / intérieur et plans), pour ne recompiler les shaders qu'une fois (cf. precompileInterior)
  const lit = inside || m !== 'ext'; for (const pl of roomLights) pl.visible = lit;
  amb.intensity = inside ? 0.16 : (m === 'ext' ? 0 : 0.14);
  scene.environmentIntensity = envLevel();
  if (gtao) gtao.blendIntensity = inside ? 0.9 : 0.6; // dehors : occlusion adoucie, sinon les menuiseries au fond des tableaux de 20 cm noircissent
  syncRalEnv();
  requestRender();
}
const envLevel = () => state.inside ? state.envI : 0.40;
// RAL 7016 : sans lumière renvoyée par l'enduit clair (pas d'éclairage global), les menuiseries au fond des tableaux, à l'ombre, paraissaient presque noires
// à côté des garde-corps au soleil ; ambiance renforcée sur toutes les pièces 7016 pour qu'elles se lisent de la même teinte, comme en vrai
// (envMapIntensity n'agit que si la carte est posée sur le matériau : avec scene.environment seul, three.js impose environmentIntensity)
const RAL_MATS = ['alu', 'garage', 'pergola', 'soffit', 'fenceAlu', 'handle', 'grille', 'sable', 'slats', 'ral7016', 'c1Steel'];
function syncRalEnv() {
  if (!envRT) return;
  for (const k of RAL_MATS) { const m = M[k]; if (!m) continue; if (m.envMap !== envRT.texture) { m.envMap = envRT.texture; m.needsUpdate = true; } m.envMapIntensity = envLevel() * (state.inside ? 1.5 : 2.6); }
}
function cardinal(a) { return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(((a % 360) + 360) % 360 / 45) % 8]; }
const envGain = el => 0.55 + 0.45 * clamp(Math.sin(el) * 3, 0, 1);
let envScene = null, envK = -1;
function updateEnv() {
  // ambiance d'éclairage neutre (dégradé ciel gris-bleu clair / horizon / sol) plutôt que le ciel physique très bleu :
  // sans ça le gris 7016 et les façades à l'ombre virent au bleu marine
  // (scène créée une fois : seule l'intensité k change ; avant, sphère et matériau neufs à chaque appel, sphère jamais libérée)
  if (!envScene) {
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { k: { value: 1 } },
      vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float k; varying vec3 vd; void main(){ float y = vd.y; vec3 top = vec3(0.50, 0.56, 0.64), hor = vec3(0.80, 0.80, 0.78), gnd = vec3(0.30, 0.29, 0.26);' +
        ' vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor, gnd, pow(-y, 0.4)); gl_FragColor = vec4(c * k, 1.0); }' });
    envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat));
  }
  envScene.children[0].material.uniforms.k.value = envK = envGain(sunDir(state.month, state.hour).el);
  if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0, 0.1, 2000); scene.environment = envRT.texture; scene.environmentIntensity = envLevel(); syncRalEnv();
  requestRender(false);
}
// curseur de l'heure tenu (animation suspendue) ; mise à jour du curseur et du libellé de l'heure pendant l'animation (panneau.ts)
export function setSunHold(v: boolean) { sunHold = v; }
export function setShowHour(f: () => void) { showHour = f; }
