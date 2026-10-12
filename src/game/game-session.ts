import type { GameFlow } from "./flow"

/** Coordinates the simulation phase without depending on browser or renderer APIs. */
export type GameSessionHandlers = {
  transition(dt: number): void
  overworld(dt: number): void
  playing(dt: number): void
  inactive(): void
}

export class GameSession {
  constructor(readonly flow: GameFlow) {}

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
