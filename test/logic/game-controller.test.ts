import { GameController, type GameView } from "../../src/game/game-controller"
import { GameFlow } from "../../src/game/flow"
import { locations } from "../../src/game/overworld"

describe("game controller lifecycle", () => {
  function harness(initialState: GameFlow["state"] = "overworld") {
    const flow = new GameFlow()
    flow.state = initialState
    const calls: unknown[][] = []
    const view: GameView = {
      showOverlay: (...args) => calls.push(["show", ...args]),
      hideOverlay: () => calls.push(["hide"]),
      setLabels: (...args) => calls.push(["labels", ...args]),
      setStatus: (status) => calls.push(["status", status]),
    }
    let lives = 3
    let score = 1200
    let stageName = "01 — Dragon's Den"
    const controller = new GameController({
      flow,
      view,
      getLives: () => lives,
      setLives: (value) => { lives = value },
      getScore: () => score,
      getStageName: () => stageName,
      reset: (full) => calls.push(["reset", full]),
      clearInput: () => calls.push(["clear"]),
      setMapCooldown: (seconds) => calls.push(["cooldown", seconds]),
      prepareStage: (location) => {
        stageName = `0${location.id + 1} — ${location.name}`
        calls.push(["prepare", location.id])
      },
      playCue: (...args) => calls.push(["cue", ...args]),
    })
    return { controller, flow, calls, setLives: (value: number) => { lives = value }, setScore: (value: number) => { score = value } }
  }

  it("enters a stage, starts its transition, and resumes into play", () => {
    const { controller, flow, calls } = harness()
    controller.enterStage(locations[1])
    expect(flow.state).toBe("transition")
    expect(calls).toContainEqual(["prepare", locations[1].id])
    expect(calls).toContainEqual(["labels", `02 — ${locations[1].name}`, "SIDE-SCROLLING MISSION"])
    expect(calls).toContainEqual(["cue", 660, 0.15, "triangle"])

    flow.updateTransition(1)
    controller.pause()
    expect(flow.state).toBe("paused")
    expect(calls).toContainEqual(["show", "PAUSED", "Take a breath. The shadows can wait.", "RESUME"])
    controller.begin()
    expect(flow.state).toBe("playing")
  })

  it("retries after death, presents death state, and returns to the map", () => {
    const { controller, flow, calls, setLives } = harness("dead")
    setLives(2)
    controller.showDeath()
    expect(calls).toContainEqual(["status", "MISSION INTERRUPTED"])
    controller.begin()
    expect(flow.state).toBe("playing")
    expect(calls).toContainEqual(["reset", false])

    controller.returnToMap()
    expect(flow.state).toBe("overworld")
    expect(calls).toContainEqual(["labels", "SHADOW PROVINCE — WORLD MAP", "SHADOW PROVINCE / WORLD MAP"])
  })

  it("turns an in-game environmental fall into a retryable death", () => {
    const { controller, flow, calls, setLives } = harness("playing")
    expect(controller.die()).toBe(2)
    expect(flow.state).toBe("dead")
    expect(calls).toContainEqual(["status", "MISSION INTERRUPTED"])
    setLives(2)
    expect(controller.die()).toBe(2)
  })

  it("resets a finished run and presents a stage clear", () => {
    const { controller, flow, calls, setLives, setScore } = harness("won")
    setLives(0)
    setScore(42)
    controller.stageCleared("The Dragon")
    expect(calls).toContainEqual(["status", "STAGE CLEAR"])
    controller.begin()
    expect(flow.state).toBe("overworld")
    expect(calls).toContainEqual(["reset", true])
  })
})
