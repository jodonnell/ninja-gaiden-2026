import { GameFeedback, feedbackCue } from "../../src/game/game-feedback"

describe("game feedback presentation", () => {
  it.each([
    ["jump", 560, 0.1, "triangle"],
    ["checkpoint", 880, 0.2, "triangle"],
    ["attack", 720, 0.07, "sawtooth"],
    ["throw", 1200, 0.08, "triangle"],
    ["pickup", 950, 0.15, "triangle"],
    ["playerHit", 130, 0.15, "sawtooth"],
    ["enemyHit", 260, 0.07, "square"],
    ["death", 100, 0.4, "sawtooth"],
  ] as const)(
    "maps %s to its sound cue",
    (event, frequency, duration, type) => {
      expect(feedbackCue(event)).toEqual({ frequency, duration, type })
    },
  )

  it("maps gameplay events to cues, status, and hit or pickup particles", () => {
    const cues: unknown[] = []
    const bursts: unknown[][] = []
    const statuses: string[] = []
    const feedback = new GameFeedback({
      playCue: (cue) => cues.push(cue),
      burst: (...args) => bursts.push(args),
      setStatus: (status) => statuses.push(status),
    })

    feedback.jump()
    feedback.checkpoint()
    feedback.attack()
    feedback.throw()
    feedback.pickup(12, 34)
    feedback.playerHit(56, 78)
    feedback.enemyHit(90, 100, true, 80, 88)

    expect(cues).toEqual([
      feedbackCue("jump"),
      feedbackCue("checkpoint"),
      feedbackCue("attack"),
      feedbackCue("throw"),
      feedbackCue("pickup"),
      feedbackCue("playerHit"),
      feedbackCue("enemyHit"),
    ])
    expect(statuses).toEqual(["CHECKPOINT REACHED"])
    expect(bursts).toEqual([
      [12, 34, "#d9f49b"],
      [56, 78, "#f3cb9e"],
      [90, 100, "#ffdf8d"],
      [80, 88, "#e77b65", 20],
    ])
  })

  it("keeps the non-defeated enemy hit to its single hit effect", () => {
    const bursts: unknown[][] = []
    const feedback = new GameFeedback({
      playCue: () => undefined,
      burst: (...args) => bursts.push(args),
      setStatus: () => undefined,
    })

    feedback.enemyHit(30, 40, false)

    expect(bursts).toEqual([[30, 40, "#ffdf8d"]])
  })
})
