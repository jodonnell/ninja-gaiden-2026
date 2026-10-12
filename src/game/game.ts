import { stages } from "./stages"
import overworldUrl from "../../assets/overworld-sheet.png"
import type { Location } from "./overworld"
import type { DamageResult } from "./combat"
import { GameFlow } from "./flow"
import {
  GameSession,
  completeBoss,
  damagePlayer,
  stepOverworld,
  stepPlaying,
} from "./game-session"
import { Application, Sprite, Texture } from "pixi.js"
import { drawGame } from "./game-renderer"
import { GameInput } from "./game-input"
import { GameController } from "./game-controller"
import { GameStageRuntime, type RuntimeEnemy } from "./game-stage-runtime"
import ryuUrl from "../../assets/ryu-sheet.png"
import enemiesUrl from "../../assets/enemies-sheet.png"
import { WIDTH as W, HEIGHT as H } from "./world"
import { GameAudio } from "./game-audio"
import { GameFeedback } from "./game-feedback"

export async function startGame() {
  const app = new Application()
  await app.init({
    width: W,
    height: H,
    background: "#091321",
    antialias: false,
    resolution: 1,
    autoDensity: false,
  })
  document.querySelector("#game")!.appendChild(app.canvas)
  app.canvas.setAttribute(
    "aria-label",
    "Ninja platformer: arrows to move, Z to jump, X to attack, C to throw shuriken",
  )
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  const texture = Texture.from(canvas)
  texture.source.scaleMode = "nearest"
  app.stage.addChild(new Sprite(texture))
  async function loadSpriteSheet(url: string): Promise<HTMLCanvasElement> {
    const sheet = new Image()
    sheet.src = url
    await sheet.decode()
    const result = document.createElement("canvas")
    result.width = sheet.width
    result.height = sheet.height
    const sc = result.getContext("2d")!
    sc.drawImage(sheet, 0, 0)
    const pixels = sc.getImageData(0, 0, sheet.width, sheet.height)
    const bg = pixels.data.slice(0, 3)
    for (let i = 0; i < pixels.data.length; i += 4)
      if (
        pixels.data[i] === bg[0] &&
        pixels.data[i + 1] === bg[1] &&
        pixels.data[i + 2] === bg[2]
      )
        pixels.data[i + 3] = 0
    sc.putImageData(pixels, 0, 0)
    return result
  }
  const [spriteSheet, enemySheet] = await Promise.all([
    loadSpriteSheet(ryuUrl),
    loadSpriteSheet(enemiesUrl),
  ])
  const ninjaEnemySheet = document.createElement("canvas")
  ninjaEnemySheet.width = spriteSheet.width
  ninjaEnemySheet.height = spriteSheet.height
  const enemyCtx = ninjaEnemySheet.getContext("2d")!
  enemyCtx.filter = "hue-rotate(135deg) saturate(0.8)"
  enemyCtx.drawImage(spriteSheet, 0, 0)
  const overworldSheet = new Image()
  overworldSheet.src = overworldUrl
  await overworldSheet.decode()
  const overlay = document.querySelector<HTMLDivElement>("#overlay")!
  const status = document.querySelector("#status")!
  const flow = new GameFlow()
  const session = new GameSession(flow)
  const runtime = new GameStageRuntime()
  const audio = new GameAudio()
  const feedback = new GameFeedback({
    playCue: ({ frequency, duration, type }) =>
      audio.play(frequency, duration, type),
    burst: (x, y, color, count) => burst(x, y, color, count),
    setStatus: (value) => {
      status.textContent = value
    },
  })
  const controller = new GameController({
    flow,
    view: {
      showOverlay(title, subtitle, button) {
        overlay.classList.remove("hidden")
        overlay.querySelector("h2")!.innerHTML = title
        overlay.querySelector("p")!.textContent = subtitle
        overlay.querySelector("#start")!.innerHTML = button + " <span>→</span>"
        overlay.querySelector(".overlay-kicker")!.textContent =
          "SHADOW OF THE DRAGON"
        overlay.querySelector("small")!.textContent = "PRESS ENTER TO CONTINUE"
      },
      hideOverlay: () => overlay.classList.add("hidden"),
      setLabels(title, context) {
        document.querySelector(".stage-label strong")!.textContent = title
        document.querySelector(".stage-label small")!.textContent = context
      },
      setStatus: (text) => {
        status.textContent = text
      },
    },
    getLives: () => runtime.lives,
    setLives: (value) => {
      runtime.lives = value
    },
    getScore: () => runtime.score,
    getStageName: () =>
      `0${runtime.activeLocation.id + 1} — ${runtime.activeLocation.name}`,
    reset: (full) => runtime.reset(full),
    clearInput: () => input.clear(),
    setMapCooldown: (seconds) => {
      runtime.mapCooldown = seconds
    },
    prepareStage: (location) => runtime.prepareStage(location),
    playCue: (frequency) => audio.play(frequency),
  })
  const returnToMap = () => controller.returnToMap()
  const enterStage = (location: Location) => controller.enterStage(location)
  const begin = () => controller.begin()
  const pause = () => controller.pause()
  document.querySelector("#world-map")!.addEventListener("click", () => {
    returnToMap()
  })
  document.querySelector("#start")!.addEventListener("click", begin)
  const input = new GameInput({
    pointerButtons: document.querySelectorAll<HTMLElement>("[data-key]"),
    onCommand: (command) => {
      if (command === "map") {
        returnToMap()
      } else if (command === "pause") pause()
      else if (command === "gamepadBegin") {
        if (flow.state === "playing" || flow.state === "overworld") pause()
        else begin()
      } else begin()
    },
    onBlur: () => {
      if (flow.state === "playing" || flow.state === "overworld") pause()
    },
    onHidden: () => {
      if (flow.state === "playing" || flow.state === "overworld") pause()
    },
  })
  returnToMap()
  document.querySelector("#sound")!.addEventListener("click", () => {
    const enabled = audio.toggle()
    document.querySelector("#sound")!.textContent = enabled
      ? "SOUND ON"
      : "SOUND OFF"
    audio.play(600)
  })
  document.querySelector("#fullscreen")!.addEventListener("click", () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else
      void document
        .querySelector("#screen")!
        .requestFullscreen()
        .catch(() => {
          status.textContent = "FULLSCREEN UNAVAILABLE"
        })
  })
  function burst(x: number, y: number, color: string, n = 10) {
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
  const fpsLabel = document.querySelector("#fps")!
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
