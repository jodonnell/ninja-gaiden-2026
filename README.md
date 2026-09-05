# Shadow of the Dragon

A playable Ninja Gaiden II-inspired rooftop action stage built with the repo's **TypeScript + Vite + PixiJS 8** stack. Uses Ryu frames from the user-provided NES sprite sheet; see [asset credits](assets/CREDITS.md).

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` makes the production build; `npm run preview` serves it.

## Controls

- Arrow keys / A and D: move
- Z / Space: jump (hold for height)
- X: sword attack
- C: shuriken
- Hold toward a wall to grip; Up / W to climb; Z to wall jump
- Escape / P: pause; Enter: start / continue
- Gamepad: D-pad / left stick, A jump, X / B slash, Y shuriken, Start pause
- Touch controls appear on narrow screens

Cross the stage, collect health and ammunition, reach the midpoint checkpoint, and defeat Black Lotus. Three lives, a stage timer, damage invulnerability, and retry / victory flows are implemented. Sound effects are opt-in via the Sound button. Losing focus pauses gameplay.

This is a single-stage prototype, not a complete recreation of the original game. Stage art is original, while guard and boss visuals are recolored Ryu placeholders. No original music or full campaign is included.

## Development

- `npm test`: collision and rooftop jump tests
- `npm run lint`: ESLint
- `npx tsc --noEmit`: TypeScript
- `npm run build`: production bundle

`src/game/world.ts` contains terrain and collision physics. `src/game/game.ts` contains the fixed-step game loop, combat, input, audio, and procedural scene drawing. The pixel surface is uploaded to a nearest-neighbor PixiJS texture at 480×270.
