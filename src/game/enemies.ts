import { platforms } from "./world"
import type { Body, Rect } from "./world"

export function patrolDirection(
  body: Body,
  home: number,
  direction: number,
  terrain: Rect[] = platforms,
): number {
  // Select an inward direction before moving; toggling every frame outside a
  // boundary traps guards in a one-pixel oscillation.
  let next = direction
  if (body.x >= home + 48) next = -1
  else if (body.x <= home - 48) next = 1
  if (body.wall === next) next = -next
  if (body.grounded) {
    const foot = next > 0 ? body.x + body.w + 2 : body.x - 2
    const supported = terrain.some(
      (p) =>
        foot >= p.x &&
        foot < p.x + p.w &&
        Math.abs(p.y - (body.y + body.h)) < 2,
    )
    if (!supported) next = -next
  }
  return next
}
