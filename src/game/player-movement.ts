import { move, type Body, type Rect } from "./world"

export type PlayerMovementState = {
  coyote: number
  jumpBuffer: number
  wallJumpLock: number
  wallGrace: number
  lastWall: number
  facing: number
}

export type PlayerMovementInput = {
  axis: number
  jumpPressed: boolean
  jumpHeld: boolean
  climbUp: boolean
  climbDown: boolean
  knockbackTime: number
  knockbackVelocity: number
}

export type PlayerMovementResult = {
  jumped: boolean
  jumpWall: number
  previousX: number
  previousY: number
}

export function createPlayerMovementState(): PlayerMovementState {
  return { coyote: 0, jumpBuffer: 0, wallJumpLock: 0, wallGrace: 0, lastWall: 0, facing: 1 }
}

export function resetPlayerMovementState(state: PlayerMovementState): void {
  Object.assign(state, createPlayerMovementState())
}

export function updatePlayerMovement(
  player: Body,
  state: PlayerMovementState,
  input: PlayerMovementInput,
  dt: number,
  terrain: Rect[],
): PlayerMovementResult {
  const wall = player.wall
  if (player.grounded) {
    state.wallGrace = 0
    state.lastWall = 0
  } else if (wall) {
    state.lastWall = wall
    state.wallGrace = 0.2
  } else state.wallGrace = Math.max(0, state.wallGrace - dt)
  const jumpWall = state.wallGrace > 0 ? state.lastWall : 0
  state.wallJumpLock = Math.max(0, state.wallJumpLock - dt)

  if (input.knockbackTime > 0) {
    const recoilWeight = Math.min(1, input.knockbackTime / 0.14) ** 2
    player.vx = input.axis * 118 + (input.knockbackVelocity - input.axis * 118) * recoilWeight
  } else if (state.wallJumpLock === 0) player.vx = input.axis * 118
  if (input.axis) state.facing = input.axis

  state.coyote = player.grounded ? 0.1 : Math.max(0, state.coyote - dt)
  state.jumpBuffer = input.jumpPressed ? 0.12 : Math.max(0, state.jumpBuffer - dt)
  let jumped = false
  if (input.knockbackTime === 0 && state.jumpBuffer > 0 && (state.coyote > 0 || jumpWall)) {
    player.vy = -282
    if (jumpWall) {
      player.vx = -jumpWall * 155
      state.facing = -jumpWall
      state.wallJumpLock = 0.18
    }
    state.wallGrace = 0
    state.lastWall = 0
    state.jumpBuffer = 0
    state.coyote = 0
    jumped = true
  }

  if (input.knockbackTime === 0 && !input.jumpHeld && player.vy < -110)
    player.vy += 950 * dt
  player.vy += 730 * dt
  if (
    wall && input.axis === wall && input.knockbackTime === 0 && state.wallJumpLock === 0 &&
    (player.vy >= 0 || input.climbUp)
  ) player.vy = input.climbUp ? -85 : input.climbDown ? 75 : 15

  const previousX = player.x
  const previousY = player.y
  move(player, dt, terrain)
  return { jumped, jumpWall, previousX, previousY }
}
