import { GameAudio } from "./game-audio"
import { createGameSurface } from "./game-browser"
import { GameController } from "./game-controller"
import { GameFeedback } from "./game-feedback"
import { GameFlow } from "./flow"
import { GameInput } from "./game-input"
import { runGameLoop, burst } from "./game-loop"
import { GameSession } from "./game-session"
import { GameStageRuntime } from "./game-stage-runtime"
import { bindGameControls, createBrowserGameView } from "./game-view"

export async function startGame() {
  const surface = await createGameSurface()
  const view = createBrowserGameView()
  const flow = new GameFlow()
  const session = new GameSession(flow)
  const runtime = new GameStageRuntime()
  const audio = new GameAudio()
  const inputRef: { current?: GameInput } = {}

  const feedback = new GameFeedback({
    playCue: ({ frequency, duration, type }) =>
      audio.play(frequency, duration, type),
    burst: (x, y, color, count) => burst(runtime, x, y, color, count),
    setStatus: (value) => {
      view.status.textContent = value
    },
  })
  const controller = new GameController({
    flow,
    view: view.controllerView,
    getLives: () => runtime.lives,
    setLives: (value) => {
      runtime.lives = value
    },
    getScore: () => runtime.score,
    getStageName: () =>
      `0${runtime.activeLocation.id + 1} — ${runtime.activeLocation.name}`,
    reset: (full) => runtime.reset(full),
    clearInput: () => {
      inputRef.current?.clear()
    },
    setMapCooldown: (seconds) => {
      runtime.mapCooldown = seconds
    },
    prepareStage: (location) => runtime.prepareStage(location),
    playCue: (frequency) => audio.play(frequency),
  })

  inputRef.current = bindGameControls({
    flow,
    controller,
    audio,
    status: view.status,
  })
  controller.returnToMap()
  runGameLoop({
    ...surface,
    flow,
    session,
    runtime,
    input: inputRef.current!,
    controller,
    feedback,
    fpsLabel: view.fpsLabel,
    enterStage: (location) => controller.enterStage(location),
  })
}
