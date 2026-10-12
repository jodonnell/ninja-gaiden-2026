import { floorAt, stages } from "../../src/game/stages"
import { move, overlaps, type Body } from "../../src/game/world"

describe("biome stage layouts", () => {
  for (const [id, stage] of stages.entries()) {
    it(`stage ${id + 1} has safe spawn, checkpoint, enemy, and boss positions`, () => {
      for (const x of [64, 1550, 3090, ...stage.guards.map((e) => e.x)]) {
        expect(Number.isFinite(floorAt(stage.terrain, x))).toBe(true)
      }
      for (let i = 0; i < stage.terrain.length; i++)
        for (let j = i + 1; j < stage.terrain.length; j++)
          expect(overlaps(stage.terrain[i], stage.terrain[j])).toBe(false)
    })
    if (id === 0) continue
    it(`stage ${id + 1} lets a full jump cross every required gap`, () => {
      for (let i = 0; i < stage.terrain.length - 1; i++) {
        const from = stage.terrain[i],
          to = stage.terrain[i + 1]
        const player: Body = {
          x: from.x + from.w - 24,
          y: from.y - 28,
          w: 13,
          h: 28,
          vx: 118,
          vy: -282,
          wall: 0,
          grounded: false,
        }
        for (let frame = 0; frame < 90; frame++) {
          player.vy += 730 / 60
          move(player, 1 / 60, stage.terrain)
          if (player.grounded) break
        }
        expect(player.grounded, `gap at ${from.x + from.w}`).toBe(true)
        expect(player.x + player.w).toBeGreaterThan(to.x)
        expect(player.y + player.h).toBe(to.y)
      }
    })
  }
  it("gives the biomes distinct enemy rosters", () => {
    expect(stages[1].guards.every((e) => e.kind === "hopper")).toBe(true)
    expect(stages[2].guards.every((e) => e.kind === "monk")).toBe(true)
    expect(stages[2].flyers.every((e) => e.kind === "bat")).toBe(true)
  })
})
