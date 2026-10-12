# Game Logic Refactor Plan

Goal: make gameplay behavior independently testable and keep `game.ts` as the browser entry point that wires input, session state, simulation, and presentation together. The refactor is not complete while `game.ts` still owns those systems.

## Completed

- [x] Extract player movement rules into a module that takes player state and input, then returns updated state. Cover jump buffering, coyote time, wall jumps, climbing, and knockback with unit tests.
- [x] Extract combat rules for sword attacks, shuriken hits, enemy damage, and boss defeat. Add tests for damage, scoring, and one-hit-per-attack behavior.
- [x] Extract pickups and checkpoints so collection, health and ammo limits, scoring, and respawn positions can be tested directly.
- [x] Move fixed-step timing, update routing, overworld stepping, projectile and particle stepping, enemy stepping, and playing-frame simulation into `game-session.ts`.
- [x] Add session-level tests for interactions across systems, including taking damage then respawning and defeating the boss and returning to the map.
- [x] Extract scene drawing, sprite poses, terrain, enemies, projectiles, and HUD rendering into `game-renderer.ts`. `game.ts` reduced from 1,024 to 649 lines.
- [x] Validate the current extraction with tests, lint, and build (79 tests pass).

## Remaining work

Work through these steps in order. Each behavior-changing extraction needs focused automated tests and a separate commit.

- [x] **Extract input collection and device handling** into `game-input.ts`. Own keyboard, pointer buttons, gamepad polling, pressed-versus-held state, blur, and visibility handling there. Return a normalized input snapshot to the game loop. Test key mappings, edge-triggered presses, held inputs, and gamepad transitions.
- [x] **Extract session and overlay lifecycle orchestration** into a controller module. Own starting and resuming, pausing, death and retry screens, returning to the map, entering a stage, and corresponding labels/status updates. Keep DOM updates behind a small view interface so flow transitions can be tested without a browser.
- [x] **Extract stage runtime and mutable gameplay state** from `game.ts`. Own player/stage state, enemy and pickup population, resets, checkpoints, and stage/map transitions. Keep rules in the existing logic modules; test stage initialization and reset behavior.
- [x] **Extract audio and gameplay feedback effects** into focused presentation helpers. Own sound enablement and synthesis plus hit, pickup, jump, checkpoint, death, and attack feedback. Test the event-to-effect mapping without requiring real audio hardware.
- [x] **Reduce `game.ts` to the composition root.** It should initialize the renderer and browser view, create input/session/runtime components, and connect their callbacks to the fixed-step update and draw loop. Aim for a short file whose functions mostly delegate to those components.
- [ ] **Validate the completed refactor** with the full test suite, lint, and production build. Review `game.ts` responsibilities and update this plan if any substantial browser or gameplay subsystem remains there.
