export type FeedbackEvent =
  | "jump"
  | "checkpoint"
  | "attack"
  | "throw"
  | "pickup"
  | "playerHit"
  | "enemyHit"
  | "death"

export type FeedbackCue = {
  frequency: number
  duration: number
  type: OscillatorType
}

const cues: Record<FeedbackEvent, FeedbackCue> = {
  jump: { frequency: 560, duration: 0.1, type: "triangle" },
  checkpoint: { frequency: 880, duration: 0.2, type: "triangle" },
  attack: { frequency: 720, duration: 0.07, type: "sawtooth" },
  throw: { frequency: 1200, duration: 0.08, type: "triangle" },
  pickup: { frequency: 950, duration: 0.15, type: "triangle" },
  playerHit: { frequency: 130, duration: 0.15, type: "sawtooth" },
  enemyHit: { frequency: 260, duration: 0.07, type: "square" },
  death: { frequency: 100, duration: 0.4, type: "sawtooth" },
}

export function feedbackCue(event: FeedbackEvent): FeedbackCue {
  return cues[event]
}

export type GameFeedbackEffects = {
  playCue(cue: FeedbackCue): void
  burst(x: number, y: number, color: string, count?: number): void
  setStatus(status: string): void
}

/** Maps gameplay feedback events to their visual and audio presentation. */
export class GameFeedback {
  constructor(private readonly effects: GameFeedbackEffects) {}

  private cue(event: FeedbackEvent) {
    this.effects.playCue(feedbackCue(event))
  }

  jump() {
    this.cue("jump")
  }

  checkpoint() {
    this.effects.setStatus("CHECKPOINT REACHED")
    this.cue("checkpoint")
  }

  attack() {
    this.cue("attack")
  }

  throw() {
    this.cue("throw")
  }

  pickup(x: number, y: number) {
    this.effects.burst(x, y, "#d9f49b")
    this.cue("pickup")
  }

  playerHit(x: number, y: number) {
    this.effects.burst(x, y, "#f3cb9e")
    this.cue("playerHit")
  }

  enemyHit(x: number, y: number, defeated: boolean, defeatX = x, defeatY = y) {
    this.effects.burst(x, y, "#ffdf8d")
    this.cue("enemyHit")
    if (defeated) this.effects.burst(defeatX, defeatY, "#e77b65", 20)
  }

  death() {
    this.cue("death")
  }
}
