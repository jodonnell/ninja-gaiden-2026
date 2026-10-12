import { stages } from "./stages"
import { drawBiome } from "./biomes"
import { drawOverworld, type RoamingEnemy } from "./overworld"
import type { Location } from "./overworld"
import { ninjaFrame, type NinjaPose } from "./animation"
import { GameFlow } from "./flow"
import type { Texture } from "pixi.js"
import { WIDTH as W, HEIGHT as H, type Body, type Rect } from "./world"
import type { Pickup } from "./pickups"
import type { PlayerMovementState } from "./player-movement"
import type { EnemyKind } from "./stages"

type RenderEnemy = Body & { hp: number; kind: EnemyKind; stride: number; dir: number; timer: number; flash: number }
type RenderParticle = { x: number; y: number; color: string }
type RenderShot = Rect & { hostile: boolean }

export type GameRenderState = {
  ctx: CanvasRenderingContext2D
  texture: Texture
  spriteSheet: HTMLCanvasElement
  ninjaEnemySheet: HTMLCanvasElement
  enemySheet: HTMLCanvasElement
  overworldSheet: HTMLImageElement
  flow: GameFlow
  activeLocation: Location
  stagePlatforms: Rect[]
  cam: number
  age: number
  cleared: Set<number>
  mapVisual: { x: number; y: number }
  mapEnemies: RoamingEnemy[]
  stageName: string
  shake: number
  enemies: RenderEnemy[]
  pickups: Pickup[]
  shots: RenderShot[]
  player: Body
  movement: PlayerMovementState
  invincible: number
  attack: number
  playerStride: number
  playerAirTime: number
  playerClimbDistance: number
  particles: RenderParticle[]
  hp: number
  score: number
  time: number
  lives: number
  ammo: number
}

export function drawGame(state: GameRenderState) {
  const { ctx, texture, spriteSheet, ninjaEnemySheet, enemySheet, overworldSheet,
    flow, activeLocation, stagePlatforms, cam, age, cleared, mapVisual, mapEnemies,
    stageName, shake, enemies, pickups, shots, player, movement, invincible,
    attack, playerStride, playerAirTime, playerClimbDistance, particles, hp,
    score, time, lives, ammo } = state

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
    {
      drawOverworld(ctx, overworldSheet, mapVisual, age, cleared, mapEnemies)
      for (const p of particles) rect(p.x - cam, p.y, 2, 2, p.color)
    }
    if (flow.state === "transition") {
      rect(0, 0, W, H, `rgba(5,12,22,${1 - flow.transitionTime / 0.7})`)
      text(stageName, 90, 132, "#f5e2b4", 12)
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

draw()
}
