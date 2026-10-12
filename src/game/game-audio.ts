/** Owns the sound toggle and lazy Web Audio synthesis used by the game. */
export class GameAudio {
  private enabled = false
  private context: AudioContext | undefined

  constructor(private readonly createContext = () => new AudioContext()) {}

  get isEnabled() {
    return this.enabled
  }

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  play(
    frequency: number,
    duration = 0.08,
    type: OscillatorType = "square",
    volume = 0.025,
  ) {
    if (!this.enabled) return
    this.context ??= this.createContext()
    const audio = this.context
    void audio.resume()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, frequency / 2),
      audio.currentTime + duration,
    )
    gain.gain.setValueAtTime(volume, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + duration)
  }
}
