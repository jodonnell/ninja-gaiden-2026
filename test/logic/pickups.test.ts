import { collectPickup, consumeAmmo, playerSpawnPosition, updateCheckpoint } from "../../src/game/pickups"

describe("pickups and checkpoints", () => {
  it("caps health, adds score, and marks the pickup collected", () => {
    const pickup = { x: 0, y: 0, w: 10, h: 12, kind: "health" as const, taken: false }
    const stats = { hp: 13, ammo: 4, score: 25 }
    expect(collectPickup(pickup, stats, true)).toEqual({ hp: 16, ammo: 4, score: 125 })
    expect(pickup.taken).toBe(true)
    expect(collectPickup(pickup, stats, true)).toBeUndefined()
  })

  it("adds ammo and score only when an ammo pickup overlaps the player", () => {
    const pickup = { x: 0, y: 0, w: 10, h: 12, kind: "ammo" as const, taken: false }
    const stats = { hp: 8, ammo: 0, score: 100 }
    expect(collectPickup(pickup, stats, false)).toBeUndefined()
    expect(pickup.taken).toBe(false)
    expect(collectPickup(pickup, stats, true)).toEqual({ hp: 8, ammo: 8, score: 200 })
  })

  it("cannot consume ammo below zero", () => {
    expect(consumeAmmo(1)).toBe(0)
    expect(consumeAmmo(0)).toBeUndefined()
  })

  it("activates the checkpoint once the player passes its trigger", () => {
    expect(updateCheckpoint(0, 1545)).toBe(0)
    expect(updateCheckpoint(0, 1546)).toBe(1550)
    expect(updateCheckpoint(1550, 2000)).toBe(1550)
  })

  it("computes initial and checkpoint respawn positions from the terrain floor", () => {
    const terrain = [{ x: 0, y: 220, w: 600, h: 80 }, { x: 1500, y: 202, w: 320, h: 100 }]
    expect(playerSpawnPosition(0, terrain)).toEqual({ x: 64, y: 192 })
    expect(playerSpawnPosition(1550, terrain)).toEqual({ x: 1550, y: 174 })
  })
})
