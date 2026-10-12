import {
  climbFrames,
  jumpFrames,
  ninjaFrame,
  runFrames,
} from "../../src/game/animation"

describe("ninja animation frame selection", () => {
  it("uses the fixed idle and slash poses", () => {
    expect(ninjaFrame("idle", 100)).toEqual({
      x: 2,
      y: 2,
      w: 19,
      h: 32,
      pivot: 10,
    })
    expect(ninjaFrame("slash", 0)).toEqual({
      x: 59,
      y: 2,
      w: 40,
      h: 32,
      pivot: 10,
    })
    expect(ninjaFrame("runSlash", 0)).toBe(ninjaFrame("slash", 0))
  })

  it("cycles through running frames by traveled distance", () => {
    expect(ninjaFrame("run", 0)).toBe(runFrames[0])
    expect(ninjaFrame("run", 8.99)).toBe(runFrames[0])
    expect(ninjaFrame("run", 9)).toBe(runFrames[1])
    expect(ninjaFrame("run", 27)).toBe(runFrames[0])
  })

  it("cycles through jump frames by airtime", () => {
    expect(ninjaFrame("jump", 0, 0)).toBe(jumpFrames[0])
    expect(ninjaFrame("jump", 0, 0.09)).toBe(jumpFrames[1])
    expect(ninjaFrame("jump", 0, 0.26)).toBe(jumpFrames[3])
    expect(ninjaFrame("jump", 0, 0.34)).toBe(jumpFrames[0])
  })

  it("alternates climb frames by climb distance", () => {
    expect(ninjaFrame("climb", 0, 0, 0)).toBe(climbFrames[0])
    expect(ninjaFrame("climb", 0, 0, 8)).toBe(climbFrames[1])
    expect(ninjaFrame("climb", 0, 0, 16)).toBe(climbFrames[0])
  })
})
