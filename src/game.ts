import * as THREE from 'three';
import { sfx, toggleMuted } from './audio';
import { Enemy, ENEMY_HEIGHT, ENEMY_RADIUS } from './enemy';
import { Hero, type MoveInput } from './hero';
import type { HeroKind } from './heroModel';
import { Hud } from './hud';
import { Input, NO_INPUT, P1_KEYS, P2_KEYS, SOLO_KEYS, type KeyMap, type PlayerInput } from './input';
import { ENEMIES, Level, SPAWNS, STARS } from './level';
import { Star } from './star';

export type Mode = HeroKind | 'duo';

export interface WinResult {
  mode: Mode;
  seconds: number;
  heroes: { name: string; color: string; stars: number }[];
}

export interface GameEvents {
  onWin(result: WinResult): void;
  onPauseChange(paused: boolean): void;
}

interface Player {
  hero: Hero;
  keys: KeyMap;
  pad: number;
  touch: boolean;
}

type State = 'attract' | 'playing' | 'paused' | 'won';

/** Physics runs in small fixed steps so fast heroes never pass through platforms. */
const PHYSICS_STEP = 1 / 120;
const CAMERA_PITCH = 0.42;
const SKY = 0x8fd3ff;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private readonly level = new Level();
  private readonly input = new Input();
  private readonly hud = new Hud();

  private players: Player[] = [];
  private enemies: Enemy[] = [];
  private stars: Star[] = [];
  private collected = 0;
  private mode: Mode = 'duo';
  private state: State = 'attract';
  private elapsed = 0;
  private time = 0;
  private winDelay = 0;
  private last = performance.now();

  private camYaw = 0.9;
  private camDist = 40;
  private readonly camTarget = new THREE.Vector3(0, 5, 0);
  private readonly raycaster = new THREE.Raycaster();
  private readonly occluders: THREE.Object3D[];

  constructor(
    canvas: HTMLCanvasElement,
    private readonly events: GameEvents,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 70, 180);
    this.scene.add(new THREE.HemisphereLight(0xdff2ff, 0x5a7d3a, 1.1));
    const sun = new THREE.DirectionalLight(0xfff4dd, 2.2);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(this.level.group);
    this.occluders = this.level.platforms.map((p) => p.mesh);

    this.setup('duo');
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
      if (e.code === 'KeyM') toggleMuted();
    });
    this.enableCameraDrag(canvas);
    requestAnimationFrame(this.loop);
  }

  start(mode: Mode): void {
    this.setup(mode);
    this.state = 'playing';
    this.input.enabled = true;
    this.input.touch?.show(mode !== 'duo');
    this.hud.show(true);
  }

  /** Go back to the title screen, with the island slowly turning behind it. */
  showTitle(): void {
    this.setup('duo');
    this.state = 'attract';
    this.input.enabled = false;
    this.input.touch?.show(false);
    this.hud.show(false);
  }

  get lastMode(): Mode {
    return this.mode;
  }

  togglePause(): void {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
    else return;
    const paused = this.state === 'paused';
    this.input.enabled = !paused;
    this.input.touch?.show(!paused && this.mode !== 'duo');
    this.events.onPauseChange(paused);
  }

  private setup(mode: Mode): void {
    for (const p of this.players) this.scene.remove(p.hero.rig.root);
    for (const e of this.enemies) this.scene.remove(e.group);
    for (const s of this.stars) this.scene.remove(s.mesh);

    this.mode = mode;
    const facing = Math.PI / 2; // toward the start of the spiral
    if (mode === 'duo') {
      this.players = [
        { hero: new Hero('pappy', SPAWNS.pappy, facing), keys: P1_KEYS, pad: 0, touch: false },
        { hero: new Hero('ethan', SPAWNS.ethan, facing), keys: P2_KEYS, pad: 1, touch: false },
      ];
    } else {
      this.players = [{ hero: new Hero(mode, SPAWNS.pappy, facing), keys: SOLO_KEYS, pad: 0, touch: true }];
    }
    this.enemies = ENEMIES.map((def) => new Enemy(def));
    this.stars = STARS.map((def) => new Star(def));
    for (const p of this.players) this.scene.add(p.hero.rig.root);
    for (const e of this.enemies) this.scene.add(e.group);
    for (const s of this.stars) this.scene.add(s.mesh);

    this.collected = 0;
    this.elapsed = 0;
    // Start behind the heroes, looking out toward the spiral. The camera keeps its current
    // target and distance, so it swoops in from wherever it was.
    this.camYaw = -Math.PI / 2;
  }

  private loop = (now: number) => {
    requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.input.poll();
    if (this.state !== 'paused') this.update(dt);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    const playing = this.state === 'playing';
    const heroes = this.players.map((p) => p.hero);

    if (playing) this.camYaw += this.input.cameraTurn() * dt * 2.2;
    const inputs = this.players.map((p) => (playing ? this.input.read(p.keys, p.pad, p.touch) : NO_INPUT));
    const moves = inputs.map((i) => this.toWorld(i));

    const steps = Math.max(1, Math.ceil(dt / PHYSICS_STEP));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.time += h;
      this.level.updatePlatforms(this.time);
      heroes.forEach((hero, i) => {
        // Taps only count once per frame, not once per physics step.
        const move = s === 0 ? moves[i] : { ...moves[i], jumpPressed: false, dashPressed: false };
        hero.step(h, move, this.level.platforms, heroes);
      });
      for (const e of this.enemies) e.update(h);
      if (playing) this.checkContacts(heroes);
    }

    for (const hero of heroes) hero.animate(dt, this.time);
    for (const s of this.stars) s.update(dt, this.time);
    this.level.animate(dt, this.time);

    if (playing) this.elapsed += dt;
    if (this.state === 'won' && this.winDelay > 0) {
      this.winDelay -= dt;
      if (this.winDelay <= 0) {
        this.events.onWin({
          mode: this.mode,
          seconds: this.elapsed,
          heroes: heroes.map((h) => ({ name: h.name, color: h.color, stars: h.stars })),
        });
      }
    }

    this.updateCamera(dt, heroes);
    if (this.state !== 'attract') this.hud.update(heroes, this.collected, this.stars.length, this.elapsed);
  }

  /** Turn camera-relative stick input into a world-space direction. */
  private toWorld(input: PlayerInput): MoveInput {
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    return {
      x: input.x * cos - input.y * sin,
      z: -input.x * sin - input.y * cos,
      jumpHeld: input.jumpHeld,
      jumpPressed: input.jumpPressed,
      dashPressed: input.dashPressed,
    };
  }

  private checkContacts(heroes: Hero[]): void {
    for (const hero of heroes) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const e = enemy.position;
        if (Math.hypot(hero.pos.x - e.x, hero.pos.z - e.z) > hero.radius + ENEMY_RADIUS) continue;
        if (hero.pos.y > e.y + ENEMY_HEIGHT || hero.top < e.y) continue;
        if (hero.dashing) {
          enemy.kill();
          sfx.stomp();
        } else if (hero.vel.y < 0 && hero.pos.y > e.y + ENEMY_HEIGHT * 0.45) {
          enemy.kill();
          hero.bounce(11);
          sfx.stomp();
        } else {
          hero.hurt(e.x, e.z);
        }
      }

      const cx = hero.pos.x;
      const cy = hero.pos.y + hero.height / 2;
      const cz = hero.pos.z;
      for (const star of this.stars) {
        if (star.collected) continue;
        const p = star.position;
        if (Math.hypot(cx - p.x, cy - p.y, cz - p.z) > star.radius + hero.height / 2) continue;
        star.collect();
        hero.stars++;
        this.collected++;
        sfx.star();
        if (this.collected === this.stars.length) this.win();
      }
    }
  }

  private win(): void {
    this.state = 'won';
    this.winDelay = 1.5;
    this.input.enabled = false;
    this.input.touch?.show(false);
    sfx.win();
  }

  private updateCamera(dt: number, heroes: Hero[]): void {
    const target = new THREE.Vector3();
    let dist: number;
    if (this.state === 'attract') {
      this.camYaw += dt * 0.12;
      target.set(0, 5, 0);
      dist = 42;
    } else {
      for (const h of heroes) target.add(h.pos);
      target.divideScalar(heroes.length);
      target.y += 1;
      // In two-player mode, pull back far enough to keep both heroes in view.
      let spread = 0;
      for (const a of heroes) for (const b of heroes) spread = Math.max(spread, a.pos.distanceTo(b.pos));
      dist = THREE.MathUtils.clamp(13 + spread * 0.85, 13, 42);
    }
    this.camTarget.lerp(target, 1 - Math.exp(-dt * 6));
    this.camDist += (dist - this.camDist) * (1 - Math.exp(-dt * 3));

    const dir = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(CAMERA_PITCH),
      Math.sin(CAMERA_PITCH),
      Math.cos(this.camYaw) * Math.cos(CAMERA_PITCH),
    );
    // Don't let the tower or a platform get between the camera and the heroes.
    let camDist = this.camDist;
    if (this.state !== 'attract') {
      this.raycaster.set(this.camTarget, dir);
      this.raycaster.far = camDist;
      const hit = this.raycaster.intersectObjects(this.occluders, false)[0];
      if (hit) camDist = Math.max(hit.distance - 0.4, 1.5);
    }
    this.camera.position.copy(this.camTarget).addScaledVector(dir, camDist);
    this.camera.lookAt(this.camTarget);
  }

  /** Drag on the game view (mouse or finger) to swing the camera around. */
  private enableCameraDrag(canvas: HTMLCanvasElement): void {
    let dragging: number | null = null;
    let lastX = 0;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = e.pointerId;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dragging || this.state !== 'playing') return;
      this.camYaw -= (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    });
    const stop = () => (dragging = null);
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  private resize(): void {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
