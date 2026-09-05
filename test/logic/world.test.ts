import { move, overlaps, platforms } from "../../src/game/world"
import type { Body } from "../../src/game/world"
const body = (overrides: Partial<Body> = {}): Body => ({
  x: 20,
  y: 180,
  w: 13,
  h: 28,
  vx: 0,
  vy: 150,
  grounded: false,
  wall: 0,
  ...overrides,
})
describe("platform collisions", () => {
  it("lands on a roof and clears downward speed", () => {
    const p = body()
    move(p, 0.1)
    expect(p.y).toBe(192)
    expect(p.grounded).toBe(true)
    expect(p.vy).toBe(0)
  })
  it("detects the side of a wall for gripping", () => {
    const p = body({ x: 220, y: 160, vx: 118, vy: 0 })
    move(p, 0.1)
    expect(p.x).toBe(227)
    expect(p.wall).toBe(1)
  })
  it("stops upward movement on the underside of a platform", () => {
    const p = body({ x: 260, y: 185, vy: -200 })
    move(p, 0.05)
    expect(p.y).toBe(182)
    expect(p.vy).toBe(0)
    expect(p.grounded).toBe(false)
  })
  it("falls through a gap without a false landing", () => {
    const p = body({ x: 560, y: 205 })
    move(p, 0.1)
    expect(p.y).toBe(220)
    expect(p.grounded).toBe(false)
  })
  it("can clear the widest rooftop gap with a full jump", () => {
    const p = body({ x: 1830, y: 174, vx: 118, vy: -282 })
    let landed = false
    for (let i = 0; i < 60; i++) {
      p.vy += 730 / 60
      move(p, 1 / 60)
      if (p.grounded) {
        landed = true
        break
      }
    }
    expect(landed).toBe(true)
    expect(p.x).toBeGreaterThan(1907)
    expect(p.y).toBe(192)
  })
  it("does not treat touching edges as a hit", () => {
    expect(
      overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }),
    ).toBe(false)
  })
  it("has no overlapping terrain solids", () => {
    for (let i = 0; i < platforms.length; i++)
      for (let j = i + 1; j < platforms.length; j++)
        expect(overlaps(platforms[i], platforms[j])).toBe(false)
  })
})
