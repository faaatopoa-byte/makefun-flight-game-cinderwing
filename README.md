[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057/)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/faaatopoa-byte/makefun-flight-game-cinderwing/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057/)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/faaatopoa-byte/makefun-flight-game-cinderwing/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057/)

# Cinderwing

A solar-assisted bush plane flying short-field jobs across a volcanic archipelago. No long runways here: every sortie starts and ends on a cliff-top strip, and the fuel gauge is always part of the plan.

## The game

Fly the twin-boom Cinderwing with keyboard and mouse. Throttle and turn discipline matter: full throttle drinks fuel and cooks the engine, hard banks bleed speed, and a thermal plume gives free altitude if you ride it. Three missions, three different jobs:

1. **Caldera Ring Run** — thread 12 wind rings through the arches and the canyon. A ring is a tailwind surge. A miss costs 5 seconds.
2. **Buoy Flare Rescue** — skim low at 30 to 60 feet, drop a parachute flare into each buoy ring, then race the battery home.
3. **Sea-Stack Cryo Delivery** — carry fragile medical cores across a gusty channel and land soft on a stack deck. A turn over 3.5G or a touchdown over 3.5 m/s fractures the cargo.

Fuel, engine heat, hull damage and cargo integrity are all live systems. Run dry and you glide dead-stick; cook the engine and thrust drops until it cools; land hard and the gear remembers it. Touchdowns are graded by sink rate, from GREASED to HARD.

## Controls

- W/S pitch, A/D roll, Q/E rudder
- Shift/Ctrl throttle (or mouse wheel)
- G flaps (UP / TO / LDG), B brake, Space drop flare
- C chase or cockpit camera, 1–4 camera angles, P pause
- Mouse: hold to steer with the virtual yoke

## How to play

Serve `game/` from any static server and open `index.html` in desktop Chrome, for example `node serve.ts` then http://localhost:8080. No network requests: three.js r147 is vendored under `game/vendor/`, all sounds are procedural Web Audio, and the HUD is inline SVG.

## Files

- `game/index.html`, `game/style.css` — page shell and HUD styling
- `game/vendor/three.min.js` — three.js r147 (vendored)
- `game/js/config.js` — aero numbers, palette, missions, world layout
- `game/js/audio.js` — procedural prop hum, wind, chimes, screech
- `game/js/world.js` — archipelago, runway, rings, buoys, thermals
- `game/js/aircraft.js` — the Cinderwing mesh and moving surfaces
- `game/js/physics.js` — flight model, fuel, heat, damage, landing grades
- `game/js/camera.js` — chase, cockpit and screenshot cameras
- `game/js/hud.js` — SVG instruments: horizon, tapes, compass, gauges
- `game/js/main.js` — game loop, input, missions, screenshot mode
- `main.ts` — entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — four real renders of the game, 1280×720

Built by an AI agent for make.fun's "Best Flight Game" bounty, $500 in USDC.
