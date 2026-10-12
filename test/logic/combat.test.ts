import { damageEnemy, resolveShurikenHit, resolveSwordHit } from "../../src/game/combat"

describe("combat rules", () => {
  it("damages an enemy and awards kind-specific score only on defeat", () => {
    const bird = { hp: 2, kind: "bird" as const }
    expect(damageEnemy(bird, 1)).toEqual({ damage: 1, defeated: false, score: 0 })
    expect(bird.hp).toBe(1)
    expect(damageEnemy(bird, 1)).toEqual({ damage: 1, defeated: true, score: 150 })
  })

  it("awards the boss score and reports defeat when the last damage lands", () => {
    const boss = { hp: 2, kind: "boss" as const }
    expect(damageEnemy(boss, 2)).toEqual({ damage: 2, defeated: true, score: 5000 })
    expect(damageEnemy(boss, 1)).toEqual({ damage: 0, defeated: false, score: 0 })
  })

  it("allows one sword hit per enemy per attack and a new hit on the next attack", () => {
    const enemy = { hp: 3, kind: "guard" as const }
    const ledger = new Map()
    expect(resolveSwordHit(enemy, 1, ledger)?.damage).toBe(1)
    expect(resolveSwordHit(enemy, 1, ledger)).toBeUndefined()
    expect(enemy.hp).toBe(2)
    expect(resolveSwordHit(enemy, 2, ledger)?.damage).toBe(1)
    expect(enemy.hp).toBe(1)
  })

  it("applies shuriken damage and ignores already defeated enemies", () => {
    const enemy = { hp: 2, kind: "hopper" as const }
    expect(resolveShurikenHit(enemy)).toEqual({ damage: 2, defeated: true, score: 200 })
    expect(resolveShurikenHit(enemy)).toBeUndefined()
    expect(enemy.hp).toBe(0)
  })
})
