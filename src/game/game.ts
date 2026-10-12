import { stages, floorAt, type EnemyKind } from "./stages"
import { drawBiome } from "./biomes"
import overworldUrl from "../../assets/overworld-sheet.png"
import {
  drawOverworld,
  locations,
  spawn,
  type RoamingEnemy,
} from "./overworld"
import type { Location } from "./overworld"
import { createPlayerMovementState, resetPlayerMovementState, updatePlayerMovement } from "./player-movement"
import { ninjaFrame } from "./animation"
import type { NinjaPose } from "./animation"
import type { DamageResult } from "./combat"
import { collectPickup, consumeAmmo, playerSpawnPosition, updateCheckpoint, type Pickup } from "./pickups"
import { GameFlow } from "./flow"
import {
  GameSession,
  completeBoss,
  damagePlayer,
  stepOverworld,
  stepParticles,
  stepProjectiles,
  stepEnemies,
} from "./game-session"
import { Application, Sprite, Texture } from "pixi.js"
import ryuUrl from "../../assets/ryu-sheet.png"
import enemiesUrl from "../../assets/enemies-sheet.png"
import {
  WIDTH as W,
  HEIGHT as H,
  WORLD_END,
  platforms,
  overlaps,
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
const SWORD_ATTACK_SECONDS = 0.23

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
  const keys = new Set<string>()
  const pressed = new Set<string>()
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
  function stageLabel() {
    return `0${activeLocation.id + 1} — ${activeLocation.name}`
  }
  function setLabel(label: string) {
    document.querySelector(".stage-label strong")!.textContent = label
    document.querySelector(".stage-label small")!.textContent =
      flow.state === "overworld"
        ? "SHADOW PROVINCE / WORLD MAP"
        : "SIDE-SCROLLING MISSION"
    status.textContent = label
  }
  function returnToMap() {
    if (lives <= 0) reset(true)
    flow.returnToMap()
    overlay.classList.add("hidden")
    keys.clear()
    pressed.clear()
    mapCooldown = 0.2
    setLabel("SHADOW PROVINCE — WORLD MAP")
  }
  function enterStage(location: Location) {
    activeLocation = location
    checkpoint = 0
    stagePlatforms = stages[location.id].terrain
    reset(false)
    flow.enterStage()
    keys.clear()
    pressed.clear()
    setLabel(stageLabel())
    beep(660, 0.15, "triangle")
  }
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
  reset(true)
  returnToMap()
  function show(title: string, subtitle: string, button: string) {
    overlay.classList.remove("hidden")
    overlay.querySelector("h2")!.innerHTML = title
    overlay.querySelector("p")!.textContent = subtitle
    overlay.querySelector("#start")!.innerHTML = button + " <span>→</span>"
    overlay.querySelector(".overlay-kicker")!.textContent =
      "SHADOW OF THE DRAGON"
    overlay.querySelector("small")!.textContent = "PRESS ENTER TO CONTINUE"
  }
  function begin() {
    const result = flow.begin(lives)
    if (result === "unchanged") return
    if (result === "map") {
      if (lives <= 0) reset(true)
      return returnToMap()
    }
    if (result === "started") {
      reset(false)
    }
    overlay.classList.add("hidden")
    keys.clear()
    pressed.clear()
    setLabel(stageLabel())
    beep(440)
  }
  function pause() {
    const result = flow.pause()
    if (result === "paused") {
      keys.clear()
      show("PAUSED", "Take a breath. The shadows can wait.", "RESUME")
      status.textContent = "PAUSED"
    } else if (result === "resumed") begin()
  }
  document.querySelector("#world-map")!.addEventListener("click", () => {
    if (flow.state !== "transition") returnToMap()
  })
  document.querySelector("#start")!.addEventListener("click", begin)
  const valid = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "KeyA",
    "KeyD",
    "KeyW",
    "KeyS",
    "KeyZ",
    "KeyX",
    "KeyC",
    "Space",
    "Enter",
    "Escape",
    "KeyP",
    "KeyM",
  ]
  window.addEventListener("keydown", (e) => {
    if (!valid.includes(e.code)) return
    e.preventDefault()
    if (!e.repeat) {
      if (e.code === "KeyM" && flow.state !== "transition") {
        returnToMap()
        return
      }
      if (e.code === "Enter") {
        begin()
        return
      }
      if (e.code === "Escape" || e.code === "KeyP") {
        pause()
        return
      }
      pressed.add(e.code)
    }
    keys.add(e.code)
  })
  window.addEventListener("keyup", (e) => keys.delete(e.code))
  window.addEventListener("blur", () => {
    keys.clear()
    pressed.clear()
    if (flow.state === "playing" || flow.state === "overworld") pause()
  })
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (flow.state === "playing" || flow.state === "overworld"))
      pause()
  })
  document
    .querySelectorAll<HTMLButtonElement>("[data-key]")
    .forEach((button) => {
      button.addEventListener("pointerdown", (e) => {
        e.preventDefault()
        button.setPointerCapture(e.pointerId)
        keys.add(button.dataset.key!)
        pressed.add(button.dataset.key!)
      })
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(event, () => keys.delete(button.dataset.key!))
    })
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
    if (flow.state !== "playing") return
    // Environmental deaths bypass the hit and invulnerability rules.
    lives--
    flow.state = "dead"
    showDeath()
  }
  function showDeath() {
    beep(100, 0.4, "sawtooth")
    show(
      lives > 0 ? "FALLEN" : "GAME OVER",
      lives > 0
        ? `${lives} lives remain. Rise again at the last checkpoint.`
        : `Final score: ${score.toString().padStart(6, "0")}. The dragon awaits your return.`,
      lives > 0 ? "TRY AGAIN" : "NEW MISSION",
    )
    status.textContent = lives > 0 ? "MISSION INTERRUPTED" : "GAME OVER"
  }
  function hurt(amount: number, from: number) {
    const vitals = { hp, lives, invincible }
    const damage = damagePlayer(vitals, amount, flow)
    if (damage === "ignored") return
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
    if (damage === "dead") showDeath()
  }
  function hit(e: Enemy, result: DamageResult) {
    if (result.damage === 0) return
    e.flash = 0.14
    burst(e.x + e.w / 2, e.y + 12, "#ffdf8d")
    beep(260, 0.07)
    score += result.score
    if (result.defeated) {
      burst(e.x, e.y, "#e77b65", 20)
      if (e.kind === "boss") {
        if (!completeBoss(flow, cleared, activeLocation.id)) return
        show(
          "DAWN BREAKS",
          stages[activeLocation.id].boss +
            " has fallen. Score " +
            score.toString().padStart(6, "0") +
            ".",
          "RETURN TO WORLD MAP",
        )
        status.textContent = "STAGE CLEAR"
      }
    }
  }
  let previousPad = new Set<string>()
  function gamepad() {
    const p = navigator.getGamepads?.()[0]
    const next = new Set<string>()
    if (p) {
      if (p.axes[0] < -0.3 || p.buttons[14]?.pressed) next.add("ArrowLeft")
      if (p.axes[0] > 0.3 || p.buttons[15]?.pressed) next.add("ArrowRight")
      if (p.axes[1] > 0.3 || p.buttons[13]?.pressed) next.add("ArrowDown")
      if (p.axes[1] < -0.3 || p.buttons[12]?.pressed) next.add("ArrowUp")
      if (p.buttons[0]?.pressed) next.add("KeyZ")
      if (p.buttons[2]?.pressed || p.buttons[1]?.pressed) next.add("KeyX")
      if (p.buttons[3]?.pressed) next.add("KeyC")
      if (p.buttons[9]?.pressed) next.add("Enter")
    }
    for (const k of previousPad) if (!next.has(k)) keys.delete(k)
    for (const k of next) {
      keys.add(k)
      if (!previousPad.has(k)) {
        if (k === "Enter") {
          if (flow.state === "playing" || flow.state === "overworld") pause()
          else begin()
        } else pressed.add(k)
      }
    }
    previousPad = next
  }
  function update(dt: number) {
    gamepad()
    age += dt
    session.update(dt, {
      transition: (step) => {
        flow.updateTransition(step)
        pressed.clear()
      },
      overworld: (dt) => {
        const result = stepOverworld({
          dt,
          cooldown: mapCooldown,
          position: mapPosition,
          visual: mapVisual,
          enemies: mapEnemies,
          input: {
            left: keys.has("ArrowLeft") || keys.has("KeyA"),
            right: keys.has("ArrowRight") || keys.has("KeyD"),
            up: keys.has("ArrowUp") || keys.has("KeyW"),
            down: keys.has("ArrowDown") || keys.has("KeyS"),
          },
        })
        mapPosition = result.position
        mapCooldown = result.cooldown
        if (result.location) enterStage(result.location)
        pressed.clear()
      },
      inactive: () => {
      pressed.clear()
      },
      playing: (dt) => {
    time -= dt
    if (time <= 0) {
      die()
      return
    }
    attack = Math.max(0, attack - dt)
    throwCooldown -= dt
    invincible -= dt
    knockbackTime = Math.max(0, knockbackTime - dt)
    shake -= dt
    const axis =
      (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) -
      (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0)
    const movementResult = updatePlayerMovement(player, movement, {
      axis,
      jumpPressed: pressed.has("KeyZ") || pressed.has("Space"),
      jumpHeld: keys.has("KeyZ") || keys.has("Space"),
      climbUp: keys.has("ArrowUp") || keys.has("KeyW"),
      climbDown: keys.has("ArrowDown") || keys.has("KeyS"),
      knockbackTime,
      knockbackVelocity,
    }, dt, stagePlatforms)
    if (movementResult.jumped) beep(560, 0.1, "triangle")
    const previousPlayerX = movementResult.previousX
    const previousPlayerY = movementResult.previousY
    if (player.grounded) playerStride += Math.abs(player.x - previousPlayerX)
    playerAirTime = player.grounded || player.wall ? 0 : playerAirTime + dt
    playerClimbDistance = player.wall
      ? playerClimbDistance + Math.abs(player.y - previousPlayerY)
      : 0
    if (
      player.y > H + 40 ||
      (activeLocation.id === 2 && player.y + player.h >= 254)
    ) {
      die()
      return
    }
    const reachedCheckpoint = updateCheckpoint(checkpoint, player.x)
    if (reachedCheckpoint !== checkpoint) {
      checkpoint = reachedCheckpoint
      status.textContent = "CHECKPOINT REACHED"
      beep(880, 0.2, "triangle")
    }
    if (pressed.has("KeyX") && attack === 0) {
      attack = SWORD_ATTACK_SECONDS
      attackId++
      beep(720, 0.07, "sawtooth")
    }
    const ammoAfterThrow = pressed.has("KeyC") ? consumeAmmo(ammo) : undefined
    if (ammoAfterThrow !== undefined && throwCooldown <= 0) {
      ammo = ammoAfterThrow
      throwCooldown = 0.28
      shots.push({
        x: player.x + 5,
        y: player.y + 11,
        w: 9,
        h: 9,
        vx: movement.facing * 260,
        vy: 0,
        hostile: false,
        life: 2,
      })
      beep(1200, 0.08, "triangle")
    }
    for (const item of pickups) {
      const updatedStats = collectPickup(item, { hp, ammo, score }, overlaps(player, item))
      if (updatedStats) {
        hp = updatedStats.hp
        ammo = updatedStats.ammo
        score = updatedStats.score
        burst(item.x, item.y, "#d9f49b")
        beep(950, 0.15, "triangle")
      }
    }
    stepEnemies({
      dt,
      age,
      stageId: activeLocation.id,
      player,
      facing: movement.facing,
      enemies,
      terrain: stagePlatforms,
      attackActive: attack > 0.04,
      attackId,
      hitEnemies,
      onEnemyHit: hit,
      onPlayerHit: hurt,
      onHostileShot: (shot) => shots.push(shot),
    })
    shots = stepProjectiles(shots, player, enemies, dt, hit, (x) => hurt(2, x))
    particles = stepParticles(particles, dt)
    cam +=
      (Math.max(0, Math.min(WORLD_END - W, player.x - 155)) - cam) *
      Math.min(1, dt * 9)
    pressed.clear()
      },
    })
  }
  function rect(x: number, y: number, w: number, h: number, c: string) {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }
  function poly(points: number[], c: string) {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(points[0], points[1])
    for (let i = 2; i < points.length; i += 2)
      ctx.lineTo(points[i], points[i + 1])
    ctx.closePath()
    ctx.fill()
  }
  function text(t: string, x: number, y: number, color = "#d4dfd4", size = 8) {
    ctx.fillStyle = color
    ctx.font = `bold ${size}px monospace`
    ctx.fillText(t, x, y)
  }
  function building(x: number, y: number, w: number, h: number, layer: number) {
    rect(x, y, w, h, layer === 0 ? "#101e33" : "#172c3b")
    rect(x + 3, y + 2, w - 6, 2, "#294150")
    for (let iy = y + 9; iy < y + h; iy += 11)
      for (let ix = x + 5; ix < x + w - 4; ix += 9)
        if (Math.sin(ix * 21 + iy * 32) > 0.15)
          rect(ix, iy, 3, 4, layer === 0 ? "#27404f" : "#49616a")
    rect(x + w - 3, y, 3, h, "#0b1c2d")
  }
  function background() {
    rect(0, 0, W, H, "#0b1729")
    rect(0, 90, W, 100, "#14293c")
    rect(0, 159, W, 80, "#243e4c")
    for (let i = 0; i < 50; i++) {
      const x = (i * 97 + 13 - cam * 0.08) % W
      rect(x, (i * 43) % 130, 1, 1, i % 3 ? "#446477" : "#8a9e9a")
    }
    ctx.fillStyle = "#abc3b5"
    ctx.beginPath()
    ctx.arc(363 - cam * 0.035, 61, 24, 0, Math.PI * 2)
    ctx.fill()
    rect(344 - cam * 0.035, 48, 14, 4, "#91afa7")
    rect(366 - cam * 0.035, 68, 14, 3, "#91afa7")
    for (let i = 0; i < 8; i++) {
      const x = ((((i * 83 - cam * 0.12) % 650) + 650) % 650) - 85
      rect(x, 69 + (i % 3) * 8, 65, 3, "#263d50")
    }
    for (let i = -1; i < 13; i++) {
      const x = i * 55 - ((cam * 0.2) % 55)
      building(x, 105 + Math.sin(i * 9) * 26, 45, 130, 0)
    }
    // Layered pagoda silhouettes and industrial skyline.
    for (let i = -1; i < 5; i++) {
      const x = i * 180 - ((cam * 0.35) % 180)
      const y = 112 + (i % 2) * 27
      rect(x + 32, y + 13, 38, 85, "#122637")
      for (let k = 0; k < 3; k++) {
        const yy = y + k * 24
        poly(
          [
            x + 13,
            yy + 14,
            x + 32,
            yy + 5,
            x + 49,
            yy - 6,
            x + 67,
            yy + 5,
            x + 86,
            yy + 14,
            x + 75,
            yy + 17,
            x + 24,
            yy + 17,
          ],
          "#0a1c2e",
        )
        rect(x + 35, yy + 17, 29, 10, "#27404b")
        rect(x + 42, yy + 18, 3, 8, "#85785b")
        rect(x + 55, yy + 18, 3, 8, "#85785b")
      }
    }
    for (let i = -1; i < 8; i++) {
      const x = i * 83 - ((cam * 0.55) % 83)
      building(x, 170 + Math.sin(i * 4) * 15, 65, 100, 1)
    }
    // Wires, neon signs, rain.
    ctx.strokeStyle = "#0b1828"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 125)
    ctx.quadraticCurveTo(240, 178, 480, 124)
    ctx.stroke()
    for (let i = 0; i < 4; i++) {
      const x = i * 170 + 110 - ((cam * 0.65) % 170)
      rect(x, 145, 15, 40, "#263c44")
      rect(x + 2, 147, 11, 36, "#713e52")
      text("月", x + 3, 158, "#ed9286", 10)
      text("影", x + 3, 174, "#ed9286", 10)
    }
    for (let i = 0; i < 55; i++) {
      const x = (((i * 53 - age * 65) % W) + W) % W
      const y = (i * 37 + age * 150) % H
      rect(x, y, 1, 4, "#8cbbb31c")
    }
  }
  function terrain() {
    for (const p of stagePlatforms) {
      const x = p.x - cam
      if (x > W || x + p.w < 0) continue
      rect(x, p.y, p.w, p.h, "#12252d")
      rect(x, p.y, p.w, 3, "#6a8b84")
      rect(x, p.y + 3, p.w, 4, "#354d4b")
      rect(x, p.y + 7, p.w, 2, "#091922")
      for (let bx = 0; bx < p.w; bx += 16) {
        rect(x + bx, p.y + 2, 1, 4, "#172f38")
        if (p.h > 12) {
          rect(x + bx + 2, p.y + 12, 12, 5, "#233d40")
          rect(x + bx + 7, p.y + 21, 12, 5, "#20363b")
          rect(x + bx + 2, p.y + 30, 12, 5, "#233d40")
        }
      }
      if (p.h > 12) {
        rect(x + 6, p.y + 43, p.w - 12, p.h, "#0b1b24")
        for (let bx = 18; bx < p.w; bx += 48) {
          rect(x + bx, p.y + 48, 18, 26, "#233f45")
          rect(x + bx + 3, p.y + 51, 12, 20, "#756e49")
          rect(x + bx + 8, p.y + 50, 2, 23, "#152c35")
          rect(x + bx, p.y + 60, 18, 2, "#152c35")
        }
      }
    }
    for (const wx of [130, 840, 1510, 2220, 2790]) {
      const x = wx - cam
      rect(x, 144, 3, 76, "#172b35")
      rect(x - 8, 149, 19, 3, "#46605c")
      rect(x - 5, 152, 12, 17, "#b87658")
      rect(x - 3, 154, 8, 12, "#f1c47c")
      rect(x - 6, 170, 14, 2, "#192e34")
    }
    const gate = 3205 - cam
    rect(gate, 138, 8, 82, "#462f38")
    rect(gate + 42, 138, 8, 82, "#462f38")
    poly(
      [
        gate - 14,
        137,
        gate + 24,
        124,
        gate + 63,
        137,
        gate + 58,
        142,
        gate - 10,
        142,
      ],
      "#293e44",
    )
    rect(gate - 7, 142, 64, 4, "#bb7360")
  }
  function ninja(
    x: number,
    y: number,
    dir: number,
    frame: NinjaPose,
    enemy = false,
    stride = playerStride,
    airTime = playerAirTime,
  ) {
    const f = ninjaFrame(frame, stride, airTime, playerClimbDistance)
    ctx.save()
    ctx.translate(Math.round(x + 7), Math.round(y + 28))
    // The climbing pose faces left in the sheet; other poses face right.
    ctx.scale(frame === "climb" ? -dir : dir, 1)
    const sheet = enemy ? ninjaEnemySheet : spriteSheet
    if (frame === "runSlash") {
      // Join the slash torso and the current stride at a shared waistline.
      // Using the same distance as normal running preserves the foot cycle.
      const legs = ninjaFrame("run", stride)
      const legHeight = 14
      ctx.drawImage(
        sheet,
        legs.x,
        legs.y + legs.h - legHeight,
        legs.w,
        legHeight,
        -legs.pivot,
        -legHeight,
        legs.w,
        legHeight,
      )
      const torsoHeight = f.h - legHeight
      ctx.drawImage(
        sheet,
        f.x,
        f.y,
        f.w,
        torsoHeight,
        -f.pivot,
        -f.h,
        f.w,
        torsoHeight,
      )
    } else {
      ctx.drawImage(sheet, f.x, f.y, f.w, f.h, -f.pivot, -f.h, f.w, f.h)
    }
    ctx.restore()
  }
  function draw() {
    if (
      flow.state === "overworld" ||
      flow.state === "transition" ||
      (flow.state === "paused" && flow.pausedFrom === "overworld")
    ) {
      drawOverworld(ctx, overworldSheet, mapVisual, age, cleared, mapEnemies)
      if (flow.state === "transition") {
        rect(0, 0, W, H, `rgba(5,12,22,${1 - flow.transitionTime / 0.7})`)
        text(stageLabel(), 90, 132, "#f5e2b4", 12)
      }
      texture.source.update()
      return
    }
    ctx.save()
    if (shake > 0 && flow.state === "playing")
      ctx.translate(Math.round(Math.sin(age * 120) * 2), 0)
    if (activeLocation.id === 0) {
      background()
      terrain()
    } else drawBiome(ctx, activeLocation.id, stagePlatforms, cam, age)
    for (const p of pickups)
      if (!p.taken) {
        const x = p.x - cam,
          y = p.y + Math.sin(age * 4) * 2
        rect(x, y, 10, 12, "#182c36")
        rect(x + 1, y + 1, 8, 10, p.kind === "health" ? "#b76059" : "#abc879")
        text(p.kind === "health" ? "+" : "✦", x + 2, y + 9, "#f8edd2", 9)
      }
    for (const e of enemies) {
      if (e.hp <= 0 || e.x - cam > W + 40 || e.x - cam < -40) continue
      const x = e.x - cam
      if (e.flash > 0 && Math.floor(age * 35) % 2 === 0) continue
      if (e.kind === "bat") {
        const flap = Math.sin(e.timer * 16) * 7
        poly(
          [
            x + 9,
            e.y + 5,
            x - 7,
            e.y - flap,
            x - 2,
            e.y + 10,
            x + 9,
            e.y + 8,
            x + 20,
            e.y + 10,
            x + 25,
            e.y - flap,
          ],
          "#ac7dba",
        )
        rect(x + 5, e.y, 8, 11, "#53385e")
        rect(x + 6, e.y + 3, 2, 2, "#ffe07c")
        rect(x + 11, e.y + 3, 2, 2, "#ffe07c")
      } else if (e.kind === "monk") {
        poly(
          [x + 4, e.y + 7, x + 10, e.y + 7, x + 17, e.y + 27, x - 3, e.y + 27],
          "#b24f45",
        )
        rect(x + 3, e.y, 9, 9, "#713749")
        rect(x + 5, e.y + 3, 6, 3, "#ebbd80")
        rect(x + 6, e.y + 10, 3, 16, "#e3a454")
        rect(x + (e.dir > 0 ? 14 : -3), e.y + 5, 2, 22, "#e3a454")
        if (e.timer > 1.65)
          rect(x + (e.dir > 0 ? 12 : -5), e.y + 1, 6, 6, "#ffcc65")
      } else if (e.kind === "bird") {
        // The sheet's eagles face right. Mirror for their leftward flight.
        const wingsUp = Math.floor(e.timer * 8) % 2 === 0
        ctx.save()
        ctx.translate(Math.round(x + e.w / 2), Math.round(e.y))
        ctx.scale(e.dir, 1)
        if (wingsUp)
          ctx.drawImage(enemySheet, 144, 190, 23, 33, -13, -20, 23, 33)
        else ctx.drawImage(enemySheet, 173, 205, 22, 20, -13, -9, 22, 20)
        ctx.restore()
      } else if (e.kind === "boss") {
        ctx.save()
        ctx.translate(x, e.y)
        ctx.scale(1.5, 1.35)
        ninja(0, 0, e.dir, "slash", true)
        ctx.restore()
      } else
        ninja(
          x,
          e.y,
          e.dir,
          e.grounded ? "run" : "jump",
          true,
          e.stride,
          e.timer,
        )
    }
    for (const s of shots) {
      const x = s.x - cam + 4,
        y = s.y + 4
      ctx.save()
      ctx.translate(x, y)
      if (s.hostile && activeLocation.id === 2) {
        poly([-7, 0, -2, -4, 4, -4, 7, 0, 4, 4, -2, 4], "#ee783d")
        rect(-2, -2, 5, 4, "#ffe5a0")
        ctx.restore()
        continue
      }
      ctx.rotate(age * 25)
      poly(
        [-6, 0, -1, -2, 0, -6, 2, -1, 6, 0, 1, 2, 0, 6, -2, 1],
        s.hostile ? "#ed906a" : "#dcebc7",
      )
      ctx.restore()
    }
    if (invincible <= 0 || Math.floor(age * 18) % 2 === 0)
      ninja(
        player.x - cam,
        player.y,
        movement.facing,
        attack > 0
          ? player.grounded && Math.abs(player.vx) > 5
            ? "runSlash"
            : "slash"
          : player.wall
            ? "climb"
            : !player.grounded
              ? "jump"
              : Math.abs(player.vx) > 5
                ? "run"
                : "idle",
      )
    for (const p of particles) rect(p.x - cam, p.y, 2, 2, p.color)
    ctx.restore()
    // Fixed arcade HUD.
    rect(0, 0, W, 31, "#08131de8")
    text("PLAYER", 12, 12, "#d6decd")
    for (let i = 0; i < 16; i++)
      rect(52 + i * 5, 5, 3, 9, i < hp ? "#d8eda6" : "#33433e")
    text("SCORE " + score.toString().padStart(6, "0"), 151, 12)
    text(
      "TIME " + Math.max(0, Math.ceil(time)).toString().padStart(3, "0"),
      280,
      12,
    )
    text(`STAGE ${activeLocation.id + 1}–1`, 398, 12)
    text("NINJA ×" + lives, 12, 24, "#8caaac", 7)
    text("✦ " + ammo.toString().padStart(2, "0"), 94, 24, "#d8eda6", 8)
    text(activeLocation.name, 151, 24, "#718e9b", 7)
    const boss = enemies.find((e) => e.kind === "boss")!
    if (player.x > 2810 && boss.hp > 0) {
      text(stages[activeLocation.id].boss, 302, 24, "#d3978b", 7)
      for (let i = 0; i < 24; i++)
        rect(
          371 + i * 4,
          18,
          3,
          6,
          i < Math.ceil((boss.hp / (24 + activeLocation.id * 4)) * 24)
            ? "#dd8c79"
            : "#44343d",
        )
    }
    if (flow.state === "playing" && player.x < 200 && time > 169) {
      text(
        [
          "MOVE →   Z JUMP   X SLASH",
          "JADE PASS / WATCH FOR DIVING EAGLES",
          "CINDER HALL / JUMP THE LAVA PITS",
        ][activeLocation.id],
        28,
        245,
        "#abc3b5",
        8,
      )
    }
    texture.source.update()
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
