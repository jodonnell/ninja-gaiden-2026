export const TILE = 16
export const MAP_TOP = 34
export const COLS = 30
export const ROWS = 13
export type Location = {
  id: number
  name: string
  x: number
  y: number
}
export const locations: Location[] = [
  { id: 0, name: "THE NEON DISTRICT", x: 6, y: 7 },
  { id: 1, name: "JADE MOUNTAIN", x: 14, y: 3 },
  { id: 2, name: "CRIMSON TEMPLE", x: 25, y: 7 },
]
export const spawn = { x: 3, y: 7 }
// Tile indices in the original sheet's two-row tile palette.
export const map: number[][] = Array.from({ length: ROWS }, (_, y) =>
  Array.from({ length: COLS }, (_, x) => {
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return 2
    if (x >= 19 && x <= 20) return 9
    if ((x < 10 && y < 5) || (x > 22 && y > 9)) return 4
    if ((x > 10 && x < 17 && y > 9) || (x > 23 && y < 4)) return 2
    if (y === 7 && x >= 2 && x <= 27) return 0
    if (x === 14 && y >= 3 && y <= 7) return 0
    return 3
  }),
)
map[7][19] = 8
map[7][20] = 8
for (const location of locations) map[location.y][location.x] = 14
export function walkable(x: number, y: number): boolean {
  const tile = map[y]?.[x]
  return tile !== undefined && tile !== 2 && tile !== 9
}
export function locationAt(x: number, y: number): Location | undefined {
  return locations.find((location) => location.x === x && location.y === y)
}

export function drawOverworld(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  player: { x: number; y: number },
  age: number,
  cleared: Set<number>,
) {
  ctx.fillStyle = "#101c23"
  ctx.fillRect(0, 0, 480, 270)
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const tile = map[y][x]
      const row = tile >= 12 ? 1 : 0
      const col = row ? tile - 12 : tile
      ctx.drawImage(
        sheet,
        2059 + col * 17,
        986 + row * 17,
        16,
        16,
        x * TILE,
        MAP_TOP + y * TILE,
        TILE,
        TILE,
      )
    }
  ctx.font = "bold 9px monospace"
  ctx.fillStyle = "#f4deb0"
  ctx.fillText("SHADOW PROVINCE", 12, 14)
  ctx.fillStyle = "#9aaf9b"
  ctx.font = "bold 7px monospace"
  ctx.fillText("OVERWORLD / CHOOSE YOUR PATH", 12, 26)
  ctx.fillText(`${cleared.size} / ${locations.length} STAGES CLEARED`, 337, 20)
  for (const location of locations) {
    const x = location.x * TILE,
      y = MAP_TOP + location.y * TILE
    ctx.strokeStyle = cleared.has(location.id) ? "#b8f179" : "#fff1b8"
    ctx.strokeRect(x - 2, y - 2, 19, 19)
    ctx.fillStyle = "#101c23"
    ctx.fillRect(x - 1, y - 12, 18, 9)
    ctx.fillStyle = cleared.has(location.id) ? "#b8f179" : "#fff1b8"
    ctx.fillText(
      cleared.has(location.id) ? "OK" : `0${location.id + 1}`,
      x + 2,
      y - 5,
    )
  }
  // Small ninja marker, drawn at native pixel resolution.
  const px = Math.round(player.x * TILE),
    py = MAP_TOP + Math.round(player.y * TILE)
  const step = Math.sin(age * 12) > 0 ? 1 : 0
  ctx.fillStyle = "#25351f"
  ctx.fillRect(px + 3, py + 14, 11, 2)
  ctx.fillStyle = "#17264c"
  ctx.fillRect(px + 5, py + 1, 7, 6)
  ctx.fillRect(px + 4, py + 7, 9, 6)
  ctx.fillRect(px + 4, py + 12, 3, 3 + step)
  ctx.fillRect(px + 10, py + 12, 3, 4 - step)
  ctx.fillStyle = "#648de2"
  ctx.fillRect(px + 5, py + 2, 7, 2)
  ctx.fillRect(px + 6, py + 8, 4, 4)
  ctx.fillStyle = "#f5d3a2"
  ctx.fillRect(px + 7, py + 4, 5, 2)
  ctx.fillStyle = "#e9e8c4"
  ctx.fillRect(px + 13, py + 5, 1, 8)
  ctx.fillStyle = "#e2d6b2"
  ctx.font = "bold 8px monospace"
  ctx.fillText("ARROWS / WASD  MOVE     WALK INTO A TEMPLE TO ENTER", 12, 259)
}
