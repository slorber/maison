// Types partagés : contexte passé aux modules (Ctx), ouvrants, vues, état du panneau
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import type { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Acc, mergeStatic, sbox, wall } from './noyau/geometrie';
import type { makeTex, pixelNoise } from './noyau/textures';
import type { std } from './noyau/materiaux';
import type { rng, clamp, smooth, lerp2 } from './noyau/outils';
import type { H, OPEN, FACE } from './maison/plan';
import type { LB } from './maison/facades';
import type { hipRoof } from './maison/toiture';
import type { hAt, zWest, xSouth, BND, RUE } from './terrain/relief';
import type { tree, hedge } from './terrain/abords';

/** Calques de la scène, par nom (site, rdc, r1, furn0…, et un groupe par vantail de menuiserie : ouvW0_0…) */
export type Groups = Record<string, THREE.Group>;
/** Matériaux partagés, par nom (M.enduit, M.alu…) */
export type Materials = Record<string, THREE.MeshStandardMaterial>;
/** Textures dessinées sur canvas, par nom */
export type Textures = Record<string, THREE.CanvasTexture>;
export type Vec3 = [number, number, number];

/** Élément ouvrant cliquable : porte battante (rotation de g), ou mouvement quelconque donné par apply(open) */
export interface Door {
  g: THREE.Object3D;
  meshes: THREE.Object3D[];
  /** ouverture courante et visée, de 0 (fermé) à 1 (ouvert) */
  open: number;
  target: number;
  /** vitesse en ouverture par seconde (1,6 par défaut) */
  speed?: number;
  /** placard, portail, portillon, win, baie… : la balade n'ouvre d'elle-même que les portes sans kind */
  kind?: string;
  apply?: (open: number) => void;
  /** portail coulissant : emprise de toute la course, obstacle dynamique de la balade (nav.ts) */
  _navC?: { x: number; y: number; z: number; r: number };
  [extra: string]: unknown;
}

/** Points d'accroche des modules : avant / après controls.update(), et rendu de remplacement (optique panoramique) */
export interface Hooks {
  pre: ((now: number) => void)[];
  post: ((now: number) => void)[];
  render: ((now: number) => void) | null;
}

/** Réglages du panneau et situation de la caméra */
export interface State {
  /** ext : maquette entière ; rdc, r1 : maison ouverte à ce niveau */
  mode: string;
  roof: boolean;
  furn: boolean;
  fence: boolean;
  pergola: boolean;
  volets: boolean;
  ao: boolean;
  month: number;
  hour: number;
  sunSpeed: number;
  envI: number;
  lampI: number;
  /** caméra dans la maison (éclairage intérieur) */
  inside: boolean;
  lastView?: string;
}

/** Vue prédéfinie : position de la caméra p, point visé t */
export interface View {
  p: Vec3;
  t: Vec3;
  mode: string;
  inside?: number;
}

/** Contexte passé aux modules de construction et d'interface (créé par ctx() dans main.ts) */
export interface Ctx {
  A: Acc;
  M: Materials;
  TEX: Textures;
  groups: Groups;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  readonly composer: EffectComposer | null;
  readonly gtao: GTAOPass | null;
  labelRenderer: CSS2DRenderer;
  state: State;
  VIEWS: Record<string, View>;
  setView: (key: string, instant?: boolean) => void;
  applyVisibility: () => void;
  applyLighting: () => void;
  updateSun: (deferEnv?: boolean) => void;
  hooks: Hooks;
  DOORS: Door[];
  roomLights: THREE.PointLight[];
  labels: { rdc: CSS2DObject[]; r1: CSS2DObject[] };
  requestRender: (shadows?: boolean) => void;
  mergeStatic: typeof mergeStatic;
  readonly fast: boolean;
  hAt: typeof hAt;
  zWest: typeof zWest;
  xSouth: typeof xSouth;
  BND: typeof BND;
  RUE: typeof RUE;
  L: number;
  D: number;
  T: number;
  SH: number;
  H: typeof H;
  E1: number;
  std: typeof std;
  makeTex: typeof makeTex;
  pixelNoise: typeof pixelNoise;
  rng: typeof rng;
  clamp: typeof clamp;
  smooth: typeof smooth;
  lerp2: typeof lerp2;
  sbox: typeof sbox;
  hipRoof: typeof hipRoof;
  tree: typeof tree;
  hedge: typeof hedge;
  wall: typeof wall;
  LB: typeof LB;
  OPEN: typeof OPEN;
  FACE: typeof FACE;
}

// Parcours de la scène (traverse) : three.js teste o.isMesh puis lit o.geometry et o.material ; ces champs, déclarés par Mesh,
// Points, Line…, sont rendus visibles (facultatifs) sur Object3D pour que ces parcours se typent sans conversion à chaque ligne
declare module 'three' {
  interface Object3D {
    isMesh?: boolean;
    isGroup?: boolean;
    isInstancedMesh?: boolean;
    isSkinnedMesh?: boolean;
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
  }
}

// état interne d'OrbitControls lu par la boucle de rendu (arrêt de l'inertie, attente de fin de geste) : absent des types publics
declare module 'three/examples/jsm/controls/OrbitControls.js' {
  interface OrbitControls {
    /** -1 au repos (aucun bouton ni doigt appuyé) */
    state: number;
    _sphericalDelta: THREE.Spherical;
    _panOffset: THREE.Vector3;
  }
}

declare global {
  interface Window {
    /** accès pour les essais (scripts de rendu) : interface/panneau.ts */
    __maquette: any;
    /** accès pour les essais de la visite : interface/nav.ts */
    __nav: any;
    /** visionneuse claude.ai (capacités de l'Artifact) */
    claude?: any;
  }
}
