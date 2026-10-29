interface HornNodes {
  oscillators: OscillatorNode[];
  gain: GainNode;
}

export class SoundSystem {
  private context: AudioContext | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private horn: HornNodes | null = null;

  public constructor(private enabled: boolean) {}

  public unlock(): void {
    if (!this.enabled) return;
    if (!this.context) this.createGraph();
    if (this.context?.state === 'suspended') void this.context.resume();
  }

  private createGraph(): void {
    this.context = new AudioContext();
    this.engineOscillator = this.context.createOscillator();
    this.engineOscillator.type = 'sawtooth';
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    this.engineOscillator.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.context.destination);
    this.engineOscillator.start();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.unlock();
    if (!enabled) this.stopHorn();
    if (this.engineGain && this.context) {
      this.engineGain.gain.setTargetAtTime(0, this.context.currentTime, 0.03);
    }
  }

  public update(speed: number, throttle: number, paused: boolean): void {
    if (!this.context || !this.engineOscillator || !this.engineGain || !this.enabled) return;
    const now = this.context.currentTime;
    const frequency = 34 + Math.abs(speed) * 3.6 + throttle * 14;
    const volume = paused ? 0.006 : 0.018 + throttle * 0.018 + Math.min(Math.abs(speed) / 26, 1) * 0.014;
    this.engineOscillator.frequency.setTargetAtTime(frequency, now, 0.06);
    this.engineGain.gain.setTargetAtTime(volume, now, 0.08);
  }

  public startHorn(): void {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context || this.horn) return;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.065, this.context.currentTime + 0.025);
    gain.connect(this.context.destination);
    const oscillators = [196, 247].map((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      oscillator.type = index === 0 ? 'square' : 'sawtooth';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start();
      return oscillator;
    });
    this.horn = { oscillators, gain };
  }

  public stopHorn(): void {
    if (!this.horn || !this.context) return;
    const { oscillators, gain } = this.horn;
    const now = this.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0.0001, now, 0.025);
    oscillators.forEach((oscillator) => oscillator.stop(now + 0.12));
    this.horn = null;
  }

  public dispose(): void {
    this.stopHorn();
    if (this.context) void this.context.close();
    this.context = null;
    this.engineGain = null;
    this.engineOscillator = null;
  }
}
