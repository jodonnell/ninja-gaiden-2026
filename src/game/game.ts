import overworldUrl from "../../assets/overworld-sheet.png"
import type { Location } from "./overworld"
import { GameFlow } from "./flow"
import { GameSession } from "./game-session"
import { Application, Sprite, Texture } from "pixi.js"
import { GameInput } from "./game-input"
import { GameController } from "./game-controller"
import { GameStageRuntime } from "./game-stage-runtime"
import ryuUrl from "../../assets/ryu-sheet.png"
import enemiesUrl from "../../assets/enemies-sheet.png"
import { WIDTH as W, HEIGHT as H } from "./world"
import { GameAudio } from "./game-audio"
import { GameFeedback } from "./game-feedback"
import { burst, runGameLoop } from "./game-loop"

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
    burst: (x, y, color, count) => burst(runtime, x, y, color, count),
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
  runGameLoop({
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
    fpsLabel: document.querySelector("#fps")!,
    enterStage,
  })
}
