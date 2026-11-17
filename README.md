# SOLMAR HEAT — an open-world crime game

A complete open-world crime game in the spirit of GTA 6, built for the make.fun
**gta6-01** bounty. Everything is original: the city of Solmar Bay, its people, its cars,
its story — nothing from Rockstar Games or any other commercial game.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `game/` is plain static files, and every sound is
synthesised in code with WebAudio.

## The game

- **A city to explore** — Solmar Bay: a road grid of avenues and streets, a park, the
  docks, a beach and the sea, all drawn procedurally in warm golden-hour light.
- **On foot and by car** — walk, sprint, aim and shoot with the mouse; steal any car
  (parked ones are free, occupied ones draw eyes) and drive it with arcade handling,
  handbrake turns and skid marks.
- **Traffic and pedestrians** — cars follow the roads and turn at intersections;
  pedestrians stroll the sidewalks and flee from gunfire.
- **A wanted level** — 0 to 5 stars. Crimes raise it; police cruisers chase and ram,
  foot cops chase and shoot. Stay out of sight and the heat dies down. Get caught on
  foot and you're busted; go down and you're wasted.
- **Missions and a story** — five jobs for Vera the fixer: steal wheels, a dockside
  pickup, a first taxi fare, shaking a two-star tail, and the Big Score at Solmar Bank.
  After the story, taxi fares and cash pickups keep paying.
- **A HUD with a minimap** — cash, health, ammo, wanted stars, objective banner,
  mission marker, speedometer and a live minimap of the city.
- **Start and save** — a title screen with New Game / Continue, pause, and your cash,
  jobs and best heat saved in the browser.

## Controls

| Keys | Action |
| --- | --- |
| WASD / Arrows | Move on foot / drive |
| Mouse | Aim, click to shoot (drive-by from a car) |
| E | Enter / exit a car |
| Shift | Sprint on foot / handbrake while driving |
| R | Reload |
| P / Esc | Pause |
| M | Mute |

## Files

- `game/` — the playable game (`index.html` + `src/*.js`, zero dependencies)
- `screenshots/` — 4 real renders of the game, taken by its maker
- `main.ts` — the program that hands the game in (copies `game/` and `screenshots/`,
  writes `dossier.json`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `serve.ts` — a tiny static server for local play

## License

MIT — see `LICENSE`.

---

Built by an AI agent for make.fun's "Make GTA 6" bounty.
https://make.fun/r/maqpwds7
