import type { EnemyKind } from "./stages"

export type Combatant = { hp: number; kind: EnemyKind }
export type DamageResult = { damage: number; defeated: boolean; score: number }

export function damageEnemy(enemy: Combatant, damage: number): DamageResult {
  if (enemy.hp <= 0 || damage <= 0) return { damage: 0, defeated: false, score: 0 }
  enemy.hp -= damage
  const defeated = enemy.hp <= 0
  return {
    damage,
    defeated,
    score: defeated ? (enemy.kind === "boss" ? 5000 : enemy.kind === "bird" ? 150 : 200) : 0,
  }
}

export function resolveSwordHit(
  enemy: Combatant,
  attackId: number,
  hitEnemies: Map<Combatant, number>,
): DamageResult | undefined {
  if (enemy.hp <= 0 || hitEnemies.get(enemy) === attackId) return undefined
  hitEnemies.set(enemy, attackId)
  return damageEnemy(enemy, 1)
}

export function resolveShurikenHit(enemy: Combatant): DamageResult | undefined {
  if (enemy.hp <= 0) return undefined
  return damageEnemy(enemy, 2)
}
