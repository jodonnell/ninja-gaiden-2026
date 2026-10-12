import type { GameFlow } from "./flow"
import {
  resolveShurikenHit,
  resolveSwordHit,
  type Combatant,
  type DamageResult,
} from "./combat"
import { patrolDirection } from "./enemies"
import { move, overlaps, type Body, type Rect } from "./world"
import {
  locationAt,
  roamingEncounter,
  updateRoamingEnemies,
  walkable,
  type Location,
  type RoamingEnemy,
} from "./overworld"

export type MapPosition = { x: number; y: number }
export type OverworldInput = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

export type SessionProjectile = Rect & {
  vx: number
  vy: number
  hostile: boolean
  life: number
}
export type SessionParticle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export type SessionEnemy = Body & Combatant & {
  stride: number
  home: number
  dir: number
  timer: number
  flash: number
}

export type SessionVitals = { hp: number; lives: number; invincible: number }

/** Applies a gameplay hit and records whether it ended the current life. */
export function damagePlayer(
  vitals: SessionVitals,
  amount: number,
  flow: GameFlow,
): "ignored" | "hit" | "dead" {
  if (flow.state !== "playing" || vitals.invincible > 0 || amount <= 0)
    return "ignored"
  vitals.hp -= amount
  vitals.invincible = 1.25
  if (vitals.hp > 0) return "hit"
  vitals.lives--
  flow.state = "dead"
  return "dead"
}

/** Records a boss clear once and moves the session to its win state. */
export function completeBoss(
  flow: GameFlow,
  clearedStages: Set<number>,
  stageId: number,
) {
  if (flow.state !== "playing" || clearedStages.has(stageId)) return false
  clearedStages.add(stageId)
  flow.state = "won"
  return true
}

/** Advances projectiles, resolving player and enemy collisions. */
export function stepProjectiles<
  TShot extends SessionProjectile,
  TEnemy extends Rect & Combatant,
>(
  shots: TShot[],
  player: Rect,
  enemies: TEnemy[],
  dt: number,
  onEnemyHit: (enemy: TEnemy, result: DamageResult) => void,
  onPlayerHit: (sourceX: number) => void,
): TShot[] {
  for (const shot of shots) {
    shot.x += shot.vx * dt
    shot.y += shot.vy * dt
    shot.life -= dt
    if (shot.hostile) {
      if (overlaps(shot, player)) {
        onPlayerHit(shot.x)
        shot.life = 0
      }
    } else {
      for (const enemy of enemies)
        if (enemy.hp > 0 && overlaps(shot, enemy)) {
          const result = resolveShurikenHit(enemy)
          if (result) onEnemyHit(enemy, result)
          shot.life = 0
          break
        }
    }
  }
  return shots.filter((shot) => shot.life > 0)
}

/** Advances short lived combat particles independently of drawing. */
export function stepParticles<T extends SessionParticle>(
  particles: T[],
  dt: number,
): T[] {
  for (const particle of particles) {
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vy += 300 * dt
    particle.life -= dt
  }
  return particles.filter((particle) => particle.life > 0)
}

/** Advances nearby stage enemies and resolves their attacks and contact. */
export function stepEnemies<TEnemy extends SessionEnemy>(args: {
  dt: number
  age: number
  stageId: number
  facing: number
  player: Body
  enemies: TEnemy[]
  terrain: Rect[]
  attackActive: boolean
  attackId: number
  hitEnemies: Map<Combatant, number>
  onEnemyHit(enemy: TEnemy, result: DamageResult): void
  onPlayerHit(amount: number, sourceX: number): void
  onHostileShot(shot: SessionProjectile): void
}): void {
  const {
    dt,
    age,
    stageId,
    facing,
    player,
    enemies,
    terrain,
    attackActive,
    attackId,
    hitEnemies,
    onEnemyHit,
    onPlayerHit,
    onHostileShot,
  } = args
  const blade = {
    x: facing > 0 ? player.x + 8 : player.x - 28,
    y: player.y + 3,
    w: 33,
    h: 25,
  }

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || Math.abs(enemy.x - player.x) > 550) continue
    enemy.flash -= dt
    enemy.timer += dt
    if (enemy.kind === "bat") {
      enemy.dir = player.x < enemy.x ? -1 : 1
      enemy.x += enemy.dir * 42 * dt
      enemy.y = 150 + Math.sin(enemy.timer * 4 + enemy.home) * 38
    } else if (enemy.kind === "bird") {
      enemy.x -= (stageId === 1 ? 78 : 65) * dt
      if (stageId === 1) enemy.y = 115 + Math.sin(enemy.timer * 2.8) * 62
      else enemy.y += Math.sin(age * 5 + enemy.home) * 45 * dt
    } else {
      if (enemy.kind === "boss") {
        if (player.x > 2820) {
          enemy.dir = player.x < enemy.x ? -1 : 1
          enemy.vx = enemy.dir * (stageId === 1 ? 95 : stageId === 2 ? 28 : 60)
          if (enemy.timer > (stageId === 1 ? 1.25 : 1.8)) {
            enemy.timer = 0
            enemy.vy = stageId === 2 ? -130 : -240
            for (const velocityY of stageId === 2 ? [-55, 0, 55] : [0])
              onHostileShot({
                x: enemy.x,
                y: enemy.y + 15,
                w: 8,
                h: 8,
                vx: enemy.dir * 155,
                vy: velocityY,
                hostile: true,
                life: 3,
              })
          }
        }
      } else if (enemy.kind === "monk") {
        enemy.vx = 0
        enemy.dir = player.x < enemy.x ? -1 : 1
        if (enemy.timer > 2.2 && Math.abs(enemy.x - player.x) < 310) {
          enemy.timer = 0
          onHostileShot({
            x: enemy.x + enemy.dir * 10,
            y: enemy.y + 10,
            w: 8,
            h: 8,
            vx: enemy.dir * 125,
            vy: 0,
            hostile: true,
            life: 3,
          })
        }
      } else {
        enemy.dir = patrolDirection(enemy, enemy.home, enemy.dir, terrain)
        enemy.vx = enemy.dir * (enemy.kind === "hopper" ? 55 : 35)
        if (enemy.kind === "hopper" && enemy.grounded && enemy.timer > 1.4) {
          enemy.vy = -230
          enemy.timer = 0
        }
      }
      enemy.vy += 730 * dt
      const previousEnemyX = enemy.x
      move(enemy, dt, terrain)
      if (enemy.grounded) enemy.stride += Math.abs(enemy.x - previousEnemyX)
    }
    if (attackActive && overlaps(blade, enemy)) {
      const result = resolveSwordHit(enemy, attackId, hitEnemies)
      if (result) onEnemyHit(enemy, result)
    }
    if (enemy.hp > 0 && overlaps(player, enemy))
      onPlayerHit(enemy.kind === "boss" ? 3 : 2, enemy.x)
  }
}

/** Advances map encounters, player movement, and the visual map marker. */
export function stepOverworld(args: {
  dt: number
  cooldown: number
  position: MapPosition
  visual: MapPosition
  enemies: RoamingEnemy[]
  input: OverworldInput
}): { position: MapPosition; cooldown: number; location?: Location } {
  const { dt, visual, enemies, input } = args
  let { cooldown, position } = args
  cooldown -= dt
  visual.x += (position.x - visual.x) * Math.min(1, dt * 22)
  visual.y += (position.y - visual.y) * Math.min(1, dt * 22)
  updateRoamingEnemies(enemies, dt)

  const encounter =
    cooldown <= 0 ? roamingEncounter(enemies, position) : undefined
  if (encounter) return { position, cooldown, location: encounter }

  if (cooldown <= 0) {
    const dx = Number(input.right) - Number(input.left)
    const dy = dx ? 0 : Number(input.down) - Number(input.up)
    if ((dx || dy) && walkable(position.x + dx, position.y + dy)) {
      position = { x: position.x + dx, y: position.y + dy }
      cooldown = 0.14
      return {
        position,
        cooldown,
        location: locationAt(position.x, position.y),
      }
    }
  }
  return { position, cooldown }
}

/** Coordinates the simulation phase without depending on browser or renderer APIs. */
export type GameSessionHandlers = {
  transition(dt: number): void
  overworld(dt: number): void
  playing(dt: number): void
  inactive(): void
}

export class GameSession {
  private accumulator = 0

  constructor(readonly flow: GameFlow) {}

  /** Runs the simulation at a stable rate and limits catch-up after a stalled frame. */
  advance(elapsedSeconds: number, update: (dt: number) => void) {
    this.accumulator += Math.min(elapsedSeconds, 0.1)
    let steps = 0
    while (this.accumulator >= 1 / 60) {
      update(1 / 60)
      this.accumulator -= 1 / 60
      steps++
    }
    return steps
  }

  update(dt: number, handlers: GameSessionHandlers) {
    if (this.flow.state === "transition") {
      handlers.transition(dt)
      return
    }
    if (this.flow.state === "overworld") {
      handlers.overworld(dt)
      return
    }
    if (this.flow.state === "playing") {
      handlers.playing(dt)
      return
    }
    handlers.inactive()
  }
}
