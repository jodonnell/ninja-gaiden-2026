export type GameState =
  | "overworld"
  | "transition"
  | "playing"
  | "paused"
  | "dead"
  | "won"

export class GameFlow {
  state: GameState = "overworld"
  pausedFrom: "overworld" | "playing" = "overworld"
  transitionTime = 0

  enterStage(duration = 0.7) {
    this.state = "transition"
    this.transitionTime = duration
  }

  updateTransition(dt: number) {
    if (this.state !== "transition") return
    this.transitionTime -= dt
    if (this.transitionTime <= 0) this.state = "playing"
  }

  returnToMap() {
    this.state = "overworld"
  }

  pause() {
    if (this.state === "playing" || this.state === "overworld") {
      this.pausedFrom = this.state
      this.state = "paused"
      return "paused" as const
    }
    if (this.state === "paused") {
      this.state = this.pausedFrom
      return "resumed" as const
    }
    return "unchanged" as const
  }

  begin(lives: number) {
    if (this.state === "playing" || this.state === "overworld" || this.state === "transition")
      return "unchanged" as const
    if (this.state === "paused") {
      this.state = this.pausedFrom
      return this.state === "overworld" ? "map" as const : "resumed" as const
    }
    if (this.state === "won" || (this.state === "dead" && lives <= 0)) {
      this.state = "overworld"
      return "map" as const
    }
    this.state = "playing"
    return "started" as const
  }
}
