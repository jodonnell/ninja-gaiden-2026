import type { Rect } from "./world"
// Native pixel geometry: no per-frame color filters or offscreen effects.
export function drawBiome(
  ctx: CanvasRenderingContext2D,
  id: number,
  terrain: Rect[],
  cam: number,
  age: number,
) {
  const mountain = id === 1
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.round(x), Math.round(y), w, h)
  }
  const poly = (points: number[], c: string) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.moveTo(points[0], points[1])
    for (let i = 2; i < points.length; i += 2)
      ctx.lineTo(points[i], points[i + 1])
    ctx.closePath()
    ctx.fill()
  }
  rect(0, 0, 480, 270, mountain ? "#94b4ac" : "#201321")
  if (mountain) {
    rect(0, 130, 480, 140, "#72978d")
    for (let i = -1; i < 5; i++) {
      const x = i * 170 - ((cam * 0.15) % 170)
      poly([x - 60, 215, x + 60, 52 + (i % 2) * 22, x + 180, 215], "#496e6b")
      poly(
        [
          x + 25,
          99 + (i % 2) * 22,
          x + 60,
          52 + (i % 2) * 22,
          x + 97,
          104 + (i % 2) * 22,
          x + 65,
          89 + (i % 2) * 22,
          x + 52,
          99 + (i % 2) * 22,
        ],
        "#c1d3bd",
      )
    }
    for (let i = -1; i < 7; i++) {
      const x = i * 95 - ((cam * 0.35) % 95)
      poly([x - 30, 245, x + 25, 118, x + 85, 245], "#345952")
      rect(x + 27, 151, 12, 119, "#a2cbc0")
      for (let k = 0; k < 5; k++)
        rect(x + 30, 155 + ((k * 23 + age * 42) % 105), 3, 11, "#d1e3d0")
    }
    for (let i = -1; i < 10; i++) {
      const x = i * 63 - ((cam * 0.6) % 63),
        y = 102 + (i % 3) * 18
      rect(x, y, 4, 168, "#284c3c")
      for (let k = 0; k < 4; k++) {
        rect(x - 1, y + k * 25, 6, 2, "#6b9270")
        poly(
          [x, y + k * 25, x - 19, y + k * 25 - 12, x - 10, y + k * 25 + 2],
          "#386749",
        )
        poly(
          [
            x + 3,
            y + k * 25 + 7,
            x + 23,
            y + k * 25 - 4,
            x + 14,
            y + k * 25 + 10,
          ],
          "#477c50",
        )
      }
    }
    for (let i = 0; i < 3; i++)
      rect(
        ((i * 203 - cam * 0.1) % 600) - 50,
        137 + i * 34,
        190,
        4,
        "#b4c9b660",
      )
  } else {
    rect(0, 180, 480, 90, "#52252b")
    for (let i = -1; i < 7; i++) {
      const x = i * 105 - ((cam * 0.25) % 105)
      rect(x, 60, 60, 165, "#372333")
      rect(x + 8, 68, 44, 148, "#160f1c")
      poly([x + 8, 92, x + 30, 65, x + 52, 92], "#160f1c")
      rect(x + 24, 120, 12, 60, "#794332")
      rect(x + 18, 177, 24, 6, "#a6643e")
    }
    for (let i = -1; i < 5; i++) {
      const x = i * 155 - ((cam * 0.6) % 155)
      rect(x, 45, 18, 225, "#513040")
      rect(x - 5, 48, 28, 8, "#8a534c")
      rect(x + 4, 62, 3, 194, "#825046")
      rect(x - 3, 199, 24, 8, "#9d6451")
      rect(x + 52, 142, 18, 5, "#c88a53")
      poly(
        [
          x + 53,
          141,
          x + 55,
          128,
          x + 60,
          135,
          x + 64,
          118 + Math.sin(age * 9 + i) * 4,
          x + 69,
          142,
        ],
        "#f5a54e",
      )
      rect(x + 59, 136, 5, 7, "#ffe8a0")
    }
    rect(0, 252, 480, 18, "#b63f30")
    for (let i = 0; i < 40; i++)
      rect(
        (i * 17 - age * 13 + 480) % 480,
        253 + (i % 4) * 4,
        12,
        2,
        i % 2 ? "#ef783d" : "#ffbe63",
      )
    for (let i = 0; i < 16; i++)
      rect(
        (i * 71 + age * 9) % 480,
        250 - ((i * 19 + age * 24) % 200),
        2,
        2,
        "#e68c50",
      )
  }
  for (const p of terrain) {
    const x = p.x - cam
    if (x > 480 || x + p.w < 0) continue
    rect(x, p.y, p.w, p.h, mountain ? "#3d5046" : "#352933")
    rect(x, p.y, p.w, 4, mountain ? "#a2b66b" : "#c18c68")
    rect(x, p.y + 4, p.w, 4, mountain ? "#5d804d" : "#754947")
    for (let yy = p.y + 10; yy < 270; yy += 14)
      for (
        let xx = Math.max(0, Math.floor(-x / 24) * 24);
        xx < p.w && x + xx < 480;
        xx += 24
      ) {
        rect(x + xx + 2, yy, 19, 10, mountain ? "#566257" : "#49363e")
        rect(x + xx + 3, yy, 15, 1, mountain ? "#738074" : "#6d4b4f")
      }
    if (mountain)
      for (let xx = 5; xx < p.w; xx += 28)
        rect(x + xx, p.y + 4, 3, 9 + (xx % 7), "#779458")
  }
  const gate = 3205 - cam
  rect(gate, 135, 7, 85, mountain ? "#694c38" : "#aa5549")
  rect(gate + 42, 135, 7, 85, mountain ? "#694c38" : "#aa5549")
  rect(gate - 10, 131, 68, 7, mountain ? "#433f34" : "#d59362")
  rect(gate - 4, 147, 57, 5, mountain ? "#694c38" : "#aa5549")
}
