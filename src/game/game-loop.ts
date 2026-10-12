import { stages } from "./stages"
import type { DamageResult } from "./combat"
import { GameFlow } from "./flow"
import {
  completeBoss,
  damagePlayer,
  stepOverworld,
  stepPlaying,
  GameSession,
} from "./game-session"
import { Application, type Texture } from "pixi.js"
import { drawGame } from "./game-renderer"
import { GameInput } from "./game-input"
import { GameController } from "./game-controller"
import { GameStageRuntime, type RuntimeEnemy } from "./game-stage-runtime"
import { HEIGHT as H } from "./world"
import { GameFeedback } from "./game-feedback"
import type { Location } from "./overworld"
import { MAP_TOP, TILE } from "./overworld"

export function burst(
  runtime: GameStageRuntime,
  x: number,
  y: number,
  color: string,
  n = 10,
) {
  for (let i = 0; i < n; i++)
    runtime.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.7) * 160,
      life: 0.2 + Math.random() * 0.3,
      color,
    })
}

export type GameLoopOptions = {
  app: Application
  ctx: CanvasRenderingContext2D
  texture: Texture
  spriteSheet: HTMLCanvasElement
  ninjaEnemySheet: HTMLCanvasElement
  enemySheet: HTMLCanvasElement
  overworldSheet: HTMLImageElement
  flow: GameFlow
  session: GameSession
  runtime: GameStageRuntime
  input: GameInput
  controller: GameController
  feedback: GameFeedback
  fpsLabel: HTMLElement
  enterStage(location: Location): void
}

export function runGameLoop(options: GameLoopOptions) {
  const {
    app,
    ctx,
    texture,
    spriteSheet,
    ninjaEnemySheet,
    enemySheet,
    overworldSheet,
    flow,
    session,
    runtime,
    input,
    controller,
    feedback,
    fpsLabel,
    enterStage,
  } = options
  function die() {
    // Environmental deaths bypass the hit and invulnerability rules.
    return controller.die()
  }
  function hurt(amount: number, from: number) {
    const vitals = {
      hp: runtime.hp,
      lives: runtime.lives,
      invincible: runtime.invincible,
    }
    const damage = damagePlayer(vitals, amount, flow)
    if (damage === "ignored")
      return {
        ...vitals,
        knockbackTime: runtime.knockbackTime,
        knockbackVelocity: runtime.knockbackVelocity,
      }
    runtime.hp = vitals.hp
    runtime.lives = vitals.lives
    runtime.invincible = vitals.invincible
    runtime.knockbackTime = 0.38
    runtime.knockbackVelocity = runtime.player.x < from ? -155 : 155
    runtime.player.vx = runtime.knockbackVelocity
    runtime.player.vy = -175
    runtime.movement.wallJumpLock = 0
    runtime.movement.wallGrace = 0
    runtime.movement.lastWall = 0
    runtime.movement.jumpBuffer = 0
    runtime.movement.coyote = 0
    runtime.shake = 0.18
    feedback.playerHit(runtime.player.x + 7, runtime.player.y + 12)
    if (damage === "dead") controller.showDeath()
    return {
      ...vitals,
      knockbackTime: runtime.knockbackTime,
      knockbackVelocity: runtime.knockbackVelocity,
    }
  }
  function hit(e: RuntimeEnemy, result: DamageResult) {
    if (result.damage === 0) return
    e.flash = 0.14
    feedback.enemyHit(e.x + e.w / 2, e.y + 12, result.defeated, e.x, e.y)
    if (result.defeated) {
      if (e.kind === "boss") {
        if (!completeBoss(flow, runtime.cleared, runtime.activeLocation.id))
          return
        controller.stageCleared(stages[runtime.activeLocation.id].boss)
      }
    }
  }
  function update(dt: number) {
    const controls = input.snapshot()
    runtime.age += dt
    session.update(dt, {
      transition: (step) => {
        flow.updateTransition(step)
        input.clearPressed()
      },
      overworld: (dt) => {
        const result = stepOverworld({
          dt,
          cooldown: runtime.mapCooldown,
          position: runtime.mapPosition,
          visual: runtime.mapVisual,
          enemies: runtime.mapEnemies,
          input: {
            left: controls.left,
            right: controls.right,
            up: controls.up,
            down: controls.down,
          },
        })
        runtime.mapPosition = result.position
        runtime.mapCooldown = result.cooldown
        runtime.particles = runtime.particles.filter((particle) => particle.life > 0)
        for (const particle of runtime.particles) {
          particle.x += particle.vx * dt
          particle.y += particle.vy * dt
          particle.vy += 300 * dt
          particle.life -= dt
        }
        for (const enemy of result.fizzled ?? [])
          burst(runtime, enemy.x * TILE + TILE / 2, MAP_TOP + enemy.y * TILE + TILE / 2, "#b95862", 12)
        if (result.location) enterStage(result.location)
        input.clearPressed()
      },
      inactive: () => {
        input.clearPressed()
      },
      playing: (dt) => {
        const state = {
          hp: runtime.hp,
          ammo: runtime.ammo,
          score: runtime.score,
          lives: runtime.lives,
          time: runtime.time,
          attack: runtime.attack,
          attackId: runtime.attackId,
          throwCooldown: runtime.throwCooldown,
          invincible: runtime.invincible,
          knockbackTime: runtime.knockbackTime,
          knockbackVelocity: runtime.knockbackVelocity,
          playerStride: runtime.playerStride,
          playerAirTime: runtime.playerAirTime,
          playerClimbDistance: runtime.playerClimbDistance,
          checkpoint: runtime.checkpoint,
          shake: runtime.shake,
          cam: runtime.cam,
        }
        const result = stepPlaying({
          dt,
          age: runtime.age,
          stageId: runtime.activeLocation.id,
          height: H,
          state,
          input: {
            axis: controls.axis,
            jumpPressed: controls.jumpPressed,
            jumpHeld: controls.jumpHeld,
            climbUp: controls.climbUp,
            climbDown: controls.climbDown,
            attackPressed: controls.attackPressed,
            throwPressed: controls.throwPressed,
          },
          player: runtime.player,
          movement: runtime.movement,
          enemies: runtime.enemies,
          terrain: runtime.stagePlatforms,
          pickups: runtime.pickups,
          shots: runtime.shots,
          particles: runtime.particles,
          hitEnemies: runtime.hitEnemies,
          onDeath: die,
          onJump: () => feedback.jump(),
          onCheckpoint: () => feedback.checkpoint(),
          onAttack: () => feedback.attack(),
          onThrow: () => feedback.throw(),
          onPickup: (item) => feedback.pickup(item.x, item.y),
          onEnemyHit: (enemy, damage) => {
            runtime.score += damage.score
            hit(enemy, damage)
          },
          onPlayerHit: (amount, sourceX) => {
            runtime.hp = state.hp
            runtime.lives = state.lives
            runtime.invincible = state.invincible
            runtime.knockbackTime = state.knockbackTime
            runtime.knockbackVelocity = state.knockbackVelocity
            return hurt(amount, sourceX)
          },
        })
        ;({ shots: runtime.shots, particles: runtime.particles } = result)
        Object.assign(runtime, state)
        input.clearPressed()
      },
    })
  }
  function draw() {
    drawGame({
      ctx,
      texture,
      spriteSheet,
      ninjaEnemySheet,
      enemySheet,
      overworldSheet,
      flow,
      activeLocation: runtime.activeLocation,
      stagePlatforms: runtime.stagePlatforms,
      cam: runtime.cam,
      age: runtime.age,
      cleared: runtime.cleared,
      mapVisual: runtime.mapVisual,
      mapEnemies: runtime.mapEnemies,
      stageName: `0${runtime.activeLocation.id + 1} — ${runtime.activeLocation.name}`,
      shake: runtime.shake,
      enemies: runtime.enemies,
      pickups: runtime.pickups,
      shots: runtime.shots,
      player: runtime.player,
      movement: runtime.movement,
      invincible: runtime.invincible,
      attack: runtime.attack,
      playerStride: runtime.playerStride,
      playerAirTime: runtime.playerAirTime,
      playerClimbDistance: runtime.playerClimbDistance,
      particles: runtime.particles,
      hp: runtime.hp,
      score: runtime.score,
      time: runtime.time,
      lives: runtime.lives,
      ammo: runtime.ammo,
    })
  }
  let frameCount = 0
  let fpsWindowStart = performance.now()
  app.ticker.add((ticker) => {
    frameCount++
    const now = performance.now()
    if (now - fpsWindowStart >= 1000) {
      fpsLabel.textContent = `${Math.round((frameCount * 1000) / (now - fpsWindowStart))} FPS`
      frameCount = 0
      fpsWindowStart = now
    }
    session.advance(ticker.deltaMS / 1000, update)
    draw()
  })
}
