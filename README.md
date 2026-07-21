# PULSAR — Energy Core Arena

An original, fast-paced top-down neon arena game. Players deploy **Energy Cores**
that arm after a short delay and release **expanding circular pulse waves**
(not cross-shaped explosions). Win by **controlling territory** and **collecting
energy crystals** — knocking rivals down is a tool, not the goal.

Everything is generated procedurally: maps, sounds, particles and icons. There
are **no external game assets** and no resemblance to any existing title.

---

## Run it

The game uses native ES modules, which browsers block over `file://`. Serve the
folder with any static server:

```bash
# Python (already installed on most machines)
python -m http.server 8080
#   -> open http://localhost:8080

# or Node
npx serve -l 8080 .
```

In VS Code, the **Live Server** extension works as well. Opening `index.html`
directly will show a hint explaining this.

**Single-file build** — to produce a standalone `dist/index.html` that runs by
just double-clicking (no server), run:

```bash
npm install   # once, pulls esbuild
npm run build # -> dist/index.html
npm test      # headless smoke test
```

---

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `WASD` / Arrow keys | Left virtual stick |
| Deploy Energy Core | `Space` | ◉ button |
| Dash | `Shift` | » button |
| Shield | `E` | ◈ button |
| Cycle core type | `Q` | ⟳ button |
| Pause | `Esc` / `P` | (pause via menu) |

---

## Gameplay systems

- **Random maps + 3 themes** — border walls, a pillar lattice, scattered
  destructible crystals, clear corner spawns and linked teleport-pad pairs. Each
  match randomly picks one of three visual themes (연구 시설 / 에너지 광산 / 네온 시티).
- **Drone classes** — four selectable archetypes, each a stat profile plus a
  distinct procedurally-drawn vector look: **SPECTER** (balanced), **NOVA**
  (fast, short dash cooldown), **PHANTOM** (high energy regen), **GUARDIAN**
  (tanky, longer shield, bigger body). Pick one on the main menu; bots get
  varied classes. Art is drawn from primitives in `js/ui/DroneArt.js` — no image
  assets.
- **Item pickups** — items periodically drop on the floor: **Overcharge**
  (cheaper, larger pulses), **Haste** (move faster), **Cloak** (bots stop
  targeting you) and **Energy** (instant refill). Bots grab them too.
- **Energy Cores** — six archetypes with different fuses, radii and wave speeds:
  Standard, Rapid, Heavy, Resonant (delayed echo waves), Magnetic (yanks nearby
  cores into an instant chain) and Freeze (slows enemies instead of downing
  them). Deploying costs energy.
- **Circular pulse waves** — expand from the core, shatter crystals, paint
  territory, knock down unshielded players and **chain-trigger** nearby cores.
- **Chain reactions** — a wave that reaches an armed core detonates it instantly,
  producing cascades. Resonant cores add delayed echo waves.
- **Abilities** — Dash (burst + brief invulnerability) and Shield (temporary
  invulnerability), each on independent cooldowns.
- **Teleport pads** — step on one to travel to its linked pad.
- **Territory scoring** — floor tiles are owned by whoever last swept or stood on
  them; score = tiles + crystal shards collected. A top HUD bar shows each
  faction's live share and a crown marks the current leader.
- **AI bots** — a SEEK / HUNT / FLEE state machine that farms crystals, presses
  attacks and dodges pulses (dashing / shielding to escape).
- **Feedback** — pooled particle effects, decaying camera shake, detonation
  light-flashes, a cinematic vignette, contact shadows and bevelled floor
  panels, and a fully procedural Web Audio sound manager.
- **Persistence** — language, volume, SFX, screen shake, bot count and match
  length are saved to LocalStorage.
- **Languages** — Korean by default, English selectable in Settings; all UI text
  lives in `js/core/i18n.js` (add a language by adding one block with the same keys).

---

## Architecture

Framework-free, object-oriented, one responsibility per module.

```
pulsar-arena/
├── index.html            # page shell + fonts + boot hint
├── css/styles.css        # neon theme, menus, touch controls
├── package.json
└── js/
    ├── main.js           # bootstrap: wires systems, sizing, menu callbacks
    ├── core/
    │   ├── constants.js       # all tunable config (balance in one place)
    │   ├── utils.js           # math, RNG, colour, Emitter
    │   ├── Game.js            # orchestrator: loop, state machine, events
    │   ├── Camera.js          # smoothed follow + screen shake
    │   ├── InputManager.js    # keyboard + touch (virtual stick/buttons)
    │   ├── SoundManager.js    # procedural Web Audio SFX
    │   ├── ParticleSystem.js  # pooled particles
    │   └── Storage.js         # LocalStorage settings
    ├── world/
    │   ├── Grid.js            # tiles, collision, tile rendering
    │   ├── MapGenerator.js    # procedural arena generation
    │   └── TerritorySystem.js # ownership + scoring
    ├── entities/
    │   ├── Entity.js          # tiny base class
    │   ├── Player.js          # movement, abilities, class stats, items, respawn
    │   ├── Bot.js             # AI (extends Player)
    │   ├── EnergyCore.js      # deployable core + chain trigger
    │   ├── PulseWave.js       # expanding circular wave
    │   ├── Crystal.js         # collectible shard
    │   └── Item.js            # floating item pickup (buff/instant)
    └── ui/
        ├── DroneArt.js       # procedural drone art (canvas top-down + SVG portrait)
        ├── HUD.js            # canvas scoreboard/energy/cooldowns/buffs/minimap
        └── Menu.js           # DOM overlays (main + class picker/settings/pause/results)
```

**Data flow.** `main.js` builds the subsystems and hands them to `Game`.
Gameplay raises semantic events on `Game` (`onCrystalDestroyed`,
`onPulseHitPlayer`, `onCoreDetonated`, …); `Game` routes them to sound,
particles and camera shake. UI never touches gameplay directly — it only calls
Game methods via callbacks.

---

## Extending it

The code is built to grow:

- **New core type** — add an entry to `CORE_TYPES` in `constants.js` (and a glyph
  case in `EnergyCore._drawGlyph`). It appears in the cycle automatically.
- **New drone class** — add an entry to `CLASSES` in `constants.js` (stat
  multipliers + a `shape`). Add the silhouette to `hullPath`/`crownSVG` in
  `DroneArt.js`. It shows up in the menu picker automatically.
- **New item** — add an entry to `ITEMS` in `constants.js`, a `_glyph` case in
  `Item.js`, and its effect in `Player.applyItem`. It spawns and drops in.
- **New ability** — add timers to `Player`, a branch in `_handleAbilities`, and a
  pip in `HUD._playerPanel`.
- **New tile** — add a `TILE.*` id, handle it in `Grid` (collision + render) and
  `MapGenerator`.
- **New sound** — add a method to `SoundManager` built from `_tone` / `_noise`.
- **Tuning** — nearly all balance lives in `constants.js`.

---

## Tests

A headless smoke test (`_test/harness.mjs`) mocks the canvas/DOM and runs
hundreds of simulated frames to exercise deploy → arm → pulse → chain → shatter →
collect → score → game-over. Run with:

```bash
node _test/harness.mjs
```

## License

MIT. Original work — no third-party game assets.
