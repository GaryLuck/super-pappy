/** One player's controls for a single frame, relative to the camera. */
export interface PlayerInput {
  /** Strafe: -1 (left) to 1 (right). */
  x: number;
  /** Forward: -1 (toward camera) to 1 (away from camera). */
  y: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
}

export interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  jump: string[];
  dash: string[];
}

/** One player: every movement key works. */
export const SOLO_KEYS: KeyMap = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyF'],
};

/** Two players sharing a keyboard: Pappy on the left, Ethan on the right. */
export const P1_KEYS: KeyMap = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['Space'],
  dash: ['ShiftLeft', 'KeyF'],
};

export const P2_KEYS: KeyMap = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['Enter', 'NumpadEnter', 'Numpad0'],
  dash: ['ShiftRight', 'Slash'],
};

export const NO_INPUT: PlayerInput = { x: 0, y: 0, jumpHeld: false, jumpPressed: false, dashPressed: false };

const DEADZONE = 0.2;
const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Slash']);

export class Input {
  /** While true, game keys don't scroll the page or activate focused buttons. */
  enabled = false;
  readonly touch: TouchControls | null;

  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private pads: Gamepad[] = [];
  private padButtons: boolean[][] = [];
  private prevPadButtons: boolean[][] = [];

  constructor() {
    addEventListener('keydown', (e) => {
      if (this.enabled && GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    addEventListener('keyup', (e) => this.held.delete(e.code));
    addEventListener('blur', () => this.held.clear());
    this.touch = TouchControls.supported() ? new TouchControls() : null;
  }

  /** Call once at the start of each frame. */
  poll(): void {
    this.prevPadButtons = this.padButtons;
    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    this.pads = pads.filter((p): p is Gamepad => p !== null && p.connected);
    this.padButtons = this.pads.map((p) => p.buttons.map((b) => b.pressed));
  }

  /** Call once at the end of each frame, after every read. */
  endFrame(): void {
    this.pressed.clear();
    this.touch?.endFrame();
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  read(keys: KeyMap, padIndex: number, useTouch: boolean): PlayerInput {
    const held = (codes: string[]) => codes.some((c) => this.held.has(c));
    const tapped = (codes: string[]) => codes.some((c) => this.pressed.has(c));

    let x = (held(keys.right) ? 1 : 0) - (held(keys.left) ? 1 : 0);
    let y = (held(keys.up) ? 1 : 0) - (held(keys.down) ? 1 : 0);
    let jumpHeld = held(keys.jump);
    let jumpPressed = tapped(keys.jump);
    let dashPressed = tapped(keys.dash);

    const pad = this.pads[padIndex];
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > DEADZONE) {
        x += ax;
        y -= ay;
      }
      const now = (i: number) => this.padButtons[padIndex]?.[i] ?? false;
      const before = (i: number) => this.prevPadButtons[padIndex]?.[i] ?? false;
      // Standard mapping: 0 = A/Cross, 1 = B/Circle, 2 = X/Square, 12-15 = d-pad.
      if (now(12)) y += 1;
      if (now(13)) y -= 1;
      if (now(14)) x -= 1;
      if (now(15)) x += 1;
      jumpHeld ||= now(0);
      jumpPressed ||= now(0) && !before(0);
      dashPressed ||= (now(1) || now(2)) && !(before(1) || before(2));
    }

    if (useTouch && this.touch) {
      x += this.touch.x;
      y += this.touch.y;
      jumpHeld ||= this.touch.jumpHeld;
      jumpPressed ||= this.touch.jumpPressed;
      dashPressed ||= this.touch.dashPressed;
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y, jumpHeld, jumpPressed, dashPressed };
  }

  /** Camera orbit from Q/E or the first gamepad's right stick, -1 to 1. */
  cameraTurn(): number {
    let turn = (this.held.has('KeyE') ? 1 : 0) - (this.held.has('KeyQ') ? 1 : 0);
    const rx = this.pads[0]?.axes[2] ?? 0;
    if (Math.abs(rx) > DEADZONE) turn += rx;
    return Math.max(-1, Math.min(1, turn));
  }
}

/** On-screen joystick and buttons for phones and tablets (single player only). */
class TouchControls {
  static supported(): boolean {
    return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  x = 0;
  y = 0;
  jumpHeld = false;
  jumpPressed = false;
  dashPressed = false;

  private readonly root = document.createElement('div');

  constructor() {
    this.root.id = 'touch';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="stick"><div class="knob"></div></div>
      <button class="touch-btn dash" aria-label="Dash">Dash</button>
      <button class="touch-btn jump" aria-label="Jump">Jump</button>`;
    document.body.append(this.root);

    const stick = this.root.querySelector<HTMLElement>('.stick')!;
    const knob = this.root.querySelector<HTMLElement>('.knob')!;
    const radius = 50;
    let stickPointer: number | null = null;

    const moveStick = (e: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      let dx = e.clientX - (rect.left + rect.width / 2);
      let dy = e.clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.x = dx / radius;
      this.y = -dy / radius;
    };
    const releaseStick = () => {
      stickPointer = null;
      knob.style.transform = '';
      this.x = 0;
      this.y = 0;
    };
    stick.addEventListener('pointerdown', (e) => {
      stickPointer = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId === stickPointer) moveStick(e);
    });
    stick.addEventListener('pointerup', releaseStick);
    stick.addEventListener('pointercancel', releaseStick);

    const jump = this.root.querySelector<HTMLElement>('.jump')!;
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.jumpHeld = true;
      this.jumpPressed = true;
    });
    const releaseJump = () => (this.jumpHeld = false);
    jump.addEventListener('pointerup', releaseJump);
    jump.addEventListener('pointercancel', releaseJump);
    jump.addEventListener('pointerleave', releaseJump);

    this.root.querySelector<HTMLElement>('.dash')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.dashPressed = true;
    });
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  endFrame(): void {
    this.jumpPressed = false;
    this.dashPressed = false;
  }
}
