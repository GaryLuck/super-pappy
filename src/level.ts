import * as THREE from 'three';

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

type Axis = 'x' | 'y' | 'z';
type Surface = 'grass' | 'stone' | 'crate' | 'sand' | 'bark';

interface MoveSpec {
  axis: Axis;
  range: number;
  speed: number;
}

interface PlatformDef {
  x: number;
  /** Height of the walkable top surface. */
  top: number;
  z: number;
  w: number;
  d: number;
  /** Thickness; defaults to 1. */
  h?: number;
  surface?: Surface;
  move?: MoveSpec;
}

export interface EnemyDef {
  x: number;
  z: number;
  top: number;
  axis: 'x' | 'z';
  range: number;
}

export interface StarDef {
  pos: [number, number, number];
  scale?: number;
}

// Box face order is +x, -x, +y, -y, +z, -z; only +y gets the "top" colour.
function faces(top: number, side: number): THREE.Material[] {
  const topMat = new THREE.MeshStandardMaterial({ color: top, roughness: 0.9, flatShading: true });
  const sideMat = new THREE.MeshStandardMaterial({ color: side, roughness: 0.95, flatShading: true });
  return [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
}

const SURFACES: Record<Surface, THREE.Material[]> = {
  grass: faces(0x6cc24a, 0x8b5a2b),
  stone: faces(0xc9cdd2, 0x8e949b),
  crate: faces(0xd9a050, 0xb57a33),
  sand: faces(0xf2d98d, 0xcfa95e),
  bark: faces(0x7a4a24, 0x7a4a24),
};

export class Platform {
  readonly mesh: THREE.Mesh;
  readonly box: Box = { min: new THREE.Vector3(), max: new THREE.Vector3() };
  /** How far the platform moved in its last update; anything standing on it is carried along. */
  readonly delta = new THREE.Vector3();
  private readonly home: THREE.Vector3;
  private readonly half: THREE.Vector3;
  private readonly move?: MoveSpec;

  constructor(def: PlatformDef) {
    const h = def.h ?? 1;
    this.home = new THREE.Vector3(def.x, def.top - h / 2, def.z);
    this.half = new THREE.Vector3(def.w / 2, h / 2, def.d / 2);
    this.move = def.move;
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, h, def.d), SURFACES[def.surface ?? 'grass']);
    this.mesh.position.copy(this.home);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.syncBox();
  }

  get moving(): boolean {
    return this.move !== undefined;
  }

  update(time: number): void {
    if (!this.move) return;
    const next = this.home.clone();
    next[this.move.axis] += Math.sin(time * this.move.speed) * this.move.range;
    this.delta.subVectors(next, this.mesh.position);
    this.mesh.position.copy(next);
    this.syncBox();
  }

  private syncBox(): void {
    this.box.min.subVectors(this.mesh.position, this.half);
    this.box.max.addVectors(this.mesh.position, this.half);
  }
}

// ---------------------------------------------------------------------------
// Sky Island layout. A spiral of floating platforms climbs around the island
// to the tower in the middle, where the big star waits.

const PLATFORMS: PlatformDef[] = [
  // The island itself
  { x: 0, top: 0, z: 0, w: 30, d: 30, h: 4 },
  // Crates
  { x: -7, top: 1.5, z: 7, w: 2, d: 2, h: 1.5, surface: 'crate' },
  { x: -9.5, top: 3, z: 9.5, w: 2, d: 2, h: 3, surface: 'crate' },
  // The tower, with the big star on top
  { x: 0, top: 19, z: 3, w: 5, d: 5, h: 21, surface: 'stone' },
  // The spiral
  { x: 18, top: 1, z: 0, w: 5, d: 5 },
  { x: 22, top: 2.5, z: -6, w: 4, d: 4 },
  { x: 20, top: 4, z: -12, w: 4, d: 4 },
  { x: 14, top: 5.5, z: -18, w: 5, d: 5 },
  { x: 6, top: 7, z: -20, w: 4, d: 4, surface: 'stone', move: { axis: 'x', range: 3, speed: 0.9 } },
  { x: -2, top: 8.5, z: -20, w: 4, d: 4 },
  { x: -8, top: 10, z: -18, w: 5, d: 5 },
  { x: -14, top: 11.5, z: -12, w: 4, d: 4 },
  { x: -18, top: 13, z: -5, w: 4, d: 4, surface: 'stone', move: { axis: 'z', range: 3, speed: 0.8 } },
  { x: -18, top: 14.5, z: 3, w: 4, d: 4 },
  { x: -12, top: 16, z: 8, w: 5, d: 5 },
  { x: -5, top: 17.5, z: 10, w: 4, d: 4 },
  // Stepping stones across the lagoon
  { x: 0, top: 0.3, z: 19, w: 3, d: 3, h: 3.3, surface: 'sand' },
  { x: 4, top: 0.8, z: 23, w: 3, d: 3, h: 3.8, surface: 'sand' },
  { x: -1, top: 1.3, z: 27, w: 3, d: 3, h: 4.3, surface: 'sand' },
  { x: -6, top: 1.8, z: 24, w: 3, d: 3, h: 4.8, surface: 'sand' },
];

const TREES: [number, number][] = [
  [-11, -3],
  [-12, 3],
  [11, 9],
  [12, 12],
  [-3, -11],
  [4, -12],
  [-12, 12.5],
];

export const STARS: StarDef[] = [
  // Around the island
  { pos: [8, 1.2, 8] },
  { pos: [-9.5, 4.2, 9.5] },
  { pos: [10, 1.2, -9] },
  { pos: [-11, 1.2, -10] },
  // Up the spiral
  { pos: [18, 2.2, 0] },
  { pos: [22, 3.7, -6] },
  { pos: [20, 5.2, -12] },
  { pos: [14, 6.7, -18] },
  { pos: [6, 9.6, -20] },
  { pos: [-2, 9.7, -20] },
  { pos: [-8, 11.2, -18] },
  { pos: [-14, 12.7, -12] },
  { pos: [-18, 15.6, -5] },
  { pos: [-18, 15.7, 3] },
  { pos: [-12, 17.2, 8] },
  { pos: [-5, 18.7, 10] },
  // Across the lagoon
  { pos: [4, 2, 23] },
  { pos: [-1, 2.5, 27] },
  { pos: [-6, 3, 24] },
  // The big one
  { pos: [0, 20.8, 3], scale: 1.8 },
];

export const ENEMIES: EnemyDef[] = [
  { x: 5, z: -5, top: 0, axis: 'x', range: 4 },
  { x: -6, z: -2, top: 0, axis: 'z', range: 4 },
  { x: 7, z: 10, top: 0, axis: 'x', range: 3 },
  { x: 14, z: -18, top: 5.5, axis: 'x', range: 1.5 },
  { x: -8, z: -18, top: 10, axis: 'z', range: 1.5 },
  { x: -12, z: 8, top: 16, axis: 'x', range: 1.5 },
];

export const SPAWNS = {
  pappy: new THREE.Vector3(9, 0, -2.5),
  ethan: new THREE.Vector3(9, 0, 0),
};

/** Anything below this height has fallen into the lagoon. */
export const FALL_LIMIT = -4;

export class Level {
  readonly group = new THREE.Group();
  readonly platforms: Platform[] = [];
  private readonly water: THREE.Mesh;
  private readonly clouds: THREE.Group[] = [];

  constructor() {
    for (const def of PLATFORMS) this.addPlatform(def);
    for (const [x, z] of TREES) this.addTree(x, z);
    this.addFlowers();

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({
        color: 0x2f9be0,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -2.5;
    this.water.receiveShadow = true;
    this.group.add(this.water);

    for (let i = 0; i < 9; i++) this.addCloud(i);
  }

  updatePlatforms(time: number): void {
    for (const p of this.platforms) p.update(time);
  }

  animate(dt: number, time: number): void {
    this.water.position.y = -2.5 + Math.sin(time * 0.8) * 0.06;
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.8;
      if (cloud.position.x > 90) cloud.position.x = -90;
    }
  }

  private addPlatform(def: PlatformDef): Platform {
    const p = new Platform(def);
    this.platforms.push(p);
    this.group.add(p.mesh);
    return p;
  }

  private addTree(x: number, z: number): void {
    // The trunk is solid; the leaves are just for looks.
    this.addPlatform({ x, top: 2.2, z, w: 0.6, d: 0.6, h: 2.2, surface: 'bark' });
    const leaves = new THREE.MeshStandardMaterial({ color: 0x2e8b3a, roughness: 0.8, flatShading: true });
    for (const [y, r, h] of [
      [2.6, 1.6, 2.2],
      [3.8, 1.2, 1.8],
    ] as const) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), leaves);
      cone.position.set(x, y, z);
      cone.castShadow = true;
      this.group.add(cone);
    }
  }

  private addFlowers(): void {
    const colors = [0xff5d8f, 0xffd23f, 0xffffff, 0xa66bff];
    const geo = new THREE.SphereGeometry(0.12, 6, 4);
    const rand = mulberry32(7);
    for (let i = 0; i < 60; i++) {
      const x = (rand() - 0.5) * 28;
      const z = (rand() - 0.5) * 28;
      if (Math.abs(x) < 3.5 && z > -0.5 && z < 6.5) continue; // not inside the tower
      const flower = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i % colors.length] }));
      flower.position.set(x, 0.12, z);
      this.group.add(flower);
    }
  }

  private addCloud(seed: number): void {
    const rand = mulberry32(seed + 100);
    const cloud = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + rand() * 1.5, 1), mat);
      puff.position.set(i * 1.8 - 3.6, rand() * 0.8, (rand() - 0.5) * 2);
      cloud.add(puff);
    }
    cloud.position.set((rand() - 0.5) * 180, 26 + rand() * 12, (rand() - 0.5) * 120);
    this.clouds.push(cloud);
    this.group.add(cloud);
  }
}

/** Small seeded random number generator, so the scenery is the same every time. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
