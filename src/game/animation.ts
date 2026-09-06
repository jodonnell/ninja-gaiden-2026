export type NinjaPose = "idle" | "run" | "jump" | "slash" | "runSlash" | "climb"
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
// Four somersault poses, read left to right across the second row.
// Equal cells keep the rotation centered even when the body is horizontal.
export const jumpFrames: readonly SpriteFrame[] = [
  { x: 0, y: 38, w: 24, h: 32, pivot: 12 },
  { x: 25, y: 38, w: 24, h: 32, pivot: 12 },
  { x: 48, y: 38, w: 24, h: 32, pivot: 12 },
  { x: 73, y: 38, w: 24, h: 32, pivot: 12 },
]
// Alternating hand/foot placements for climbing, both facing left.
export const climbFrames: readonly SpriteFrame[] = [
  { x: 0, y: 79, w: 20, h: 33, pivot: 10 },
  { x: 22, y: 79, w: 20, h: 33, pivot: 10 },
]
const poses: Record<
  Exclude<NinjaPose, "run" | "jump" | "climb" | "runSlash">,
  SpriteFrame
> = {
  idle: { x: 2, y: 2, w: 19, h: 32, pivot: 10 },
  slash: { x: 59, y: 2, w: 40, h: 32, pivot: 10 },
}
export function ninjaFrame(
  pose: NinjaPose,
  distance: number,
  airTime = 0,
  climbDistance = 0,
): SpriteFrame {
  if (pose === "runSlash") return poses.slash
  if (pose === "climb")
    return climbFrames[Math.floor(climbDistance / 8) % climbFrames.length]
  if (pose === "jump")
    return jumpFrames[Math.floor(airTime * 12) % jumpFrames.length]
  if (pose === "run")
    return runFrames[Math.floor(distance / 9) % runFrames.length]
  return poses[pose]
}
