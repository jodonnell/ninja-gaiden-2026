import { GameStageRuntime } from "../../src/game/game-stage-runtime"
import { locations } from "../../src/game/overworld"
import { stages } from "../../src/game/stages"

describe("game stage runtime", () => {
  it("initializes the first stage with its player, enemies, and pickups", () => {
    const runtime = new GameStageRuntime()

    expect(runtime.activeLocation).toBe(locations[0])
    expect(runtime.player).toMatchObject({ x: 64, w: 13, h: 28 })
    expect(runtime.enemies).toHaveLength(15)
    expect(runtime.enemies.at(-1)).toMatchObject({
      kind: "boss",
      hp: 24,
      x: 3090,
    })
    expect(runtime.pickups).toHaveLength(8)
    expect(runtime.pickups.every((pickup) => !pickup.taken)).toBe(true)
  })

  it("prepares a stage and fully resets its mutable gameplay state", () => {
    const runtime = new GameStageRuntime()
    runtime.score = 1200
    runtime.lives = 2
    runtime.checkpoint = 1550
    runtime.prepareStage(locations[1])

    expect(runtime.activeLocation).toBe(locations[1])
    expect(runtime.stagePlatforms).toBe(stages[1].terrain)
    expect(runtime.checkpoint).toBe(0)
    expect(runtime.player.x).toBe(64)
    expect(runtime.enemies.filter((enemy) => enemy.kind === "boss")[0].hp).toBe(
      28,
    )
    expect(runtime.pickups.length).toBe(runtime.stagePlatforms.length - 1)
    expect(runtime.score).toBe(1200)
    expect(runtime.lives).toBe(2)
    expect(runtime.hp).toBe(16)
    expect(runtime.ammo).toBe(12)
  })

  it("retries from the checkpoint and restores stage populations", () => {
    const runtime = new GameStageRuntime()
    const enemyCount = runtime.enemies.length
    runtime.checkpoint = 1550
    runtime.hp = 3
    runtime.ammo = 1
    runtime.pickups[0].taken = true
    runtime.shots.push({
      x: 1,
      y: 2,
      w: 3,
      h: 4,
      vx: 0,
      vy: 0,
      hostile: false,
      life: 1,
    })
    runtime.score = 500
    runtime.lives = 2

    runtime.reset(false)

    expect(runtime.player.x).toBe(1550)
    expect(runtime.hp).toBe(16)
    expect(runtime.ammo).toBe(12)
    expect(runtime.pickups[0].taken).toBe(false)
    expect(runtime.enemies).toHaveLength(enemyCount)
    expect(runtime.shots).toHaveLength(0)
    expect(runtime.score).toBe(500)
    expect(runtime.lives).toBe(2)

    runtime.reset(true)
    expect(runtime.checkpoint).toBe(0)
    expect(runtime.player.x).toBe(64)
    expect(runtime.score).toBe(0)
    expect(runtime.lives).toBe(3)
  })
})
