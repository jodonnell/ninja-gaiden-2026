# Game Logic Refactor Plan

Goal: make gameplay behavior independently testable while keeping `game.ts` focused on connecting input, simulation, and rendering.

## TODO

- [x] **Extract player movement rules** into a module that takes player state and input, then returns updated state. Cover jump buffering, coyote time, wall jumps, climbing, and knockback with unit tests.
- [x] **Extract combat rules** for sword attacks, shuriken hits, enemy damage, and boss defeat. Add tests for damage, scoring, and one-hit-per-attack behavior.
- [x] **Extract pickups and checkpoints** so collection, health and ammo limits, scoring, and respawn positions can be tested directly.
- [x] **Separate simulation from rendering and browser setup.** `game.ts` now collects input and wires presentation callbacks; the complete playing-frame simulation runs in the testable `game-session.ts` module.
- [x] **Add session-level tests** for interactions across systems, including taking damage then respawning and defeating the boss and returning to the map.
- [x] **Validate the refactor** with tests, lint, and build; the frame update in `game.ts` is now wiring between input, session simulation, and presentation callbacks.

Work through the checklist in order. Keep each extraction and its tests in a separate commit so regressions are easier to track.
