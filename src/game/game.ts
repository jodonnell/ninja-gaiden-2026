import overworldUrl from "../../assets/overworld-sheet.png"
import {
  drawOverworld,
  locations,
  locationAt,
  spawn,
  walkable,
} from "./overworld"
import type { Location } from "./overworld"
import { WallJumpGrace } from "./wall-jump"
import { ninjaFrame } from "./animation"
import type { NinjaPose } from "./animation"
import { patrolDirection } from "./enemies"
import { Application, Sprite, Texture } from "pixi.js"
import ryuUrl from "../../assets/ryu-sheet.png"
import enemiesUrl from "../../assets/enemies-sheet.png"
import {
  WIDTH as W,
  HEIGHT as H,
  WORLD_END,
  platforms,
  overlaps,
  move,
} from "./world"
import type { Body, Rect } from "./world"

type Enemy = Body & {
  hp: number
  kind: "guard" | "bird" | "boss"
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
type Pickup = Rect & { kind: "health" | "ammo"; taken: boolean }
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
  const overworldSheet = new Image()
  overworldSheet.src = overworldUrl
  await overworldSheet.decode()
  const overlay = document.querySelector<HTMLDivElement>("#overlay")!
  const status = document.querySelector("#status")!
  const keys = new Set<string>()
  const pressed = new Set<string>()
  let state:
    "overworld" | "transition" | "playing" | "paused" | "dead" | "won" =
    "overworld"
  let pausedFrom: "overworld" | "playing" = "overworld"
  let activeLocation = locations[0]
  const cleared = new Set<number>()
  let mapPosition = { ...spawn }
  const mapVisual = { ...spawn }
  let mapCooldown = 0
  let transitionTime = 0
  let stagePlatforms = platforms
  function stageLabel() {
    return `0${activeLocation.id + 1} — ${activeLocation.name}`
  }
  function setLabel(label: string) {
    document.querySelector(".stage-label strong")!.textContent = label
    document.querySelector(".stage-label small")!.textContent =
      state === "overworld"
        ? "SHADOW PROVINCE / WORLD MAP"
        : "SIDE-SCROLLING MISSION"
    status.textContent = label
  }
  function returnToMap() {
    if (lives <= 0) reset(true)
    state = "overworld"
    overlay.classList.add("hidden")
    keys.clear()
    pressed.clear()
    mapCooldown = 0.2
    setLabel("SHADOW PROVINCE — WORLD MAP")
  }
  function enterStage(location: Location) {
    activeLocation = location
    checkpoint = 0
    stagePlatforms = platforms.map((p, i) => ({
      ...p,
      y: p.y - (p.h === 12 ? location.id * (i % 2 ? 5 : 8) : 0),
    }))
    reset(false)
    state = "transition"
    transitionTime = 0.7
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
    facing = 1,
    coyote = 0,
    jumpBuffer = 0,
    wallJumpLock = 0,
    playerStride = 0,
    playerAirTime = 0,
    playerClimbDistance = 0,
    checkpoint = 0,
    shake = 0,
    attackId = 0
  const wallJumpGrace = new WallJumpGrace()
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
    enemies = [340, 670, 990, 1310, 1590, 1800, 2040, 2340, 2670].map(
      (x, i) => ({
        x,
        y: 100,
        w: 14,
        h: 27,
        vx: 0,
        vy: 0,
        grounded: false,
        wall: 0,
        hp: 1,
        kind: "guard",
        stride: 0,
        home: x,
        dir: i % 2 ? 1 : -1,
        timer: i * 0.2,
        flash: 0,
      }),
    )
    for (const x of [790, 1190, 1760, 2180, 2500])
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
        kind: "bird",
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
    pickups.forEach((pickup, i) => {
      if (i < 7) pickup.y -= activeLocation.id * (i % 2 ? 5 : 8)
    })
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
      x: checkpoint || 64,
      y: 175,
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
    wallJumpLock = 0
    wallJumpGrace.reset()
    playerStride = 0
    playerAirTime = 0
    playerClimbDistance = 0
    coyote = 0
    jumpBuffer = 0
    facing = 1
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
    if (state === "playing" || state === "overworld" || state === "transition")
      return
    if (state === "paused") {
      state = pausedFrom
      if (state === "overworld") return returnToMap()
    } else if (state === "won" || (state === "dead" && lives <= 0)) {
      if (lives <= 0) reset(true)
      return returnToMap()
    } else {
      reset(false)
      state = "playing"
    }
    overlay.classList.add("hidden")
    keys.clear()
    pressed.clear()
    setLabel(stageLabel())
    beep(440)
  }
  function pause() {
    if (state === "playing" || state === "overworld") {
      pausedFrom = state
      state = "paused"
      keys.clear()
      show("PAUSED", "Take a breath. The shadows can wait.", "RESUME")
      status.textContent = "PAUSED"
    } else if (state === "paused") begin()
  }
  document.querySelector("#world-map")!.addEventListener("click", () => {
    if (state !== "transition") returnToMap()
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
      if (e.code === "KeyM" && state !== "transition") {
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
    if (state === "playing" || state === "overworld") pause()
  })
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && (state === "playing" || state === "overworld"))
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
    if (state !== "playing") return
    lives--
    state = "dead"
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
    if (invincible > 0) return
    hp -= amount
    invincible = 1.25
    knockbackTime = 0.38
    knockbackVelocity = player.x < from ? -155 : 155
    player.vx = knockbackVelocity
    player.vy = -175
    wallJumpLock = 0
    wallJumpGrace.reset()
    jumpBuffer = 0
    coyote = 0
    shake = 0.18
    burst(player.x + 7, player.y + 12, "#f3cb9e")
    beep(130, 0.15, "sawtooth")
    if (hp <= 0) die()
  }
  function hit(e: Enemy, damage: number) {
    e.hp -= damage
    e.flash = 0.14
    burst(e.x + e.w / 2, e.y + 12, "#ffdf8d")
    beep(260, 0.07)
    if (e.hp <= 0) {
      score += e.kind === "boss" ? 5000 : e.kind === "bird" ? 150 : 200
      burst(e.x, e.y, "#e77b65", 20)
      if (e.kind === "boss") {
        cleared.add(activeLocation.id)
        state = "won"
        show(
          "DAWN BREAKS",
          "The Black Lotus has fallen. Score " +
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
          if (state === "playing" || state === "overworld") pause()
          else begin()
        } else pressed.add(k)
      }
    }
    previousPad = next
  }
  function update(dt: number) {
    gamepad()
    age += dt
    if (state === "transition") {
      transitionTime -= dt
      if (transitionTime <= 0) state = "playing"
      pressed.clear()
      return
    }
    if (state === "overworld") {
      mapCooldown -= dt
      mapVisual.x += (mapPosition.x - mapVisual.x) * Math.min(1, dt * 22)
      mapVisual.y += (mapPosition.y - mapVisual.y) * Math.min(1, dt * 22)
      if (mapCooldown <= 0) {
        const dx =
          Number(keys.has("ArrowRight") || keys.has("KeyD")) -
          Number(keys.has("ArrowLeft") || keys.has("KeyA"))
        const dy = dx
          ? 0
          : Number(keys.has("ArrowDown") || keys.has("KeyS")) -
            Number(keys.has("ArrowUp") || keys.has("KeyW"))
        if ((dx || dy) && walkable(mapPosition.x + dx, mapPosition.y + dy)) {
          mapPosition = { x: mapPosition.x + dx, y: mapPosition.y + dy }
          mapCooldown = 0.14
          const location = locationAt(mapPosition.x, mapPosition.y)
          if (location) enterStage(location)
        }
      }
      pressed.clear()
      return
    }
    if (state !== "playing") {
      pressed.clear()
      return
    }
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
    const wall = player.wall
    wallJumpGrace.update(wall, player.grounded, dt)
    const jumpWall = wallJumpGrace.direction
    wallJumpLock = Math.max(0, wallJumpLock - dt)
    if (knockbackTime > 0) {
      // Preserve the launch, then ease back to input over the final 140 ms.
      const recoilWeight = Math.min(1, knockbackTime / 0.14) ** 2
      player.vx = axis * 118 + (knockbackVelocity - axis * 118) * recoilWeight
    } else if (wallJumpLock === 0) player.vx = axis * 118
    if (axis) facing = axis
    coyote = player.grounded ? 0.1 : Math.max(0, coyote - dt)
    jumpBuffer =
      pressed.has("KeyZ") || pressed.has("Space")
        ? 0.12
        : Math.max(0, jumpBuffer - dt)
    if (knockbackTime === 0 && jumpBuffer > 0 && (coyote > 0 || jumpWall)) {
      player.vy = -282
      if (jumpWall) {
        player.vx = -jumpWall * 155
        facing = -jumpWall
        wallJumpLock = 0.18
      }
      wallJumpGrace.reset()
      jumpBuffer = 0
      coyote = 0
      beep(560, 0.1, "triangle")
    }
    // Jump-release gravity must not cut short the damage recoil arc.
    if (
      knockbackTime === 0 &&
      !keys.has("KeyZ") &&
      !keys.has("Space") &&
      player.vy < -110
    )
      player.vy += 950 * dt
    player.vy += 730 * dt
    if (
      wall &&
      axis === wall &&
      knockbackTime === 0 &&
      wallJumpLock === 0 &&
      (player.vy >= 0 || keys.has("ArrowUp") || keys.has("KeyW"))
    ) {
      player.vy =
        keys.has("ArrowUp") || keys.has("KeyW")
          ? -85
          : keys.has("ArrowDown") || keys.has("KeyS")
            ? 75
            : 15
    }
    const previousPlayerX = player.x
    const previousPlayerY = player.y
    move(player, dt, stagePlatforms)
    if (player.grounded) playerStride += Math.abs(player.x - previousPlayerX)
    playerAirTime = player.grounded || player.wall ? 0 : playerAirTime + dt
    playerClimbDistance = player.wall
      ? playerClimbDistance + Math.abs(player.y - previousPlayerY)
      : 0
    if (player.y > H + 40) {
      die()
      return
    }
    if (player.x > 1545 && checkpoint === 0) {
      checkpoint = 1550
      status.textContent = "CHECKPOINT REACHED"
      beep(880, 0.2, "triangle")
    }
    if (pressed.has("KeyX") && attack === 0) {
      attack = SWORD_ATTACK_SECONDS
      attackId++
      beep(720, 0.07, "sawtooth")
    }
    if (pressed.has("KeyC") && ammo > 0 && throwCooldown <= 0) {
      ammo--
      throwCooldown = 0.28
      shots.push({
        x: player.x + 5,
        y: player.y + 11,
        w: 9,
        h: 9,
        vx: facing * 260,
        vy: 0,
        hostile: false,
        life: 2,
      })
      beep(1200, 0.08, "triangle")
    }
    for (const item of pickups)
      if (!item.taken && overlaps(player, item)) {
        item.taken = true
        if (item.kind === "health") hp = Math.min(16, hp + 6)
        else ammo += 8
        score += 100
        burst(item.x, item.y, "#d9f49b")
        beep(950, 0.15, "triangle")
      }
    const blade = {
      x: facing > 0 ? player.x + 8 : player.x - 28,
      y: player.y + 3,
      w: 33,
      h: 25,
    }
    for (const e of enemies) {
      if (e.hp <= 0 || Math.abs(e.x - player.x) > 550) continue
      e.flash -= dt
      e.timer += dt
      if (e.kind === "bird") {
        e.x -= 65 * dt
        e.y += Math.sin(age * 5 + e.home) * 45 * dt
      } else {
        if (e.kind === "boss") {
          if (player.x > 2820) {
            e.dir = player.x < e.x ? -1 : 1
            e.vx = e.dir * 60
            if (e.timer > 1.8) {
              e.timer = 0
              e.vy = -240
              shots.push({
                x: e.x,
                y: e.y + 15,
                w: 8,
                h: 8,
                vx: e.dir * 155,
                vy: 0,
                hostile: true,
                life: 3,
              })
            }
          }
        } else {
          e.dir = patrolDirection(e, e.home, e.dir)
          e.vx = e.dir * 35
        }
        e.vy += 730 * dt
        const previousEnemyX = e.x
        move(e, dt, stagePlatforms)
        if (e.grounded) e.stride += Math.abs(e.x - previousEnemyX)
      }
      if (
        attack > 0.04 &&
        overlaps(blade, e) &&
        hitEnemies.get(e) !== attackId
      ) {
        hitEnemies.set(e, attackId)
        hit(e, 1)
      }
      if (e.hp > 0 && overlaps(player, e)) hurt(e.kind === "boss" ? 3 : 2, e.x)
    }
    for (const s of shots) {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.life -= dt
      if (s.hostile) {
        if (overlaps(s, player)) {
          hurt(2, s.x)
          s.life = 0
        }
      } else
        for (const e of enemies)
          if (e.hp > 0 && overlaps(s, e)) {
            hit(e, 2)
            s.life = 0
            break
          }
    }
    shots = shots.filter((s) => s.life > 0)
    for (const p of particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 300 * dt
      p.life -= dt
    }
    particles = particles.filter((p) => p.life > 0)
    cam +=
      (Math.max(0, Math.min(WORLD_END - W, player.x - 155)) - cam) *
      Math.min(1, dt * 9)
    pressed.clear()
  }
  // Swap a few environment colors directly. A canvas filter on every tile,
  // window, and rain streak creates hundreds of costly filtered draws per frame.
  const stagePalettes: Record<string, string>[] = [
    {},
    {
      "#0b1729": "#102523",
      "#14293c": "#1b3931",
      "#243e4c": "#305244",
      "#12252d": "#18352b",
      "#6a8b84": "#98b588",
      "#354d4b": "#4b6450",
      "#101e33": "#152d27",
      "#172c3b": "#234136",
    },
    {
      "#0b1729": "#261626",
      "#14293c": "#3c253b",
      "#243e4c": "#563746",
      "#12252d": "#33212e",
      "#6a8b84": "#bb8b83",
      "#354d4b": "#64454b",
      "#101e33": "#2c1c31",
      "#172c3b": "#41293c",
    },
  ]
  function rect(x: number, y: number, w: number, h: number, c: string) {
    ctx.fillStyle = stagePalettes[activeLocation.id][c] ?? c
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
    if (enemy) ctx.filter = "hue-rotate(135deg) saturate(0.8)"
    if (frame === "runSlash") {
      // Join the slash torso and the current stride at a shared waistline.
      // Using the same distance as normal running preserves the foot cycle.
      const legs = ninjaFrame("run", stride)
      const legHeight = 14
      ctx.drawImage(
        spriteSheet,
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
        spriteSheet,
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
      ctx.drawImage(spriteSheet, f.x, f.y, f.w, f.h, -f.pivot, -f.h, f.w, f.h)
    }
    ctx.restore()
  }
  function draw() {
    if (
      state === "overworld" ||
      state === "transition" ||
      (state === "paused" && pausedFrom === "overworld")
    ) {
      drawOverworld(ctx, overworldSheet, mapVisual, age, cleared)
      if (state === "transition") {
        rect(0, 0, W, H, `rgba(5,12,22,${1 - transitionTime / 0.7})`)
        text(stageLabel(), 90, 132, "#f5e2b4", 12)
      }
      texture.source.update()
      return
    }
    ctx.save()
    if (shake > 0 && state === "playing")
      ctx.translate(Math.round(Math.sin(age * 120) * 2), 0)
    background()
    terrain()
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
      if (e.kind === "bird") {
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
        facing,
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
      text("BLACK LOTUS", 302, 24, "#d3978b", 7)
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
    if (state === "playing" && player.x < 200 && time > 169) {
      text("MOVE →   Z JUMP   X SLASH", 28, 245, "#abc3b5", 8)
    }
    texture.source.update()
  }
  let accumulator = 0
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
    accumulator += Math.min(ticker.deltaMS / 1000, 0.1)
    while (accumulator >= 1 / 60) {
      update(1 / 60)
      accumulator -= 1 / 60
    }
    draw()
  })
}
