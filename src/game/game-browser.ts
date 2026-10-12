import { Application, Sprite, Texture } from "pixi.js"
import overworldUrl from "../../assets/overworld-sheet.png"
import ryuUrl from "../../assets/ryu-sheet.png"
import enemiesUrl from "../../assets/enemies-sheet.png"
import { HEIGHT, WIDTH } from "./world"

export type GameSurface = {
  app: Application
  ctx: CanvasRenderingContext2D
  texture: Texture
  spriteSheet: HTMLCanvasElement
  ninjaEnemySheet: HTMLCanvasElement
  enemySheet: HTMLCanvasElement
  overworldSheet: HTMLImageElement
}

async function loadSpriteSheet(url: string): Promise<HTMLCanvasElement> {
  const sheet = new Image()
  sheet.src = url
  await sheet.decode()
  const result = document.createElement("canvas")
  result.width = sheet.width
  result.height = sheet.height
  const context = result.getContext("2d")!
  context.drawImage(sheet, 0, 0)
  const pixels = context.getImageData(0, 0, sheet.width, sheet.height)
  const background = pixels.data.slice(0, 3)
  for (let i = 0; i < pixels.data.length; i += 4)
    if (
      pixels.data[i] === background[0] &&
      pixels.data[i + 1] === background[1] &&
      pixels.data[i + 2] === background[2]
    )
      pixels.data[i + 3] = 0
  context.putImageData(pixels, 0, 0)
  return result
}

export async function createGameSurface(): Promise<GameSurface> {
  const app = new Application()
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    background: "#091321",
    antialias: false,
    resolution: 1,
    autoDensity: false,
  })
  const mount = document.querySelector("#game")!
  mount.appendChild(app.canvas)
  app.canvas.setAttribute(
    "aria-label",
    "Ninja platformer: arrows to move, Z to jump, X to attack, C to throw shuriken",
  )

  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  const texture = Texture.from(canvas)
  texture.source.scaleMode = "nearest"
  app.stage.addChild(new Sprite(texture))

  const [spriteSheet, enemySheet] = await Promise.all([
    loadSpriteSheet(ryuUrl),
    loadSpriteSheet(enemiesUrl),
  ])
  const ninjaEnemySheet = document.createElement("canvas")
  ninjaEnemySheet.width = spriteSheet.width
  ninjaEnemySheet.height = spriteSheet.height
  const enemyContext = ninjaEnemySheet.getContext("2d")!
  enemyContext.filter = "hue-rotate(135deg) saturate(0.8)"
  enemyContext.drawImage(spriteSheet, 0, 0)

  const overworldSheet = new Image()
  overworldSheet.src = overworldUrl
  await overworldSheet.decode()
  return {
    app,
    ctx,
    texture,
    spriteSheet,
    ninjaEnemySheet,
    enemySheet,
    overworldSheet,
  }
}
