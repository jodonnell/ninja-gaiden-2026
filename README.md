# Shadow of the Dragon

A Zelda II-style overworld leading into Ninja Gaiden II-inspired rooftop action stages built with the repo's **TypeScript + Vite + PixiJS 8** stack. Uses Ryu frames from the user-provided NES sprite sheet; see [asset credits](assets/CREDITS.md).

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` makes the production build; `npm run preview` serves it.

## Controls

- Arrow keys / WASD: explore the overworld; Left / Right or A / D: move in stages
- Walk onto a numbered temple to enter a stage
- M / World Map button: return to the map
- Z / Space: jump (hold for height)
- X: sword attack
- C: shuriken
- Hold toward a wall to grip; Up / W to climb; Z to wall jump
- Escape / P: pause; Enter: start / continue
- Gamepad: D-pad / left stick, A jump, X / B slash, Y shuriken, Start pause
- Touch controls appear on narrow screens

Cross the stage, collect health and ammunition, reach the midpoint checkpoint, and defeat Black Lotus. Three lives, a stage timer, damage invulnerability, and retry / victory flows are implemented. Sound effects are opt-in via the Sound button. Losing focus pauses gameplay.

The game starts on the overworld. Three temple entrances load variants of the rooftop stage, with different palettes, raised platforms, and boss health. Clearing a stage marks its temple; returning keeps your map position. Progress lasts for the current session. These are stage variants, not recreations of the original Ninja Gaiden II levels. Stage art is original, while guard and boss visuals are recolored Ryu placeholders. No original music or full campaign is included.

## Development

- `npm test`: collision and rooftop jump tests
- `npm run lint`: ESLint
- `npx tsc --noEmit`: TypeScript
- `npm run build`: production bundle

`src/game/overworld.ts` contains the map, tile rendering, and entrances. `src/game/world.ts` contains terrain and collision physics. `src/game/game.ts` contains the fixed-step game loop, combat, input, audio, and procedural scene drawing. The pixel surface is uploaded to a nearest-neighbor PixiJS texture at 480×270.
