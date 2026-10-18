import * as THREE from 'three';
import type { StarDef } from './level';

const starGeometry = (() => {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.22;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 1,
  }).center();
})();

const starMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd23f,
  emissive: 0xff9f1c,
  emissiveIntensity: 0.5,
  metalness: 0.3,
  roughness: 0.35,
});

export class Star {
  readonly mesh = new THREE.Mesh(starGeometry, starMaterial);
  readonly radius: number;
  collected = false;

  private readonly base: THREE.Vector3;
  private readonly scale: number;
  private readonly phase = Math.random() * Math.PI * 2;
  private pop = 0;

  constructor(def: StarDef) {
    this.scale = def.scale ?? 1;
    this.radius = 0.6 * this.scale;
    this.base = new THREE.Vector3(...def.pos);
    this.mesh.position.copy(this.base);
    this.mesh.scale.setScalar(this.scale);
    this.mesh.castShadow = true;
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  update(dt: number, time: number): void {
    if (!this.collected) {
      this.mesh.rotation.y = time * 2 + this.phase;
      this.mesh.position.y = this.base.y + Math.sin(time * 2.5 + this.phase) * 0.15;
    } else if (this.mesh.visible) {
      // Zip upward, spin fast and grow, then vanish.
      this.pop += dt * 3;
      this.mesh.rotation.y += dt * 20;
      this.mesh.position.y += dt * 5;
      this.mesh.scale.setScalar(this.scale * (1 + this.pop) * (1 - this.pop * 0.7));
      if (this.pop >= 1) this.mesh.visible = false;
    }
  }

  collect(): void {
    this.collected = true;
  }
}
