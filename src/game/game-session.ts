import type { GameFlow } from "./flow"

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
