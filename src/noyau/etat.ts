// État partagé de la maquette : calques de la scène, ouvrants cliquables, points d'accroche des modules, réglages du panneau
import type * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Door, Groups, Hooks, State } from '../types';

// ---------------------------------------------------------------- scène
export const groups: Groups = {};
export const LAYERS = ['site', 'pergola', 'fence', 'skinU', 'skinR', 'rdc', 'furn0', 'slab1', 'r1', 'furn1', 'ceil1', 'roof', 'volets0', 'volets1'];
export const roomLights: THREE.PointLight[] = []; // lampes des pièces (créées par initEclairage, soleil.ts)
// points d'accroche des modules (env.ts, equip.ts, nav.ts) : pre/post autour de controls.update(), render remplace le rendu par défaut
export const hooks: Hooks = { pre: [], post: [], render: null };
export const DOORS: Door[] = []; // éléments ouvrants cliquables : { g (groupe pivot), meshes, open, target, speed?, apply?(open) } ; sans apply : rotation d'une porte battante
export const state: State = { mode: 'ext', roof: true, furn: true, fence: true, pergola: true, volets: false, ao: true, month: 6, hour: 16.5, sunSpeed: 0, envI: 0.07, lampI: 7, inside: false };
export const labels: { rdc: CSS2DObject[]; r1: CSS2DObject[] } = { rdc: [], r1: [] };
