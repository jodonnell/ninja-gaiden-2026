import type { GameFlow } from "./flow"
import {
  locationAt,
  roamingEncounter,
  updateRoamingEnemies,
  walkable,
  type Location,
  type RoamingEnemy,
} from "./overworld"

export type MapPosition = { x: number; y: number }
export type OverworldInput = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

/** Advances map encounters, player movement, and the visual map marker. */
export function stepOverworld(args: {
  dt: number
  cooldown: number
  position: MapPosition
  visual: MapPosition
  enemies: RoamingEnemy[]
  input: OverworldInput
}): { position: MapPosition; cooldown: number; location?: Location } {
  const { dt, visual, enemies, input } = args
  let { cooldown, position } = args
  cooldown -= dt
  visual.x += (position.x - visual.x) * Math.min(1, dt * 22)
  visual.y += (position.y - visual.y) * Math.min(1, dt * 22)
  updateRoamingEnemies(enemies, dt)

  const encounter = cooldown <= 0 ? roamingEncounter(enemies, position) : undefined
  if (encounter) return { position, cooldown, location: encounter }

  if (cooldown <= 0) {
    const dx = Number(input.right) - Number(input.left)
    const dy = dx ? 0 : Number(input.down) - Number(input.up)
    if ((dx || dy) && walkable(position.x + dx, position.y + dy)) {
      position = { x: position.x + dx, y: position.y + dy }
      cooldown = 0.14
      return { position, cooldown, location: locationAt(position.x, position.y) }
    }
  }
  return { position, cooldown }
}

/** Coordinates the simulation phase without depending on browser or renderer APIs. */
export type GameSessionHandlers = {
  transition(dt: number): void
  overworld(dt: number): void
  playing(dt: number): void
  inactive(): void
}

export class GameSession {
  private accumulator = 0

  constructor(readonly flow: GameFlow) {}

  /** Runs the simulation at a stable rate and limits catch-up after a stalled frame. */
  advance(elapsedSeconds: number, update: (dt: number) => void) {
    this.accumulator += Math.min(elapsedSeconds, 0.1)
    let steps = 0
    while (this.accumulator >= 1 / 60) {
      update(1 / 60)
      this.accumulator -= 1 / 60
      steps++
    }
    return steps
  }

  update(dt: number, handlers: GameSessionHandlers) {
    if (this.flow.state === "transition") {
      handlers.transition(dt)
      return
    }
    if (this.flow.state === "overworld") {
      handlers.overworld(dt)
      return
    }
    if (this.flow.state === "playing") {
      handlers.playing(dt)
      return
    }
    handlers.inactive()
  }
}
