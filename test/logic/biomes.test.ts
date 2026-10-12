import { drawBiome } from "../../src/game/biomes"
import type { Rect } from "../../src/game/world"

function recordingContext() {
  const fills: { color: string; x: number; y: number; w: number; h: number }[] = []
  let fillStyle = ""
  const context = {
    set fillStyle(value: string) {
      fillStyle = value
    },
    get fillStyle() {
      return fillStyle
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ color: fillStyle, x, y, w, h })
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
  }
  return { context: context as unknown as CanvasRenderingContext2D, fills }
}

describe("biome drawing", () => {
  it.each([
    [0, "#201321", "#352933"],
    [1, "#94b4ac", "#3d5046"],
  ])("draws biome %i and its terrain colors", (id, background, terrainColor) => {
    const { context, fills } = recordingContext()
    const terrain: Rect[] = [{ x: 20, y: 200, w: 60, h: 70 }]

    drawBiome(context, id, terrain, 0, 0)

    expect(fills[0]).toMatchObject({ color: background, x: 0, y: 0, w: 480, h: 270 })
    expect(fills).toContainEqual({ color: terrainColor, x: 20, y: 200, w: 60, h: 70 })
  })

  it("moves terrain into the viewport using the camera offset", () => {
    const { context, fills } = recordingContext()

    drawBiome(context, 0, [{ x: 100, y: 190, w: 50, h: 80 }], 80, 0)

    expect(fills).toContainEqual({ color: "#352933", x: 20, y: 190, w: 50, h: 80 })
  })

  it("skips terrain fully outside the viewport", () => {
    const { context, fills } = recordingContext()

    drawBiome(context, 0, [{ x: 600, y: 190, w: 50, h: 80 }], 0, 0)

    expect(fills.some(({ color }) => color === "#352933")).toBe(false)
  })
})
