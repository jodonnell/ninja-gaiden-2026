# Game Logic Refactor Plan

Goal: make gameplay behavior independently testable while keeping `game.ts` focused on connecting input, simulation, and rendering.

## TODO

- [x] **Extract player movement rules** into a module that takes player state and input, then returns updated state. Cover jump buffering, coyote time, wall jumps, climbing, and knockback with unit tests.
- [x] **Extract combat rules** for sword attacks, shuriken hits, enemy damage, and boss defeat. Add tests for damage, scoring, and one-hit-per-attack behavior.
- [ ] **Extract pickups and checkpoints** so collection, health and ammo limits, scoring, and respawn positions can be tested directly.
- [ ] **Separate simulation from rendering and browser setup.** Keep Pixi, DOM, and drawing in `game.ts`; move the gameplay update into a testable game-session module.
- [ ] **Add session-level tests** for interactions across systems, such as taking damage then respawning, or defeating the boss and returning to the map.
- [ ] **Validate the refactor** by running tests, lint, and build, then review whether `game.ts` is mostly wiring rather than gameplay logic.

Work through the checklist in order. Keep each extraction and its tests in a separate commit so regressions are easier to track.
