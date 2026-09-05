import { WallJumpGrace } from "../../src/game/wall-jump"

describe("wall jump input grace", () => {
  it.each([-1, 1])(
    "remembers wall %i while pressing away for 150 ms",
    (wall) => {
      const grace = new WallJumpGrace()
      grace.update(wall, false, 1 / 60)
      for (let frame = 0; frame < 9; frame++) grace.update(0, false, 1 / 60)
      expect(grace.direction).toBe(wall)
      // The launch still points away from the old wall on either side.
      expect(-grace.direction * 155).toBe(-wall * 155)
    },
  )
  it("expires after the grace window instead of allowing an air jump later", () => {
    const grace = new WallJumpGrace()
    grace.update(1, false, 1 / 60)
    for (let frame = 0; frame < 13; frame++) grace.update(0, false, 1 / 60)
    expect(grace.direction).toBe(0)
  })
  it("cannot reuse the same wall contact after a jump", () => {
    const grace = new WallJumpGrace()
    grace.update(1, false, 1 / 60)
    grace.reset()
    grace.update(0, false, 1 / 60)
    expect(grace.direction).toBe(0)
    grace.update(-1, false, 1 / 60)
    expect(grace.direction).toBe(-1)
  })
  it("clears the remembered wall when landing or respawning", () => {
    const grace = new WallJumpGrace()
    grace.update(1, false, 1 / 60)
    grace.update(0, true, 1 / 60)
    expect(grace.direction).toBe(0)
    grace.update(1, false, 1 / 60)
    grace.reset()
    expect(grace.direction).toBe(0)
  })
})
