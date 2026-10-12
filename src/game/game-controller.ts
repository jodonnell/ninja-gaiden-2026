import { GameFlow } from "./flow"
import type { Location } from "./overworld"

export interface GameView {
  showOverlay(title: string, subtitle: string, button: string): void
  hideOverlay(): void
  setLabels(title: string, context: string): void
  setStatus(status: string): void
}

export type GameControllerOptions = {
  flow: GameFlow
  view: GameView
  getLives(): number
  setLives(lives: number): void
  getScore(): number
  getStageName(): string
  reset(full: boolean): void
  clearInput(): void
  setMapCooldown(seconds: number): void
  prepareStage(location: Location): void
  playCue(frequency: number, duration?: number, type?: OscillatorType): void
}

const MAP_LABEL = "SHADOW PROVINCE — WORLD MAP"

/** Owns session flow and user-facing lifecycle presentation, without DOM access. */
export class GameController {
  constructor(private readonly options: GameControllerOptions) {}

  private get flow() {
    return this.options.flow
  }

  private label(title: string) {
    this.options.view.setLabels(
      title,
      this.flow.state === "overworld"
        ? "SHADOW PROVINCE / WORLD MAP"
        : "SIDE-SCROLLING MISSION",
    )
    this.options.view.setStatus(title)
  }

  returnToMap() {
    if (this.flow.state === "transition") return
    if (this.options.getLives() <= 0) this.options.reset(true)
    this.flow.returnToMap()
    this.options.view.hideOverlay()
    this.options.clearInput()
    this.options.setMapCooldown(0.2)
    this.label(MAP_LABEL)
  }

  enterStage(location: Location) {
    this.options.prepareStage(location)
    this.flow.enterStage()
    this.options.clearInput()
    this.label(`0${location.id + 1} — ${location.name}`)
    this.options.playCue(660, 0.15, "triangle")
  }

  begin() {
    const result = this.flow.begin(this.options.getLives())
    if (result === "unchanged") return
    if (result === "map") {
      this.returnToMap()
      return
    }
    if (result === "started") this.options.reset(false)
    this.options.view.hideOverlay()
    this.options.clearInput()
    this.label(this.options.getStageName())
    this.options.playCue(440)
  }

  pause() {
    const result = this.flow.pause()
    if (result === "paused") {
      this.options.clearInput()
      this.options.view.showOverlay(
        "PAUSED",
        "Take a breath. The shadows can wait.",
        "RESUME",
      )
      this.options.view.setStatus("PAUSED")
    } else if (result === "resumed") this.begin()
  }

  die() {
    if (this.flow.state !== "playing") return this.options.getLives()
    const lives = this.options.getLives() - 1
    this.options.setLives(lives)
    this.flow.state = "dead"
    this.showDeath()
    return lives
  }

  showDeath() {
    const lives = this.options.getLives()
    this.options.playCue(100, 0.4, "sawtooth")
    this.options.view.showOverlay(
      lives > 0 ? "FALLEN" : "GAME OVER",
      lives > 0
        ? `${lives} lives remain. Rise again at the last checkpoint.`
        : `Final score: ${this.options.getScore().toString().padStart(6, "0")}. The dragon awaits your return.`,
      lives > 0 ? "TRY AGAIN" : "NEW MISSION",
    )
    this.options.view.setStatus(lives > 0 ? "MISSION INTERRUPTED" : "GAME OVER")
  }

  stageCleared(bossName: string) {
    this.options.view.showOverlay(
      "DAWN BREAKS",
      `${bossName} has fallen. Score ${this.options.getScore().toString().padStart(6, "0")}.`,
      "RETURN TO WORLD MAP",
    )
    this.options.view.setStatus("STAGE CLEAR")
  }
}
