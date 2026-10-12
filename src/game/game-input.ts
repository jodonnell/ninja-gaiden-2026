export type InputSnapshot = {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
  axis: number
  jumpPressed: boolean
  jumpHeld: boolean
  climbUp: boolean
  climbDown: boolean
  attackPressed: boolean
  throwPressed: boolean
}

export type InputCommand = "begin" | "gamepadBegin" | "pause" | "map"

const validKeys = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS", "KeyZ", "KeyX", "KeyC",
  "Space", "Enter", "Escape", "KeyP", "KeyM",
])

type InputOptions = {
  onCommand: (command: InputCommand) => void
  onBlur?: () => void
  onHidden?: () => void
  targetWindow?: Window
  targetDocument?: Document
  gamepads?: () => ArrayLike<Gamepad | null>
  pointerButtons?: Iterable<HTMLElement>
}

export class GameInput {
  private readonly held = new Set<string>()
  private readonly pressed = new Set<string>()
  private previousPad = new Set<string>()
  private readonly onCommand: InputOptions["onCommand"]

  constructor(options: InputOptions) {
    this.onCommand = options.onCommand
    const win = options.targetWindow ?? window
    const doc = options.targetDocument ?? document
    win.addEventListener("keydown", (event) => this.keyDown(event as KeyboardEvent))
    win.addEventListener("keyup", (event) => this.keyUp(event as KeyboardEvent))
    win.addEventListener("blur", () => {
      this.clear()
      options.onBlur?.()
    })
    doc.addEventListener("visibilitychange", () => {
      if (doc.hidden) {
        this.clear()
        options.onHidden?.()
      }
    })
    for (const button of options.pointerButtons ?? []) {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault()
        const pointerEvent = event as PointerEvent
        button.setPointerCapture(pointerEvent.pointerId)
        const key = button.dataset.key
        if (key) {
          this.held.add(key)
          this.pressed.add(key)
        }
      })
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(type, () => {
          const key = button.dataset.key
          if (key) this.held.delete(key)
        })
    }
    this.getGamepads = options.gamepads ?? (() => navigator.getGamepads?.() ?? [])
  }

  private readonly getGamepads: () => ArrayLike<Gamepad | null>

  private keyDown(event: KeyboardEvent) {
    if (!validKeys.has(event.code)) return
    event.preventDefault()
    if (event.repeat) return
    if (event.code === "KeyM") {
      this.onCommand("map")
      return
    }
    if (event.code === "Enter") {
      this.onCommand("begin")
      return
    }
    if (event.code === "Escape" || event.code === "KeyP") {
      this.onCommand("pause")
      return
    }
    this.pressed.add(event.code)
    this.held.add(event.code)
  }

  private keyUp(event: KeyboardEvent) {
    this.held.delete(event.code)
  }

  private pollGamepad() {
    const pad = this.getGamepads()[0]
    const next = new Set<string>()
    if (pad) {
      if ((pad.axes[0] ?? 0) < -0.3 || pad.buttons[14]?.pressed) next.add("ArrowLeft")
      if ((pad.axes[0] ?? 0) > 0.3 || pad.buttons[15]?.pressed) next.add("ArrowRight")
      if ((pad.axes[1] ?? 0) > 0.3 || pad.buttons[13]?.pressed) next.add("ArrowDown")
      if ((pad.axes[1] ?? 0) < -0.3 || pad.buttons[12]?.pressed) next.add("ArrowUp")
      if (pad.buttons[0]?.pressed) next.add("KeyZ")
      if (pad.buttons[2]?.pressed || pad.buttons[1]?.pressed) next.add("KeyX")
      if (pad.buttons[3]?.pressed) next.add("KeyC")
      if (pad.buttons[9]?.pressed) next.add("Enter")
    }
    for (const key of this.previousPad)
      if (!next.has(key)) this.held.delete(key)
    for (const key of next) {
      this.held.add(key)
      if (!this.previousPad.has(key)) {
        if (key === "Enter") this.onCommand("gamepadBegin")
        else this.pressed.add(key)
      }
    }
    this.previousPad = next
  }

  snapshot(): InputSnapshot {
    this.pollGamepad()
    const left = this.held.has("ArrowLeft") || this.held.has("KeyA")
    const right = this.held.has("ArrowRight") || this.held.has("KeyD")
    const up = this.held.has("ArrowUp") || this.held.has("KeyW")
    const down = this.held.has("ArrowDown") || this.held.has("KeyS")
    return {
      left, right, up, down,
      axis: Number(right) - Number(left),
      jumpPressed: this.pressed.has("KeyZ") || this.pressed.has("Space"),
      jumpHeld: this.held.has("KeyZ") || this.held.has("Space"),
      climbUp: up,
      climbDown: down,
      attackPressed: this.pressed.has("KeyX"),
      throwPressed: this.pressed.has("KeyC"),
    }
  }

  clearPressed() {
    this.pressed.clear()
  }

  clear() {
    this.held.clear()
    this.pressed.clear()
    this.previousPad.clear()
  }
}
