import { GameFlow } from "../../src/game/flow"
import {
  GameSession,
  type GameSessionHandlers,
} from "../../src/game/game-session"

describe("game session update routing", () => {
  const createHandlers = (calls: string[]): GameSessionHandlers => ({
    transition: (dt) => calls.push(`transition:${dt}`),
    overworld: (dt) => calls.push(`overworld:${dt}`),
    playing: (dt) => calls.push(`playing:${dt}`),
    inactive: () => calls.push("inactive"),
  })

  it.each([
    ["transition", "transition:0.016"],
    ["overworld", "overworld:0.016"],
    ["playing", "playing:0.016"],
    ["paused", "inactive"],
    ["dead", "inactive"],
    ["won", "inactive"],
  ] as const)(
    "routes %s frames to the matching simulation handler",
    (state, expected) => {
      const flow = new GameFlow()
      flow.state = state
      const session = new GameSession(flow)
      const calls: string[] = []

      session.update(0.016, createHandlers(calls))

      expect(calls).toEqual([expected])
    },
  )
})

describe("game session fixed-step clock", () => {
  it("carries partial frame time forward and emits fixed-size steps", () => {
    const session = new GameSession(new GameFlow())
    const steps: number[] = []

    expect(session.advance(0.01, (dt) => steps.push(dt))).toBe(0)
    expect(session.advance(0.01, (dt) => steps.push(dt))).toBe(1)
    expect(steps).toEqual([1 / 60])
  })

  it("caps catch-up work after a stalled frame", () => {
    const session = new GameSession(new GameFlow())
    const steps: number[] = []

    expect(session.advance(0.5, (dt) => steps.push(dt))).toBe(6)
    expect(steps).toEqual(Array(6).fill(1 / 60))
  })
})
