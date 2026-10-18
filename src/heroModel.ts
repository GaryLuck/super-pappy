import * as THREE from 'three';

export type HeroKind = 'pappy' | 'ethan';

export interface HeroLook {
  name: string;
  /** CSS colour for the HUD. */
  css: string;
  suit: number;
  cape: number;
  trim: number;
  skin: number;
  hair: number;
  letter: string;
  /** Standing height in world units. */
  height: number;
  /** Ethan is a kid, so he gets a bigger head for his size. */
  headScale: number;
}

export const LOOKS: Record<HeroKind, HeroLook> = {
  pappy: {
    name: 'Super Pappy',
    css: '#4f8cff',
    suit: 0x2f6fde,
    cape: 0xd8262e,
    trim: 0xffd23f,
    skin: 0xf1c27d,
    hair: 0xf4f4f4,
    letter: 'P',
    height: 1.8,
    headScale: 1,
  },
  ethan: {
    name: 'Super Ethan',
    css: '#ff5a4f',
    suit: 0xe0322f,
    cape: 0xffb703,
    trim: 0x2f6fde,
    skin: 0xffd7a8,
    hair: 0x6b3e1f,
    letter: 'E',
    height: 1.4,
    headScale: 1.3,
  },
};

export interface HeroRig {
  /** Sits at the hero's feet. */
  root: THREE.Group;
  /** Pivots around the hero's middle, for the flying pose. */
  tilt: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  cape: THREE.Object3D;
}

// The model is built 1.8 units tall, then scaled to the hero's height.
const BASE_HEIGHT = 1.8;

export function buildHero(kind: HeroKind): HeroRig {
  const look = LOOKS[kind];
  const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const suit = mat(look.suit);
  const capeMat = mat(look.cape);
  const skin = mat(look.skin);
  const dark = mat(0x1b1b22);

  const root = new THREE.Group();
  root.scale.setScalar(look.height / BASE_HEIGHT);
  const tilt = new THREE.Group();
  tilt.position.y = BASE_HEIGHT / 2;
  root.add(tilt);
  const body = new THREE.Group();
  body.position.y = -BASE_HEIGHT / 2;
  tilt.add(body);

  const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.72, 0);
    const leg = box(0.22, 0.6, 0.24, suit);
    leg.position.y = -0.3;
    const boot = box(0.25, 0.2, 0.32, capeMat);
    boot.position.set(0, -0.62, 0.03);
    pivot.add(leg, boot);
    body.add(pivot);
    return pivot;
  };
  const legL = makeLeg(0.13);
  const legR = makeLeg(-0.13);

  const torso = box(0.62, 0.66, 0.36, suit);
  torso.position.y = 1.04;
  const belt = box(0.64, 0.08, 0.38, mat(look.trim));
  belt.position.y = 0.76;
  const emblem = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.36),
    new THREE.MeshStandardMaterial({ map: emblemTexture(look.letter), transparent: true, roughness: 0.4 }),
  );
  emblem.position.set(0, 1.1, 0.181);
  body.add(torso, belt, emblem);

  const makeArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.32, 0);
    const arm = box(0.18, 0.56, 0.2, suit);
    arm.position.y = -0.26;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skin);
    hand.position.y = -0.6;
    pivot.add(arm, hand);
    body.add(pivot);
    return pivot;
  };
  const armL = makeArm(0.42);
  const armR = makeArm(-0.42);

  const head = new THREE.Group();
  head.position.y = 1.62;
  head.scale.setScalar(look.headScale);
  body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), skin));
  for (const x of [0.09, -0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), dark);
    eye.position.set(x, 0.03, 0.245);
    head.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin);
  nose.position.set(0, -0.03, 0.27);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), dark);
  smile.position.set(0, -0.1, 0.235);
  smile.rotation.z = Math.PI;
  head.add(nose, smile);

  const hair = mat(look.hair);
  if (kind === 'pappy') {
    // A ring of white hair around a bald top, bushy brows, a mustache and glasses.
    const ring = new THREE.Mesh(
      new THREE.SphereGeometry(0.285, 20, 8, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 0.3, Math.PI * 0.3),
      hair,
    );
    const mustache = box(0.22, 0.06, 0.06, hair);
    mustache.position.set(0, -0.075, 0.26);
    head.add(ring, mustache);
    for (const x of [0.1, -0.1]) {
      const brow = box(0.1, 0.035, 0.04, hair);
      brow.position.set(x, 0.12, 0.245);
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 6, 16), dark);
      lens.position.set(x, 0.03, 0.265);
      head.add(brow, lens);
    }
    const bridge = box(0.06, 0.014, 0.014, dark);
    bridge.position.set(0, 0.04, 0.27);
    head.add(bridge);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hair);
    cap.rotation.x = -0.35;
    const fringe = box(0.3, 0.07, 0.08, hair);
    fringe.position.set(0.03, 0.19, 0.2);
    fringe.rotation.z = -0.15;
    head.add(cap, fringe);
  }

  const cape = new THREE.Group();
  cape.position.set(0, 1.36, -0.2);
  const capeMesh = box(0.62, 1.0, 0.03, capeMat);
  capeMesh.position.y = -0.5;
  cape.add(capeMesh);
  body.add(cape);

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, tilt, legL, legR, armL, armR, cape };
}

/** A gold shield with the hero's letter, drawn on a canvas. */
function emblemTexture(letter: string): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.beginPath();
  g.moveTo(64, 6);
  g.lineTo(122, 40);
  g.lineTo(64, 122);
  g.lineTo(6, 40);
  g.closePath();
  g.fillStyle = '#ffd23f';
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#7a1010';
  g.stroke();
  g.fillStyle = '#c4161c';
  g.font = 'bold 64px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 58);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
