import {
  COLS,
  ROWS,
  locations,
  locationAt,
  spawn,
  walkable,
} from "../../src/game/overworld"

describe("overworld navigation", () => {
  it("blocks mountains, water, and out-of-bounds tiles but permits the bridge", () => {
    expect(walkable(0, 0)).toBe(false)
    expect(walkable(19, 6)).toBe(false)
    expect(walkable(19, 7)).toBe(true)
    expect(walkable(-1, 7)).toBe(false)
    expect(walkable(COLS, ROWS)).toBe(false)
  })
  it("connects the starting point to every stage entrance", () => {
    const queue = [spawn]
    const visited = new Set([`${spawn.x},${spawn.y}`])
    for (let i = 0; i < queue.length; i++) {
      const { x, y } = queue[i]
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const key = `${x + dx},${y + dy}`
        if (walkable(x + dx, y + dy) && !visited.has(key)) {
          visited.add(key)
          queue.push({ x: x + dx, y: y + dy })
        }
      }
    }
    for (const location of locations) {
      expect(visited.has(`${location.x},${location.y}`)).toBe(true)
      expect(locationAt(location.x, location.y)).toBe(location)
    }
    expect(locationAt(spawn.x, spawn.y)).toBeUndefined()
  })
})
