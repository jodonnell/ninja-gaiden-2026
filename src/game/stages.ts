import { platforms, type Rect } from "./world"
export type EnemyKind = "guard" | "bird" | "boss" | "hopper" | "monk" | "bat"
export type Stage = {
  terrain: Rect[]
  boss: string
  guards: { x: number; kind: EnemyKind }[]
  flyers: { x: number; kind: EnemyKind }[]
}
const ledges = (rows: number[][]): Rect[] =>
  rows.map(([x, y, w]) => ({ x, y, w, h: 300 - y }))
export const stages: Stage[] = [
  {
    terrain: platforms,
    boss: "BLACK LOTUS",
    guards: [340, 670, 990, 1310, 1590, 1800, 2040, 2340, 2670].map((x) => ({
      x,
      kind: "guard",
    })),
    flyers: [790, 1190, 1760, 2180, 2500].map((x) => ({ x, kind: "bird" })),
  },
  {
    terrain: ledges([
      [0, 224, 380],
      [420, 202, 280],
      [745, 180, 260],
      [1050, 206, 290],
      [1380, 184, 330],
      [1750, 210, 250],
      [2040, 188, 280],
      [2360, 216, 250],
      [2650, 196, 180],
      [2870, 220, 410],
    ]),
    boss: "JADE TALON",
    guards: [510, 830, 1150, 1470, 1820, 2160, 2460, 2740].map((x) => ({
      x,
      kind: "hopper",
    })),
    flyers: [640, 990, 1310, 1690, 1990, 2300, 2650].map((x) => ({
      x,
      kind: "bird",
    })),
  },
  {
    terrain: ledges([
      [0, 220, 320],
      [365, 220, 190],
      [595, 190, 210],
      [845, 220, 290],
      [1175, 200, 210],
      [1425, 220, 290],
      [1760, 190, 230],
      [2030, 220, 260],
      [2330, 196, 210],
      [2580, 220, 230],
      [2850, 220, 430],
    ]),
    boss: "CINDER LORD",
    guards: [460, 700, 970, 1270, 1640, 1860, 2180, 2440, 2710].map((x) => ({
      x,
      kind: "monk",
    })),
    flyers: [810, 1370, 1940, 2550].map((x) => ({ x, kind: "bat" })),
  },
]
export function floorAt(terrain: Rect[], x: number): number {
  return Math.min(
    ...terrain.filter((p) => x >= p.x && x + 14 <= p.x + p.w).map((p) => p.y),
  )
}
