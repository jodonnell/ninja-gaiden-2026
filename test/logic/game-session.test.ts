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
