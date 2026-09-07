import type { GameEvent } from "./model";

/** Small, original synthesized sound palette; no audio downloads or autoplay. */
export class Sound {
  enabled = false;
  private context?: AudioContext;
  private master?: GainNode;
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      if (!this.master) {
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
      }
      this.master.gain.value = 0.18;
      await this.context.resume();
      this.tone(220, 440, 0.3, "sine", 0.2);
    } else if (this.context) await this.context.suspend();
  }
  tone(
    from: number,
    to: number,
    duration: number,
    type: OscillatorType,
    volume = 0.5,
  ) {
    if (
      !this.enabled ||
      !this.context ||
      !this.master ||
      this.context.state !== "running"
    )
      return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    oscillator.stop(now + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  play(event: GameEvent) {
    switch (event.type) {
      case "slash":
        this.tone(410, 75, 0.12, "sawtooth", 0.22);
        break;
      case "hit":
        this.tone(180, 38, 0.15, "triangle", 0.9);
        this.tone(840, 140, 0.07, "square", 0.16);
        break;
      case "hurt":
        this.tone(120, 32, 0.24, "sawtooth", 0.6);
        break;
      case "kill":
        this.tone(680, 1250, 0.19, "sine", 0.4);
        break;
      case "jump":
        this.tone(140, 300, 0.13, "triangle", 0.25);
        break;
      case "roll":
        this.tone(160, 45, 0.18, "triangle", 0.4);
        break;
      case "heal":
        this.tone(330, 660, 0.5, "sine", 0.5);
        this.tone(495, 990, 0.7, "sine", 0.3);
        break;
      case "cast":
        this.tone(250, 950, 0.22, "sawtooth", 0.18);
        break;
      case "slam":
      case "phase":
        this.tone(95, 28, 0.65, "triangle", 0.9);
        this.tone(420, 390, 0.8, "sine", 0.16);
        break;
    }
  }
}
