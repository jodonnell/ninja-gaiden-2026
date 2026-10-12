import { stages, floorAt, type EnemyKind } from "./stages"
import { locations, spawn, type Location, type RoamingEnemy } from "./overworld"
import {
  createPlayerMovementState,
  resetPlayerMovementState,
} from "./player-movement"
import { playerSpawnPosition, type Pickup } from "./pickups"
import { platforms, type Body, type Rect } from "./world"
import type {
  SessionEnemy,
  SessionParticle,
  SessionProjectile,
} from "./game-session"

export type RuntimeEnemy = SessionEnemy & { hp: number; kind: EnemyKind }
export type RuntimeParticle = SessionParticle & { color: string }
export type RuntimeProjectile = SessionProjectile

const initialMapEnemies: RoamingEnemy[] = [
  { x: 3.5, y: 4.5, vx: 1.2, vy: 0.7 },
  { x: 8.5, y: 2.5, vx: -0.8, vy: 1.1 },
  { x: 11.5, y: 5.5, vx: 0.9, vy: -1.0 },
  { x: 17.5, y: 9.5, vx: -1.1, vy: 0.8 },
  { x: 22.5, y: 4.5, vx: 1.0, vy: 0.9 },
  { x: 27.5, y: 8.5, vx: -0.9, vy: -0.8 },
]

/** Owns mutable map and stage state, including deterministic stage population and resets. */
export class GameStageRuntime {
  activeLocation = locations[0]
  readonly cleared = new Set<number>()
  readonly mapEnemies = initialMapEnemies.map((enemy) => ({ ...enemy }))
  mapPosition = { ...spawn }
  readonly mapVisual = { ...spawn }
  mapCooldown = 0
  stagePlatforms: Rect[] = platforms
  player: Body = this.createPlayer()
  enemies: RuntimeEnemy[] = []
  particles: RuntimeParticle[] = []
  shots: RuntimeProjectile[] = []
  pickups: Pickup[] = []
  hp = 16
  ammo = 12
  score = 0
  lives = 3
  time = 180
  cam = 0
  age = 0
  attack = 0
  throwCooldown = 0
  invincible = 0
  knockbackTime = 0
  knockbackVelocity = 0
  playerStride = 0
  playerAirTime = 0
  playerClimbDistance = 0
  checkpoint = 0
  shake = 0
  attackId = 0
  readonly movement = createPlayerMovementState()
  readonly hitEnemies = new Map<RuntimeEnemy, number>()

  constructor() {
    this.reset(true)
  }

  prepareStage(location: Location) {
    this.activeLocation = location
    this.checkpoint = 0
    this.stagePlatforms = stages[location.id].terrain
    this.reset(false)
  }

  reset(full: boolean) {
    if (full) {
      this.score = 0
      this.lives = 3
      this.checkpoint = 0
    }
    this.hp = 16
    this.ammo = 12
    this.time = 180
    this.player = {
      ...playerSpawnPosition(this.checkpoint, this.stagePlatforms),
      w: 13,
      h: 28,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
    }
    this.cam = Math.max(0, this.player.x - 120)
    this.particles = []
    this.shots = []
    this.attack = 0
    resetPlayerMovementState(this.movement)
    this.playerStride = 0
    this.playerAirTime = 0
    this.playerClimbDistance = 0
    this.throwCooldown = 0
    this.invincible = 1
    this.knockbackTime = 0
    this.knockbackVelocity = 0
    this.hitEnemies.clear()
    this.populate()
  }

  private createPlayer(): Body {
    return {
      ...playerSpawnPosition(this.checkpoint, this.stagePlatforms),
      w: 13,
      h: 28,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
    }
  }

  private populate() {
    const stage = stages[this.activeLocation.id]
    this.enemies = stage.guards.map(({ x, kind }, i) => ({
      x,
      y: floorAt(this.stagePlatforms, x) - 27,
      w: 14,
      h: 27,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
      hp: kind === "guard" ? 1 : 2,
      kind,
      stride: 0,
      home: x,
      dir: i % 2 ? 1 : -1,
      timer: i * 0.2,
      flash: 0,
    }))
    for (const { x, kind } of stage.flyers)
      this.enemies.push({
        x,
        y: 100,
        w: 18,
        h: 12,
        vx: 0,
        vy: 0,
        grounded: false,
        wall: 0,
        hp: 1,
        kind,
        stride: 0,
        home: x,
        dir: -1,
        timer: 0,
        flash: 0,
      })
    this.enemies.push({
      x: 3090,
      y: 180,
      w: 24,
      h: 38,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
      hp: 24 + this.activeLocation.id * 4,
      kind: "boss",
      stride: 0,
      home: 3090,
      dir: -1,
      timer: 1,
      flash: 0,
    })
    this.pickups = [
      { x: 271, y: 150, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 747, y: 142, w: 10, h: 12, kind: "health", taken: false },
      { x: 1080, y: 121, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 1410, y: 137, w: 10, h: 12, kind: "health", taken: false },
      { x: 1695, y: 126, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 2050, y: 138, w: 10, h: 12, kind: "health", taken: false },
      { x: 2430, y: 119, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 2750, y: 199, w: 10, h: 12, kind: "health", taken: false },
    ]
    if (this.activeLocation.id > 0)
      this.pickups = this.stagePlatforms.slice(0, -1).map((platform, i) => ({
        x: platform.x + platform.w * 0.65,
        y: platform.y - 20,
        w: 10,
        h: 12,
        kind: i % 3 === 1 ? "health" : "ammo",
        taken: false,
      }))
  }
}
