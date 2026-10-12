import { createPlayerMovementState, updatePlayerMovement } from "../../src/game/player-movement"
import type { Body } from "../../src/game/world"

const dt = 1 / 60
const floor = [{ x: 0, y: 100, w: 200, h: 20 }]
function body(overrides: Partial<Body> = {}): Body {
  return { x: 20, y: 72, w: 10, h: 28, vx: 0, vy: 0, grounded: true, wall: 0, ...overrides }
}
function step(player: Body, state = createPlayerMovementState(), input: Partial<Parameters<typeof updatePlayerMovement>[2]> = {}, terrain = floor) {
  const result = updatePlayerMovement(player, state, {
    axis: 0, jumpPressed: false, jumpHeld: false, climbUp: false, climbDown: false,
    knockbackTime: 0, knockbackVelocity: 0, ...input,
  }, dt, terrain)
  return { state, result }
}

describe("player movement", () => {
  it("buffers a jump until the player lands", () => {
    const player = body({ y: 40, grounded: false, vy: 100 })
    const state = createPlayerMovementState()
    step(player, state, { jumpPressed: true })
    expect(state.jumpBuffer).toBeGreaterThan(0)
    player.y = 72
    player.vy = 0
    player.grounded = true
    const { result } = step(player, state)
    expect(result.jumped).toBe(true)
    expect(player.vy).toBeLessThan(0)
  })

  it("allows a coyote jump just after leaving a ledge", () => {
    const player = body({ grounded: false, y: 71 })
    const state = createPlayerMovementState()
    state.coyote = 0.08
    expect(step(player, state, { jumpPressed: true }).result.jumped).toBe(true)
  })

  it.each([-1, 1])("wall jumps away from the remembered wall (%i)", (wall) => {
    const player = body({ y: 40, grounded: false, wall })
    const { state } = step(player)
    player.wall = 0
    const { result } = step(player, state, { axis: -wall, jumpPressed: true })
    expect(result.jumped).toBe(true)
    expect(player.vx).toBe(-wall * 155)
    expect(state.facing).toBe(-wall)
  })

  it("supports upward and downward wall climbing", () => {
    const wallTerrain = [{ x: 30, y: 0, w: 20, h: 100 }]
    const player = body({ x: 20, y: 40, grounded: false, wall: 1 })
    step(player, createPlayerMovementState(), { axis: 1, climbUp: true }, wallTerrain)
    expect(player.vy).toBeLessThan(0)
    player.y = 40
    player.vy = 0
    player.wall = 1
    step(player, createPlayerMovementState(), { axis: 1, climbDown: true }, wallTerrain)
    expect(player.vy).toBeGreaterThan(0)
  })

  it("preserves knockback and eases toward input as recoil ends", () => {
    const player = body({ grounded: false })
    step(player, createPlayerMovementState(), { axis: 1, knockbackTime: 0.3, knockbackVelocity: -155 })
    expect(player.vx).toBeLessThan(0)
    player.x = 20
    step(player, createPlayerMovementState(), { axis: 1, knockbackTime: 0.07, knockbackVelocity: -155 })
    expect(player.vx).toBeGreaterThan(-155)
    expect(player.vx).toBeLessThan(118)
  })
})
