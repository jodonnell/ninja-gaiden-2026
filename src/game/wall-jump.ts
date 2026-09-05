// Remember the last wall briefly while the player switches from gripping it
// to pressing away. The direction must come from that wall, not current input.
export const WALL_JUMP_GRACE_SECONDS = 0.2

export class WallJumpGrace {
  private remaining = 0
  private lastWall = 0

  get direction(): number {
    return this.remaining > 0 ? this.lastWall : 0
  }

  update(wall: number, grounded: boolean, dt: number): void {
    if (grounded) {
      this.reset()
    } else if (wall) {
      this.lastWall = wall
      this.remaining = WALL_JUMP_GRACE_SECONDS
    } else {
      this.remaining = Math.max(0, this.remaining - dt)
    }
  }

  reset(): void {
    this.remaining = 0
    this.lastWall = 0
  }
}
