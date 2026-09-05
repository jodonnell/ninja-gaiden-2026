export type NinjaPose = "idle" | "run" | "jump" | "slash" | "climb"
export interface SpriteFrame {
  x: number
  y: number
  w: number
  h: number
  pivot: number
}
// The actual three running poses are at the bottom right of the blue sprite set.
// Coordinates include a consistent baseline; pivots keep each torso centered.
export const runFrames: readonly SpriteFrame[] = [
  { x: 205, y: 79, w: 26, h: 33, pivot: 15 },
  { x: 234, y: 79, w: 29, h: 33, pivot: 15 },
  { x: 267, y: 79, w: 25, h: 33, pivot: 13 },
]
const poses: Record<Exclude<NinjaPose, "run">, SpriteFrame> = {
  idle: { x: 2, y: 2, w: 19, h: 32, pivot: 10 },
  jump: { x: 76, y: 39, w: 22, h: 33, pivot: 10 },
  slash: { x: 59, y: 2, w: 40, h: 32, pivot: 10 },
  climb: { x: 0, y: 79, w: 20, h: 33, pivot: 10 },
}
export function ninjaFrame(pose: NinjaPose, distance: number): SpriteFrame {
  return pose === "run"
    ? runFrames[Math.floor(distance / 9) % runFrames.length]
    : poses[pose]
}
