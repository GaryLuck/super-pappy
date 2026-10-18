import './style.css';
import { unlockAudio } from './audio';
import { Game, type Mode, type WinResult } from './game';
import { formatTime } from './hud';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const menu = $('menu');
const pause = $('pause');
const win = $('win');

const game = new Game($<HTMLCanvasElement>('game'), {
  onWin: showWin,
  onPauseChange: (paused) => (pause.hidden = !paused),
});

function play(mode: Mode): void {
  unlockAudio();
  menu.hidden = true;
  pause.hidden = true;
  win.hidden = true;
  (document.activeElement as HTMLElement | null)?.blur();
  game.start(mode);
}

function toTitle(): void {
  pause.hidden = true;
  win.hidden = true;
  menu.hidden = false;
  game.showTitle();
}

function showWin(result: WinResult): void {
  $('win-time').textContent = formatTime(result.seconds);
  const detail = $('win-detail');
  if (result.heroes.length > 1) {
    detail.innerHTML = result.heroes
      .map((h) => `<span style="color:${h.color}">${h.name}: ★ ${h.stars}</span>`)
      .join('');
  } else {
    detail.innerHTML = `<span style="color:${result.heroes[0].color}">${result.heroes[0].name} saved the day!</span>`;
  }
  win.hidden = false;
}

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  btn.addEventListener('click', () => play(btn.dataset.mode as Mode));
}
$('resume').addEventListener('click', () => game.togglePause());
$('pause-btn').addEventListener('click', () => game.togglePause());
$('pause-menu').addEventListener('click', toTitle);
$('again').addEventListener('click', () => play(game.lastMode));
$('win-menu').addEventListener('click', toTitle);

// Add ?debug to the URL to poke at the game from the browser console.
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { game });
