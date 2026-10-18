import { MAX_HEARTS, type Hero } from './hero';

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private readonly root = document.getElementById('hud')!;
  private readonly players = document.getElementById('hud-players')!;
  private readonly stars = document.getElementById('hud-stars')!;
  private readonly time = document.getElementById('hud-time')!;
  private lastKey = '';

  show(visible: boolean): void {
    this.root.hidden = !visible;
    this.lastKey = '';
  }

  update(heroes: Hero[], collected: number, total: number, seconds: number): void {
    const key = `${heroes.map((h) => `${h.hearts}:${h.stars}`).join('|')}|${collected}|${Math.floor(seconds)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.players.innerHTML = heroes
      .map(
        (h) => `
        <div class="chip" style="--hero:${h.color}">
          <b>${h.name}</b>
          <span class="hearts" aria-label="${h.hearts} hearts">${'♥'.repeat(h.hearts)}<i>${'♥'.repeat(MAX_HEARTS - h.hearts)}</i></span>
          ${heroes.length > 1 ? `<span class="mine">★ ${h.stars}</span>` : ''}
        </div>`,
      )
      .join('');
    this.stars.textContent = `★ ${collected} / ${total}`;
    this.time.textContent = formatTime(seconds);
  }
}
