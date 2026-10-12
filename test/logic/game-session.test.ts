import { GameFlow } from "../../src/game/flow"
import {
  GameSession,
  stepOverworld,
  type GameSessionHandlers,
} from "../../src/game/game-session"
import { spawn, type RoamingEnemy } from "../../src/game/overworld"

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

describe("overworld simulation step", () => {
  const step = (overrides: Partial<Parameters<typeof stepOverworld>[0]> = {}) => {
    const args: Parameters<typeof stepOverworld>[0] = {
      dt: 1 / 60,
      cooldown: 0,
      position: { ...spawn },
      visual: { ...spawn },
      enemies: [],
      input: { left: false, right: false, up: false, down: false },
      ...overrides,
    }
    return stepOverworld(args)
  }

  it("moves one walkable tile and starts the movement cooldown", () => {
    const result = step({ input: { left: false, right: true, up: false, down: false } })

    expect(result.position).toEqual({ x: 4, y: 7 })
    expect(result.cooldown).toBe(0.14)
    expect(result.location).toBeUndefined()
  })

  it("enters a stage when movement reaches its map tile", () => {
    const result = step({
      position: { x: 5, y: 7 },
      visual: { x: 5, y: 7 },
      input: { left: false, right: true, up: false, down: false },
    })

    expect(result.position).toEqual({ x: 6, y: 7 })
    expect(result.location?.id).toBe(0)
  })

  it("starts an encounter when a roaming enemy reaches the player", () => {
    const enemy: RoamingEnemy = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 }
    const result = step({ enemies: [enemy] })

    expect(result.location?.id).toBe(0)
    expect(result.position).toEqual(spawn)
  })

  it("does not move during the tile cooldown", () => {
    const result = step({
      cooldown: 0.1,
      input: { left: false, right: true, up: false, down: false },
    })

    expect(result.position).toEqual(spawn)
    expect(result.cooldown).toBeCloseTo(0.1 - 1 / 60)
  })
})
