import { GameFlow } from "../../src/game/flow"
import {
  GameSession,
  completeBoss,
  damagePlayer,
  stepPlaying,
  stepParticles,
  stepProjectiles,
  stepEnemies,
  stepOverworld,
  type GameSessionHandlers,
} from "../../src/game/game-session"
import { spawn, type RoamingEnemy } from "../../src/game/overworld"
import { playerSpawnPosition } from "../../src/game/pickups"
import { platforms } from "../../src/game/world"
import { createPlayerMovementState } from "../../src/game/player-movement"

describe("game session interactions", () => {
  it("takes a lethal hit, retries, and respawns at the checkpoint", () => {
    const flow = new GameFlow()
    flow.state = "playing"
    const player = { hp: 2, lives: 3, invincible: 0 }

    expect(damagePlayer(player, 2, flow)).toBe("dead")
    expect(player).toEqual({ hp: 0, lives: 2, invincible: 1.25 })
    expect(flow.state).toBe("dead")
    expect(flow.begin(player.lives)).toBe("started")
    expect(playerSpawnPosition(1550, platforms)).toEqual({ x: 1550, y: 174 })
    expect(flow.state).toBe("playing")
  })

  it("ignores damage during invulnerability and after the session ends", () => {
    const flow = new GameFlow()
    flow.state = "playing"
    const player = { hp: 8, lives: 3, invincible: 0.5 }

    expect(damagePlayer(player, 2, flow)).toBe("ignored")
    expect(player.hp).toBe(8)
    player.invincible = 0
    flow.state = "won"
    expect(damagePlayer(player, 2, flow)).toBe("ignored")
    expect(player.hp).toBe(8)
  })

  it("records a boss clear once and returns the won session to the map", () => {
    const flow = new GameFlow()
    flow.state = "playing"
    const cleared = new Set<number>()

    expect(completeBoss(flow, cleared, 2)).toBe(true)
    expect(flow.state).toBe("won")
    expect(cleared).toEqual(new Set([2]))
    expect(completeBoss(flow, cleared, 2)).toBe(false)
    expect(flow.begin(3)).toBe("map")
    expect(flow.state).toBe("overworld")
  })
})

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
  const step = (
    overrides: Partial<Parameters<typeof stepOverworld>[0]> = {},
  ) => {
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
    const result = step({
      input: { left: false, right: true, up: false, down: false },
    })

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

describe("projectile and particle simulation", () => {
  it("damages an enemy once and removes the colliding shuriken", () => {
    const enemy = { x: 20, y: 10, w: 12, h: 12, hp: 3, kind: "guard" as const }
    const projectile = {
      x: 0,
      y: 12,
      w: 8,
      h: 8,
      vx: 100,
      vy: 0,
      hostile: false,
      life: 1,
    }
    const hits: number[] = []

    const remaining = stepProjectiles(
      [projectile],
      { x: 100, y: 100, w: 12, h: 12 },
      [enemy],
      0.2,
      (target, result) => hits.push(result.damage + target.hp),
      () => {
        throw new Error("friendly projectile should not hit the player")
      },
    )

    expect(enemy.hp).toBe(1)
    expect(hits).toEqual([3])
    expect(remaining).toEqual([])
  })

  it("damages the player on a hostile projectile collision", () => {
    const projectile = {
      x: 0,
      y: 0,
      w: 8,
      h: 8,
      vx: 100,
      vy: 0,
      hostile: true,
      life: 1,
    }
    const sources: number[] = []

    const remaining = stepProjectiles(
      [projectile],
      { x: 18, y: 0, w: 12, h: 12 },
      [],
      0.2,
      () => {
        throw new Error("hostile projectile should not hit enemies")
      },
      (sourceX) => sources.push(sourceX),
    )

    expect(sources).toEqual([20])
    expect(remaining).toEqual([])
  })

  it("integrates particle motion and removes expired particles", () => {
    const particles = [
      { x: 0, y: 0, vx: 10, vy: -5, life: 1, color: "red" },
      { x: 0, y: 0, vx: 0, vy: 0, life: 0.1, color: "blue" },
    ]

    const remaining = stepParticles(particles, 0.2)

    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toMatchObject({ x: 2, y: -1, vy: 55, life: 0.8 })
  })
})

describe("stage enemy simulation", () => {
  const baseArgs = (
    enemy: Parameters<typeof stepEnemies>[0]["enemies"][number],
  ) => ({
    dt: 1 / 60,
    age: 1,
    stageId: 0,
    player: {
      x: 40,
      y: 100,
      w: 13,
      h: 28,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
    },
    facing: 1,
    enemies: [enemy],
    terrain: [],
    attackActive: false,
    attackId: 1,
    hitEnemies: new Map(),
    onEnemyHit: vi.fn(),
    onPlayerHit: vi.fn(),
    onHostileShot: vi.fn(),
  })

  it("fires a monk projectile toward the player when its attack timer expires", () => {
    const monk = {
      x: 100,
      y: 100,
      w: 14,
      h: 27,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
      hp: 2,
      kind: "monk" as const,
      stride: 0,
      home: 100,
      dir: 1,
      timer: 2.5,
      flash: 0,
    }
    const args = baseArgs(monk)

    stepEnemies(args)

    expect(args.onHostileShot).toHaveBeenCalledWith(
      expect.objectContaining({
        hostile: true,
        vx: -125,
        life: 3,
      }),
    )
    expect(monk.timer).toBe(0)
  })

  it("resolves a sword hit and reports contact damage during one enemy step", () => {
    const guard = {
      x: 50,
      y: 100,
      w: 14,
      h: 27,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
      hp: 2,
      kind: "guard" as const,
      stride: 0,
      home: 50,
      dir: 1,
      timer: 0,
      flash: 0,
    }
    const args = { ...baseArgs(guard), attackActive: true }

    stepEnemies(args)

    expect(guard.hp).toBe(1)
    expect(args.onEnemyHit).toHaveBeenCalledWith(
      guard,
      expect.objectContaining({ damage: 1 }),
    )
    expect(args.onPlayerHit).toHaveBeenCalledWith(2, guard.x)
  })
})

describe("complete playing frame", () => {
  const makeFrame = (overrides: Record<string, unknown> = {}) => {
    const state = {
      hp: 10,
      ammo: 2,
      score: 0,
      lives: 3,
      time: 100,
      attack: 0,
      attackId: 0,
      throwCooldown: 0,
      invincible: 0,
      knockbackTime: 0,
      knockbackVelocity: 0,
      playerStride: 0,
      playerAirTime: 0,
      playerClimbDistance: 0,
      checkpoint: 0,
      shake: 0,
      cam: 0,
      ...overrides,
    }
    const player = {
      x: 64,
      y: 192,
      w: 13,
      h: 28,
      vx: 0,
      vy: 0,
      grounded: true,
      wall: 0,
    }
    const healthPickup = {
      x: 64,
      y: 192,
      w: 10,
      h: 12,
      kind: "health" as const,
      taken: false,
    }
    const callbacks = {
      onDeath: vi.fn(() => 2),
      onJump: vi.fn(),
      onCheckpoint: vi.fn(),
      onAttack: vi.fn(),
      onThrow: vi.fn(),
      onPickup: vi.fn(),
      onEnemyHit: vi.fn(),
      onPlayerHit: vi.fn(() => ({
        hp: 10,
        lives: 3,
        invincible: 1.25,
        knockbackTime: 0.38,
        knockbackVelocity: -155,
      })),
    }
    const args = {
      dt: 1 / 60,
      age: 0,
      stageId: 0,
      height: 270,
      state,
      input: {
        axis: 0,
        jumpPressed: false,
        jumpHeld: false,
        climbUp: false,
        climbDown: false,
        attackPressed: false,
        throwPressed: false,
      },
      player,
      movement: createPlayerMovementState(),
      enemies: [],
      terrain: platforms,
      pickups: [healthPickup],
      shots: [],
      particles: [],
      hitEnemies: new Map(),
      ...callbacks,
    }
    return { args, callbacks, healthPickup }
  }

  it("coordinates an attack, shuriken throw, and pickup in one stage frame", () => {
    const { args, callbacks, healthPickup } = makeFrame({ ammo: 2 })
    args.input.attackPressed = true
    args.input.throwPressed = true

    const result = stepPlaying(args)

    expect(result.state).toMatchObject({
      hp: 16,
      ammo: 1,
      score: 100,
      attackId: 1,
      attack: 0.23,
    })
    expect(result.shots).toHaveLength(1)
    expect(healthPickup.taken).toBe(true)
    expect(callbacks.onAttack).toHaveBeenCalledOnce()
    expect(callbacks.onThrow).toHaveBeenCalledOnce()
    expect(callbacks.onPickup).toHaveBeenCalledWith(healthPickup)
  })

  it("ends a frame at the time limit before advancing player simulation", () => {
    const { args, callbacks } = makeFrame({ time: 0.005 })
    const initialX = args.player.x

    const result = stepPlaying({ ...args, dt: 0.01 })

    expect(result.state.time).toBeLessThanOrEqual(0)
    expect(result.state.lives).toBe(2)
    expect(args.player.x).toBe(initialX)
    expect(callbacks.onDeath).toHaveBeenCalledOnce()
    expect(callbacks.onPickup).not.toHaveBeenCalled()
  })
})
