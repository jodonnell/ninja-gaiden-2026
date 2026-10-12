import { floorAt } from "./stages"
import type { Rect } from "./world"

export type Pickup = Rect & { kind: "health" | "ammo"; taken: boolean }
export type PickupStats = { hp: number; ammo: number; score: number }

export function collectPickup(
  pickup: Pickup,
  stats: PickupStats,
  overlapsPlayer: boolean,
): PickupStats | undefined {
  if (pickup.taken || !overlapsPlayer) return undefined
  pickup.taken = true
  return pickup.kind === "health"
    ? { ...stats, hp: Math.min(16, stats.hp + 6), score: stats.score + 100 }
    : { ...stats, ammo: stats.ammo + 8, score: stats.score + 100 }
}

export function consumeAmmo(ammo: number): number | undefined {
  return ammo > 0 ? ammo - 1 : undefined
}

export const CHECKPOINT_TRIGGER_X = 1545
export const CHECKPOINT_SPAWN_X = 1550
export const INITIAL_SPAWN_X = 64
export const PLAYER_HEIGHT = 28

export function updateCheckpoint(current: number, playerX: number): number {
  return current === 0 && playerX > CHECKPOINT_TRIGGER_X
    ? CHECKPOINT_SPAWN_X
    : current
}

export function playerSpawnPosition(checkpoint: number, terrain: Rect[]): { x: number; y: number } {
  const x = checkpoint || INITIAL_SPAWN_X
  return { x, y: floorAt(terrain, x) - PLAYER_HEIGHT }
}
