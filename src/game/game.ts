import { stages, floorAt, type EnemyKind } from "./stages"
import overworldUrl from "../../assets/overworld-sheet.png"
import {
  locations,
  spawn,
  type RoamingEnemy,
} from "./overworld"
import { createPlayerMovementState, resetPlayerMovementState } from "./player-movement"
import type { DamageResult } from "./combat"
import { playerSpawnPosition, type Pickup } from "./pickups"
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
import ryuUrl from "../../assets/ryu-sheet.png"
import enemiesUrl from "../../assets/enemies-sheet.png"
import {
  WIDTH as W,
  HEIGHT as H,
  platforms,
} from "./world"
import type { Body, Rect } from "./world"

type Enemy = Body & {
  hp: number
  kind: EnemyKind
  stride: number
  home: number
  dir: number
  timer: number
  flash: number
}
type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}
type Shot = Rect & { vx: number; vy: number; hostile: boolean; life: number }

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
  let activeLocation = locations[0]
  const cleared = new Set<number>()
  const mapEnemies: RoamingEnemy[] = [
    { x: 3.5, y: 4.5, vx: 1.2, vy: 0.7 },
    { x: 8.5, y: 2.5, vx: -0.8, vy: 1.1 },
    { x: 11.5, y: 5.5, vx: 0.9, vy: -1.0 },
    { x: 17.5, y: 9.5, vx: -1.1, vy: 0.8 },
    { x: 22.5, y: 4.5, vx: 1.0, vy: 0.9 },
    { x: 27.5, y: 8.5, vx: -0.9, vy: -0.8 },
  ]
  let mapPosition = { ...spawn }
  const mapVisual = { ...spawn }
  let mapCooldown = 0
  let stagePlatforms = platforms
  let player: Body
  let enemies: Enemy[] = []
  let particles: Particle[] = []
  let shots: Shot[] = []
  let pickups: Pickup[] = []
  let hp = 16,
    ammo = 12,
    score = 0,
    lives = 3,
    time = 180,
    cam = 0,
    age = 0,
    attack = 0,
    throwCooldown = 0,
    invincible = 0,
    knockbackTime = 0,
    knockbackVelocity = 0,
    playerStride = 0,
    playerAirTime = 0,
    playerClimbDistance = 0,
    checkpoint = 0,
    shake = 0,
    attackId = 0
  const movement = createPlayerMovementState()
  const hitEnemies = new Map<Enemy, number>()
  let sound = false,
    audio: AudioContext | undefined
  function beep(
    freq: number,
    duration = 0.08,
    type: OscillatorType = "square",
    volume = 0.025,
  ) {
    if (!sound) return
    audio ??= new AudioContext()
    void audio.resume()
    const osc = audio.createOscillator(),
      gain = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq / 2),
      audio.currentTime + duration,
    )
    gain.gain.setValueAtTime(volume, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + duration)
  }
  function populate() {
    enemies = stages[activeLocation.id].guards.map(({ x, kind }, i) => ({
      x,
      y: floorAt(stagePlatforms, x) - 27,
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
    for (const { x, kind } of stages[activeLocation.id].flyers)
      enemies.push({
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
    enemies.push({
      x: 3090,
      y: 180,
      w: 24,
      h: 38,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
      hp: 24 + activeLocation.id * 4,
      kind: "boss",
      stride: 0,
      home: 3090,
      dir: -1,
      timer: 1,
      flash: 0,
    })
    pickups = [
      { x: 271, y: 150, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 747, y: 142, w: 10, h: 12, kind: "health", taken: false },
      { x: 1080, y: 121, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 1410, y: 137, w: 10, h: 12, kind: "health", taken: false },
      { x: 1695, y: 126, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 2050, y: 138, w: 10, h: 12, kind: "health", taken: false },
      { x: 2430, y: 119, w: 10, h: 12, kind: "ammo", taken: false },
      { x: 2750, y: 199, w: 10, h: 12, kind: "health", taken: false },
    ]
    if (activeLocation.id > 0) {
      pickups = stagePlatforms.slice(0, -1).map((p, i) => ({
        x: p.x + p.w * 0.65,
        y: p.y - 20,
        w: 10,
        h: 12,
        kind: i % 3 === 1 ? "health" : "ammo",
        taken: false,
      }))
    }
  }
  function reset(full: boolean) {
    if (full) {
      score = 0
      lives = 3
      checkpoint = 0
    }
    hp = 16
    ammo = 12
    time = 180
    player = {
      ...playerSpawnPosition(checkpoint, stagePlatforms),
      w: 13,
      h: 28,
      vx: 0,
      vy: 0,
      grounded: false,
      wall: 0,
    }
    cam = Math.max(0, player.x - 120)
    particles = []
    shots = []
    attack = 0
    resetPlayerMovementState(movement)
    playerStride = 0
    playerAirTime = 0
    playerClimbDistance = 0
    throwCooldown = 0
    invincible = 1
    knockbackTime = 0
    knockbackVelocity = 0
    hitEnemies.clear()
    populate()
  }
  const controller = new GameController({
    flow,
    view: {
      showOverlay(title, subtitle, button) {
        overlay.classList.remove("hidden")
        overlay.querySelector("h2")!.innerHTML = title
        overlay.querySelector("p")!.textContent = subtitle
        overlay.querySelector("#start")!.innerHTML = button + " <span>→</span>"
        overlay.querySelector(".overlay-kicker")!.textContent = "SHADOW OF THE DRAGON"
        overlay.querySelector("small")!.textContent = "PRESS ENTER TO CONTINUE"
      },
      hideOverlay: () => overlay.classList.add("hidden"),
      setLabels(title, context) {
        document.querySelector(".stage-label strong")!.textContent = title
        document.querySelector(".stage-label small")!.textContent = context
      },
      setStatus: (text) => { status.textContent = text },
    },
    getLives: () => lives,
    setLives: (value) => { lives = value },
    getScore: () => score,
    getStageName: () => `0${activeLocation.id + 1} — ${activeLocation.name}`,
    reset: (full) => reset(full),
    clearInput: () => input.clear(),
    setMapCooldown: (seconds) => { mapCooldown = seconds },
    prepareStage(location) {
      activeLocation = location
      checkpoint = 0
      stagePlatforms = stages[location.id].terrain
      reset(false)
    },
    playCue: (frequency) => beep(frequency),
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
  reset(true)
  returnToMap()
  document.querySelector("#sound")!.addEventListener("click", () => {
    sound = !sound
    document.querySelector("#sound")!.textContent = sound
      ? "SOUND ON"
      : "SOUND OFF"
    beep(600)
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
      particles.push({
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
    const vitals = { hp, lives, invincible }
    const damage = damagePlayer(vitals, amount, flow)
    if (damage === "ignored")
      return { ...vitals, knockbackTime, knockbackVelocity }
    hp = vitals.hp
    lives = vitals.lives
    invincible = vitals.invincible
    knockbackTime = 0.38
    knockbackVelocity = player.x < from ? -155 : 155
    player.vx = knockbackVelocity
    player.vy = -175
    movement.wallJumpLock = 0
    movement.wallGrace = 0
    movement.lastWall = 0
    movement.jumpBuffer = 0
    movement.coyote = 0
    shake = 0.18
    burst(player.x + 7, player.y + 12, "#f3cb9e")
    beep(130, 0.15, "sawtooth")
    if (damage === "dead") controller.showDeath()
    return { ...vitals, knockbackTime, knockbackVelocity }
  }
  function hit(e: Enemy, result: DamageResult) {
    if (result.damage === 0) return
    e.flash = 0.14
    burst(e.x + e.w / 2, e.y + 12, "#ffdf8d")
    beep(260, 0.07)
    if (result.defeated) {
      burst(e.x, e.y, "#e77b65", 20)
      if (e.kind === "boss") {
        if (!completeBoss(flow, cleared, activeLocation.id)) return
        controller.stageCleared(stages[activeLocation.id].boss)
      }
    }
  }
  function update(dt: number) {
    const controls = input.snapshot()
    age += dt
    session.update(dt, {
      transition: (step) => {
        flow.updateTransition(step)
        input.clearPressed()
      },
      overworld: (dt) => {
        const result = stepOverworld({
          dt,
          cooldown: mapCooldown,
          position: mapPosition,
          visual: mapVisual,
          enemies: mapEnemies,
          input: {
            left: controls.left,
            right: controls.right,
            up: controls.up,
            down: controls.down,
          },
        })
        mapPosition = result.position
        mapCooldown = result.cooldown
        if (result.location) enterStage(result.location)
        input.clearPressed()
      },
      inactive: () => {
      input.clearPressed()
      },
      playing: (dt) => {
        const state = {
          hp, ammo, score, lives, time, attack, attackId, throwCooldown,
          invincible, knockbackTime, knockbackVelocity, playerStride,
          playerAirTime, playerClimbDistance, checkpoint, shake, cam,
        }
        const result = stepPlaying({
          dt,
          age,
          stageId: activeLocation.id,
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
          player,
          movement,
          enemies,
          terrain: stagePlatforms,
          pickups,
          shots,
          particles,
          hitEnemies,
          onDeath: die,
          onJump: () => beep(560, 0.1, "triangle"),
          onCheckpoint: () => {
            status.textContent = "CHECKPOINT REACHED"
            beep(880, 0.2, "triangle")
          },
          onAttack: () => beep(720, 0.07, "sawtooth"),
          onThrow: () => beep(1200, 0.08, "triangle"),
          onPickup: (item) => {
            burst(item.x, item.y, "#d9f49b")
            beep(950, 0.15, "triangle")
          },
          onEnemyHit: (enemy, damage) => {
            score += damage.score
            hit(enemy, damage)
          },
          onPlayerHit: (amount, sourceX) => {
            hp = state.hp
            lives = state.lives
            invincible = state.invincible
            knockbackTime = state.knockbackTime
            knockbackVelocity = state.knockbackVelocity
            return hurt(amount, sourceX)
          },
        })
        ;({ shots, particles } = result)
        ;({
          hp, ammo, score, lives, time, attack, attackId, throwCooldown,
          invincible, knockbackTime, knockbackVelocity, playerStride,
          playerAirTime, playerClimbDistance, checkpoint, shake, cam,
        } = state)
    input.clearPressed()
      },
    })
  }
  function draw() {
    drawGame({
      ctx, texture, spriteSheet, ninjaEnemySheet, enemySheet, overworldSheet,
      flow, activeLocation, stagePlatforms, cam, age, cleared, mapVisual, mapEnemies,
      stageName: stageLabel(), shake, enemies, pickups, shots, player, movement,
      invincible, attack, playerStride, playerAirTime, playerClimbDistance,
      particles, hp, score, time, lives, ammo,
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
