import * as THREE from 'three';
import type { EnemyDef } from './level';

export const ENEMY_RADIUS = 0.55;
export const ENEMY_HEIGHT = 1.1;

/** A grumpy purple Grumblebot that paces back and forth. Stomp it or dash through it. */
export class Enemy {
  readonly group = new THREE.Group();
  alive = true;

  private readonly body = new THREE.Group();
  private readonly home: THREE.Vector3;
  private readonly axis: 'x' | 'z';
  private readonly range: number;
  private readonly speed: number;
  private t = Math.random() * 10;
  private squash = 0;

  constructor(def: EnemyDef) {
    this.home = new THREE.Vector3(def.x, def.top, def.z);
    this.axis = def.axis;
    this.range = def.range;
    this.speed = def.range > 2 ? 1.1 : 1.6;
    this.group.position.copy(this.home);
    this.group.add(this.body);
    this.buildModel();
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  update(dt: number): void {
    if (!this.alive) {
      // Squish flat, then disappear.
      this.squash = Math.min(1, this.squash + dt * 4);
      this.body.scale.set(1 + this.squash * 0.6, Math.max(0.05, 1 - this.squash), 1 + this.squash * 0.6);
      if (this.squash >= 1) this.group.visible = false;
      return;
    }
    this.t += dt;
    const offset = Math.sin(this.t * this.speed) * this.range;
    const heading = Math.cos(this.t * this.speed); // direction of travel along the axis
    this.group.position.copy(this.home);
    this.group.position[this.axis] += offset;
    const facing = this.axis === 'x' ? (heading > 0 ? Math.PI / 2 : -Math.PI / 2) : heading > 0 ? 0 : Math.PI;
    this.group.rotation.y += angleDiff(this.group.rotation.y, facing) * Math.min(1, dt * 8);
    this.body.position.y = Math.abs(Math.sin(this.t * 9)) * 0.12;
  }

  kill(): void {
    this.alive = false;
  }

  private buildModel(): void {
    const purple = new THREE.MeshStandardMaterial({ color: 0x7b3fbf, roughness: 0.5, flatShading: true });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x3d1f66, roughness: 0.6, flatShading: true });
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const black = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(ENEMY_RADIUS, 1), purple);
    blob.position.y = ENEMY_RADIUS;
    this.body.add(blob);

    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), spikeMat);
      const a = (i / 7) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.3, ENEMY_RADIUS * 1.75, Math.sin(a) * 0.3 - 0.05);
      spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      this.body.add(spike);
    }

    for (const x of [0.18, -0.18]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), white);
      eye.position.set(x, ENEMY_RADIUS + 0.12, 0.42);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), black);
      pupil.position.set(x * 0.9, ENEMY_RADIUS + 0.1, 0.53);
      // Angry eyebrows slant down toward the middle.
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), black);
      brow.position.set(x, ENEMY_RADIUS + 0.3, 0.47);
      brow.rotation.z = x > 0 ? 0.45 : -0.45;
      this.body.add(eye, pupil, brow);
    }
    for (const x of [0.25, -0.25]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), spikeMat);
      foot.position.set(x, 0.08, 0.1);
      foot.scale.set(1, 0.6, 1.4);
      this.body.add(foot);
    }

    this.body.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }
}

function angleDiff(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
