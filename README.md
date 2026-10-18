# Super Pappy & Super Ethan

A 3D superhero platformer that runs entirely in the browser, built with
[Three.js](https://threejs.org/), TypeScript and [Vite](https://vite.dev/).

The Grumblebots have scattered 20 golden stars across Sky Island. Play as
**Super Pappy** or **Super Ethan**, or team up with two players on one keyboard,
and climb the spiral of floating platforms to the big star on top of the tower.

## Play

```sh
npm install
npm run dev       # http://localhost:5173
```

`npm run build` writes a static site to `dist/` that can be hosted anywhere.
Pushing to `main` deploys it to GitHub Pages (see `.github/workflows/deploy.yml`).

## Controls

| | 1 player | 2 players: Pappy | 2 players: Ethan |
|---|---|---|---|
| Move | WASD or arrows | WASD | Arrows |
| Jump / double-jump | Space | Space | Enter |
| Glide | hold jump while falling | | |
| Super-dash | Shift | Left Shift | Right Shift |

- **Q / E**, or drag with the mouse or a finger: turn the camera
- **P / Esc**: pause, **M**: mute
- Gamepads work too: left stick moves, A jumps, B or X dashes
- On phones and tablets, single-player mode shows an on-screen joystick and buttons
- Jump on a Grumblebot or dash through it to defeat it. Touching one costs a heart.
- In 2-player mode, Ethan can ride on Pappy's head.

## Code map

| File | What it does |
|---|---|
| `src/main.ts` | Menu, pause and win screens |
| `src/game.ts` | Scene, game loop, camera, collisions between heroes, enemies and stars |
| `src/hero.ts` | Hero movement and physics: running, jumping, gliding, dashing, hearts |
| `src/heroModel.ts` | The 3D models for Super Pappy and Super Ethan |
| `src/level.ts` | Sky Island: platforms, star and enemy positions, scenery |
| `src/enemy.ts` | Grumblebots |
| `src/star.ts` | Collectible stars |
| `src/input.ts` | Keyboard, gamepad and touch controls |
| `src/audio.ts` | Synthesized sound effects |
| `src/hud.ts` | Hearts, star count and timer |

Add `?debug` to the URL to expose the game object as `window.game` in the browser console.
