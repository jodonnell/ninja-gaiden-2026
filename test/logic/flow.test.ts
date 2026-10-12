import { GameFlow } from "../../src/game/flow"

describe("game flow", () => {
  it("starts a stage transition and enters play when its timer expires", () => {
    const flow = new GameFlow()
    flow.enterStage(0.7)

    expect(flow.state).toBe("transition")
    flow.updateTransition(0.4)
    expect(flow.state).toBe("transition")
    flow.updateTransition(0.3)
    expect(flow.state).toBe("playing")
  })

  it.each(["playing", "overworld"] as const)(
    "remembers and restores the %s state when paused",
    (state) => {
      const flow = new GameFlow()
      flow.state = state

      expect(flow.pause()).toBe("paused")
      expect(flow.state).toBe("paused")
      expect(flow.pausedFrom).toBe(state)
      expect(flow.begin(3)).toBe(state === "overworld" ? "map" : "resumed")
      expect(flow.state).toBe(state)
    },
  )

  it("only starts a fresh play session after a non-final death", () => {
    const flow = new GameFlow()
    flow.state = "dead"

    expect(flow.begin(2)).toBe("started")
    expect(flow.state).toBe("playing")
  })

  it.each(["won", "dead"] as const)(
    "returns to the map after %s when no lives remain or the stage is cleared",
    (state) => {
      const flow = new GameFlow()
      flow.state = state

      expect(flow.begin(state === "dead" ? 0 : 3)).toBe("map")
      expect(flow.state).toBe("overworld")
    },
  )

  it("does not change state when begin is pressed during play or transition", () => {
    const flow = new GameFlow()
    flow.state = "playing"
    expect(flow.begin(3)).toBe("unchanged")

    flow.enterStage()
    expect(flow.begin(3)).toBe("unchanged")
    expect(flow.state).toBe("transition")
  })
})
