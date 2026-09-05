import {
  Application,
  Assets,
  Text,
  Spritesheet,
  Texture,
  Sprite,
} from "pixi.js"
import type { SpritesheetData } from "pixi.js"
import atlasData from "@/assets/spritesheets/pieces-spritesheet.json"

const base = import.meta.env.DEV ? "../.." : "."
const spritesheetData = atlasData as SpritesheetData

const load = () => {
  return Promise.all([
    Assets.load(`${base}/assets/fonts/OpenSans-Medium.ttf`),
    Assets.load(`${base}/assets/spritesheets/pieces-spritesheet.png`),
  ])
}

const drawText = (app: Application) => {
  const text = new Text({
    text: "2:20",
    style: {
      fontFamily: "OpenSans Medium",
      fontSize: 50,
      fill: "white",
    },
  })
  text.x = 500
  text.y = 200
  app.stage.addChild(text)
}

const sprites = async (): Promise<Spritesheet> => {
  const texture = Texture.from(
    `${base}/assets/spritesheets/pieces-spritesheet.png`,
  )
  const spritesheet = new Spritesheet(texture, spritesheetData)
  await spritesheet.parse()
  return spritesheet
}

export const test = async (): Promise<void> => {
  const app = new Application()
  await app.init({ background: "#000000", resizeTo: window })
  document.body.appendChild(app.canvas)

  await load()

  drawText(app)
  const spritesheet = await sprites()
  const sprite = new Sprite(spritesheet.textures["pawn-w-trim.png"])
  sprite.x = 500
  sprite.y = 300
  sprite.eventMode = "static"
  app.stage.addChild(sprite)
}
