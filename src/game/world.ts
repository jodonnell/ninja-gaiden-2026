export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Body extends Rect {
  vx: number
  vy: number
  grounded: boolean
  wall: number
}
export const WIDTH = 480
export const HEIGHT = 270
export const WORLD_END = 3280
export const platforms: Rect[] = [
  { x: 0, y: 220, w: 540, h: 80 },
  { x: 595, y: 220, w: 260, h: 80 },
  { x: 895, y: 196, w: 280, h: 105 },
  { x: 1225, y: 220, w: 265, h: 80 },
  { x: 1540, y: 202, w: 320, h: 100 },
  { x: 1920, y: 220, w: 290, h: 80 },
  { x: 2260, y: 196, w: 240, h: 110 },
  { x: 2550, y: 220, w: 730, h: 80 },
  { x: 240, y: 170, w: 82, h: 12 },
  { x: 420, y: 139, w: 70, h: 12 },
  { x: 715, y: 162, w: 70, h: 12 },
  { x: 1035, y: 141, w: 90, h: 12 },
  { x: 1370, y: 157, w: 80, h: 12 },
  { x: 1660, y: 146, w: 85, h: 12 },
  { x: 2000, y: 158, w: 100, h: 12 },
  { x: 2390, y: 139, w: 80, h: 12 },
]
export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}
export function move(
  body: Body,
  dt: number,
  terrain: Rect[] = platforms,
): void {
  body.wall = 0
  body.x += body.vx * dt
  for (const p of terrain)
    if (overlaps(body, p)) {
      if (body.vx > 0) {
        body.x = p.x - body.w
        body.wall = 1
      } else if (body.vx < 0) {
        body.x = p.x + p.w
        body.wall = -1
      }
    }
  body.grounded = false
  body.y += body.vy * dt
  for (const p of terrain)
    if (overlaps(body, p)) {
      if (body.vy >= 0) {
        body.y = p.y - body.h
        body.grounded = true
      } else {
        body.y = p.y + p.h
      }
      body.vy = 0
    }
  body.x = Math.max(0, Math.min(WORLD_END - body.w, body.x))
}
