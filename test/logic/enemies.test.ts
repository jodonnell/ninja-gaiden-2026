import { patrolDirection } from "../../src/game/enemies"
import { move } from "../../src/game/world"
import type { Body } from "../../src/game/world"
const guard = (x: number): Body => ({
  x,
  y: 192,
  w: 14,
  h: 28,
  vx: 0,
  vy: 0,
  wall: 0,
  grounded: true,
})
describe("guard patrol regression", () => {
  it("returns from an overshot boundary instead of flipping every frame", () => {
    const e = guard(389)
    let dir = 1
    let turns = 0
    for (let frame = 0; frame < 90; frame++) {
      const next = patrolDirection(e, 340, dir)
      if (next !== dir) turns++
      dir = next
      e.vx = dir * 35
      e.vy = 730 / 60
      move(e, 1 / 60)
    }
    expect(turns).toBe(1)
    expect(e.x).toBeLessThan(340)
  })
  it("traverses the full patrol repeatedly without rapid reversals", () => {
    const e = guard(340)
    let dir = -1
    const turns: number[] = []
    for (let frame = 0; frame < 720; frame++) {
      const next = patrolDirection(e, 340, dir)
      if (next !== dir) turns.push(frame)
      dir = next
      e.vx = dir * 35
      e.vy = 730 / 60
      move(e, 1 / 60)
    }
    expect(turns.length).toBeGreaterThan(3)
    for (let i = 1; i < turns.length; i++)
      expect(turns[i] - turns[i - 1]).toBeGreaterThan(150)
  })
  it("turns around at a rooftop edge before falling", () => {
    const e = guard(526)
    expect(patrolDirection(e, 520, 1)).toBe(-1)
  })
  it("turns away from a contacted wall", () => {
    const e = guard(340)
    e.wall = 1
    expect(patrolDirection(e, 340, 1)).toBe(-1)
  })
})
