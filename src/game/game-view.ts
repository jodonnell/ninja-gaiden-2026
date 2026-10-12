import type { GameView } from "./game-controller"
import type { GameFlow } from "./flow"
import type { GameController } from "./game-controller"
import type { GameAudio } from "./game-audio"
import { GameInput } from "./game-input"

export type BrowserGameView = {
  controllerView: GameView
  status: HTMLElement
  fpsLabel: HTMLElement
}

export function createBrowserGameView(): BrowserGameView {
  const overlay = document.querySelector<HTMLDivElement>("#overlay")!
  const status = document.querySelector<HTMLElement>("#status")!
  const fpsLabel = document.querySelector<HTMLElement>("#fps")!
  return {
    status,
    fpsLabel,
    controllerView: {
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
      setStatus: (value) => {
        status.textContent = value
      },
    },
  }
}

export function bindGameControls(options: {
  flow: GameFlow
  controller: GameController
  audio: GameAudio
  status: HTMLElement
}): GameInput {
  const { flow, controller, audio, status } = options
  const begin = () => controller.begin()
  const pause = () => controller.pause()
  const returnToMap = () => controller.returnToMap()
  document.querySelector("#world-map")!.addEventListener("click", returnToMap)
  document.querySelector("#start")!.addEventListener("click", begin)

  const input = new GameInput({
    pointerButtons: document.querySelectorAll<HTMLElement>("[data-key]"),
    onCommand: (command) => {
      if (command === "map") returnToMap()
      else if (command === "pause") pause()
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

  const sound = document.querySelector<HTMLElement>("#sound")!
  sound.addEventListener("click", () => {
    const enabled = audio.toggle()
    sound.textContent = enabled ? "SOUND ON" : "SOUND OFF"
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
  return input
}
