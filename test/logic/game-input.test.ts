import { describe, expect, it } from "vitest"
import { GameInput, type InputCommand } from "../../src/game/game-input"

class FakeWindow extends EventTarget {}
class FakeDocument extends EventTarget {
  hidden = false
}

class KeyEvent extends Event {
  constructor(readonly code: string, readonly repeat = false) {
    super("keydown", { cancelable: true })
  }
}

function setup() {
  const targetWindow = new FakeWindow()
  const targetDocument = new FakeDocument()
  const commands: InputCommand[] = []
  let pads: ArrayLike<Gamepad | null> = []
  const input = new GameInput({
    targetWindow: targetWindow as unknown as Window,
    targetDocument: targetDocument as unknown as Document,
    gamepads: () => pads,
    onCommand: (command) => commands.push(command),
  })
  return { input, targetWindow, targetDocument, commands, setPads: (value: ArrayLike<Gamepad | null>) => { pads = value } }
}

function key(target: EventTarget, type: string, code: string, repeat = false) {
  const event = new KeyEvent(code, repeat)
  Object.defineProperty(event, "type", { value: type })
  target.dispatchEvent(event)
  return event
}

function pad(buttons: number[] = [], axes: number[] = [0, 0]): Gamepad {
  return {
    axes,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i) })) as GamepadButton[],
  } as Gamepad
}

describe("GameInput", () => {
  it("maps keyboard controls and only reports pressed edges once", () => {
    const { input, targetWindow } = setup()
    const down = key(targetWindow, "keydown", "ArrowRight")
    expect(down.defaultPrevented).toBe(true)
    expect(input.snapshot()).toMatchObject({ right: true, axis: 1 })
    key(targetWindow, "keydown", "ArrowRight", true)
    key(targetWindow, "keydown", "KeyZ")
    key(targetWindow, "keydown", "KeyX")
    key(targetWindow, "keydown", "KeyC")
    expect(input.snapshot()).toMatchObject({ jumpPressed: true, jumpHeld: true, attackPressed: true, throwPressed: true })
    input.clearPressed()
    expect(input.snapshot()).toMatchObject({ jumpPressed: false, jumpHeld: true, attackPressed: false, throwPressed: false })
    key(targetWindow, "keyup", "KeyZ")
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it("supports movement aliases, key actions, blur, and visibility reset", () => {
    const { input, targetWindow, targetDocument, commands } = setup()
    for (const code of ["KeyA", "KeyW", "KeyS"]) key(targetWindow, "keydown", code)
    expect(input.snapshot()).toMatchObject({ left: true, up: true, down: true, axis: -1, climbUp: true, climbDown: true })
    key(targetWindow, "keydown", "Enter")
    key(targetWindow, "keydown", "Escape")
    key(targetWindow, "keydown", "KeyM")
    expect(commands).toEqual(["begin", "pause", "map"])
    targetWindow.dispatchEvent(new Event("blur"))
    expect(input.snapshot()).toMatchObject({ left: false, up: false, down: false })
    key(targetWindow, "keydown", "KeyZ")
    targetDocument.hidden = true
    targetDocument.dispatchEvent(new Event("visibilitychange"))
    expect(input.snapshot().jumpHeld).toBe(false)
  })

  it("tracks gamepad held state and edge-triggered transitions", () => {
    const { input, setPads, commands } = setup()
    setPads([pad([0, 2, 9], [-0.7, 0])])
    expect(input.snapshot()).toMatchObject({ left: true, axis: -1, jumpPressed: true, jumpHeld: true, attackPressed: true })
    expect(commands).toEqual(["gamepadBegin"])
    input.clearPressed()
    expect(input.snapshot()).toMatchObject({ left: true, jumpPressed: false, jumpHeld: true, attackPressed: false })
    expect(commands).toEqual(["gamepadBegin"])
    setPads([pad([], [0, 0])])
    expect(input.snapshot()).toMatchObject({ left: false, jumpHeld: false })
    setPads([pad([0], [0, 0])])
    expect(input.snapshot().jumpPressed).toBe(true)
    expect(commands).toEqual(["gamepadBegin"])
  })
})
