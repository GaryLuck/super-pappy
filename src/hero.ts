import * as THREE from 'three';
import { sfx } from './audio';
import { buildHero, LOOKS, type HeroKind, type HeroRig } from './heroModel';
import { FALL_LIMIT, type Box, type Platform } from './level';

export const MAX_HEARTS = 3;

const MOVE_SPEED = 7;
const JUMP_SPEED = 12;
const GRAVITY = -30;
const MAX_FALL = 25;
const GLIDE_FALL = 2.5;
const DASH_SPEED = 18;
const DASH_TIME = 0.2;
const DASH_COOLDOWN = 0.7;
/** Grace period for jumping just after running off a ledge. */
const COYOTE_TIME = 0.12;
const INVULNERABLE_TIME = 1.6;
/** Ledges lower than this are walked onto instead of blocking. */
const STEP_UP = 0.3;
const EPS = 1e-4;

/** Movement in world space for one physics step. */
export interface MoveInput {
  x: number;
  z: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
}

export class Hero {
  readonly kind: HeroKind;
  readonly name: string;
  readonly color: string;
  readonly rig: HeroRig;
  /** Position of the hero's feet. */
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  readonly radius = 0.35;
  readonly height: number;

  hearts = MAX_HEARTS;
  stars = 0;
  grounded = false;
  gliding = false;

  private ground: Platform | null = null;
  private riding: Hero | null = null;
  /** How far the hero moved in the last step, so a hero standing on this one rides along. */
  private readonly lastMove = new THREE.Vector3();
  private readonly before = new THREE.Vector3();
  private readonly safe = new THREE.Vector3();
  private readonly spawn: THREE.Vector3;
  private coyote = 0;
  private jumps = 0;
  private dashTime = 0;
  private dashCooldown = 0;
  private invulnerable = 0;
  private spin = 0;
  private facing: number;
  private walkPhase = 0;

  constructor(kind: HeroKind, spawn: THREE.Vector3, facing: number) {
    const look = LOOKS[kind];
    this.kind = kind;
    this.name = look.name;
    this.color = look.css;
    this.height = look.height;
    this.rig = buildHero(kind);
    this.spawn = spawn.clone();
    this.facing = facing;
    this.respawn(this.spawn);
    this.safe.copy(this.spawn);
    this.animate(0, 0);
  }

  get dashing(): boolean {
    return this.dashTime > 0;
  }

  get top(): number {
    return this.pos.y + this.height;
  }

  step(dt: number, input: MoveInput, platforms: Platform[], heroes: Hero[]): void {
    this.before.copy(this.pos);
    if (this.ground) this.pos.add(this.ground.delta);
    else if (this.riding) this.pos.add(this.riding.lastMove);

    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.coyote = this.grounded ? COYOTE_TIME : this.coyote - dt;

    if (this.dashTime > 0) {
      this.dashTime -= dt;
    } else {
      const accel = this.grounded ? 45 : 20;
      this.vel.x = approach(this.vel.x, input.x * MOVE_SPEED, accel * dt);
      this.vel.z = approach(this.vel.z, input.z * MOVE_SPEED, accel * dt);
    }

    if (input.dashPressed && this.dashCooldown <= 0) {
      let dx = input.x;
      let dz = input.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) {
        dx = Math.sin(this.facing);
        dz = Math.cos(this.facing);
      } else {
        dx /= len;
        dz /= len;
      }
      this.vel.set(dx * DASH_SPEED, 0, dz * DASH_SPEED);
      this.dashTime = DASH_TIME;
      this.dashCooldown = DASH_COOLDOWN;
      sfx.dash();
    }

    if (input.jumpPressed) {
      if (this.coyote > 0) {
        this.vel.y = JUMP_SPEED;
        this.jumps = 1;
        this.coyote = 0;
        sfx.jump();
      } else if (this.jumps < 2) {
        this.vel.y = JUMP_SPEED * 0.92;
        this.jumps = 2;
        this.spin = 1;
        sfx.doubleJump();
      }
    }

    if (this.dashTime <= 0) this.vel.y = Math.max(this.vel.y + GRAVITY * dt, -MAX_FALL);
    // Holding jump while falling spreads the cape and glides.
    this.gliding = !this.grounded && input.jumpHeld && this.vel.y < -GLIDE_FALL;
    if (this.gliding) this.vel.y = -GLIDE_FALL;

    this.moveHorizontal('x', this.vel.x * dt, platforms);
    this.moveHorizontal('z', this.vel.z * dt, platforms);
    this.moveVertical(this.vel.y * dt, platforms, heroes);

    if (this.grounded) {
      this.jumps = 0;
      if (this.ground && !this.ground.moving) this.rememberSafeSpot(this.ground.box);
    }
    if (this.pos.y < FALL_LIMIT) this.fell();
    this.lastMove.subVectors(this.pos, this.before);
  }

  /** Bounce up, e.g. after stomping an enemy. */
  bounce(speed: number): void {
    this.vel.y = speed;
    this.jumps = 1;
    this.grounded = false;
  }

  /** Take a hit from something at (fromX, fromZ). Returns false while still blinking from the last hit. */
  hurt(fromX: number, fromZ: number): boolean {
    if (this.invulnerable > 0) return false;
    if (this.loseHeart()) return true;
    const dx = this.pos.x - fromX;
    const dz = this.pos.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / len) * 9, 8, (dz / len) * 9);
    this.dashTime = 0;
    this.grounded = false;
    return true;
  }

  /** Update the 3D model to match the hero's state. */
  animate(dt: number, time: number): void {
    const rig = this.rig;
    rig.root.position.copy(this.pos);

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const run = Math.min(1, speed / MOVE_SPEED);
    if (speed > 0.3) this.facing = lerpAngle(this.facing, Math.atan2(this.vel.x, this.vel.z), 1 - Math.exp(-dt * 14));
    this.spin = Math.max(0, this.spin - dt * 2.5);
    rig.root.rotation.y = this.facing + (this.spin > 0 ? (1 - this.spin) * Math.PI * 2 : 0);

    const flying = this.gliding || this.dashing;
    const k = 1 - Math.exp(-dt * 15);
    const ease = (o: THREE.Object3D, target: number) => (o.rotation.x += (target - o.rotation.x) * k);
    ease(rig.tilt, flying ? 1.25 : 0);

    if (this.grounded) {
      this.walkPhase += dt * speed * 1.8;
      const swing = Math.sin(this.walkPhase) * 0.8 * run;
      ease(rig.legL, swing);
      ease(rig.legR, -swing);
      ease(rig.armL, -swing);
      ease(rig.armR, swing);
    } else if (flying) {
      // Classic superhero pose: both fists forward.
      ease(rig.legL, 0.1);
      ease(rig.legR, 0.1);
      ease(rig.armL, -2.9);
      ease(rig.armR, -2.9);
    } else {
      // Jumping: one fist in the air.
      ease(rig.legL, -0.5);
      ease(rig.legR, 0.3);
      ease(rig.armL, 0.3);
      ease(rig.armR, -2.9);
    }

    const flutter = Math.sin(time * 11 + (this.kind === 'pappy' ? 0 : 2)) * (0.04 + 0.08 * run);
    const capeTarget = 0.12 + run * 0.7 + (this.grounded ? 0 : 0.35) + (flying ? 0.3 : 0) + flutter;
    ease(rig.cape, Math.min(capeTarget, 1.5));

    rig.root.visible = this.invulnerable <= 0 || Math.floor(time * 16) % 2 === 0;
  }

  private moveHorizontal(axis: 'x' | 'z', amount: number, platforms: Platform[]): void {
    if (amount === 0) return;
    this.pos[axis] += amount;
    for (const p of platforms) {
      if (!this.overlaps(p.box)) continue;
      if (this.grounded && p.box.max.y - this.pos.y <= STEP_UP) {
        this.pos.y = p.box.max.y;
        continue;
      }
      this.pos[axis] = amount > 0 ? p.box.min[axis] - this.radius - EPS : p.box.max[axis] + this.radius + EPS;
      this.vel[axis] = 0;
    }
  }

  private moveVertical(amount: number, platforms: Platform[], heroes: Hero[]): void {
    const prevY = this.pos.y;
    this.pos.y += amount;
    this.grounded = false;
    this.ground = null;
    this.riding = null;

    for (const p of platforms) {
      if (!this.overlaps(p.box)) continue;
      if (amount <= 0) {
        this.pos.y = p.box.max.y;
        this.grounded = true;
        this.ground = p;
      } else {
        this.pos.y = p.box.min.y - this.height - EPS;
      }
      this.vel.y = 0;
    }

    // Heroes can stand on each other's heads.
    if (this.grounded || amount > 0) return;
    for (const other of heroes) {
      if (other === this) continue;
      const reach = this.radius + other.radius;
      if (Math.abs(this.pos.x - other.pos.x) >= reach || Math.abs(this.pos.z - other.pos.z) >= reach) continue;
      if (prevY >= other.top - 0.05 && this.pos.y < other.top) {
        this.pos.y = other.top;
        this.vel.y = 0;
        this.grounded = true;
        this.riding = other;
      }
    }
  }

  private overlaps(b: Box): boolean {
    const p = this.pos;
    const r = this.radius;
    return (
      p.x - r < b.max.x - EPS &&
      p.x + r > b.min.x + EPS &&
      p.z - r < b.max.z - EPS &&
      p.z + r > b.min.z + EPS &&
      p.y < b.max.y - EPS &&
      p.y + this.height > b.min.y + EPS
    );
  }

  /** Remember a spot on solid ground, pulled in from the edges, to come back to after a fall. */
  private rememberSafeSpot(b: Box): void {
    const inset = 1;
    const clampTo = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    this.safe.set(
      clampTo(this.pos.x, b.min.x + inset, b.max.x - inset),
      b.max.y,
      clampTo(this.pos.z, b.min.z + inset, b.max.z - inset),
    );
  }

  private fell(): void {
    if (!this.loseHeart()) this.respawn(this.safe);
  }

  /** Lose a heart. Losing the last one sends the hero back to the start with full hearts; returns true if so. */
  private loseHeart(): boolean {
    sfx.hurt();
    this.invulnerable = INVULNERABLE_TIME;
    this.hearts--;
    if (this.hearts > 0) return false;
    this.hearts = MAX_HEARTS;
    this.respawn(this.spawn);
    this.safe.copy(this.spawn);
    return true;
  }

  private respawn(at: THREE.Vector3): void {
    this.pos.copy(at);
    this.pos.y += 0.5;
    this.vel.set(0, 0, 0);
    this.ground = null;
    this.riding = null;
    this.dashTime = 0;
  }
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}
