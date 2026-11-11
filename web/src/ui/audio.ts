/**
 * Sound.
 *
 * Everything is synthesised with the Web Audio API. There are no audio
 * files to download, which keeps the whole game inside one small bundle and
 * means the sounds can be tuned by changing numbers rather than by
 * re-recording anything.
 *
 * The sounds are short, soft and slightly woody, to match the parchment-and-
 * oil-lamp feel of the game. Nothing is loud: this is a game people leave
 * open in a background tab while they work.
 */

import type { Settings } from '../save.ts';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: Settings;

  /** The last time a sound played, to stop rapid clicks stacking up. */
  private lastClick = 0;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  /** Create the audio context. Must be called from a user gesture. */
  public resume(): void {
    if (!this.settings.sound) return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  public update(_dt: number): void {
    // Reserved for future looping ambience.
  }

  /**
   * One tone.
   *
   * A sine or triangle oscillator through a gain envelope, with a little
   * detune so repeated hits do not sound mechanical.
   */
  private tone(
    freq: number,
    duration: number,
    options: {
      type?: OscillatorType;
      gain?: number;
      delay?: number;
      slideTo?: number;
    } = {}
  ): void {
    if (!this.settings.sound) return;
    if (!this.ctx || !this.master) return;

    const {
      type = 'triangle',
      gain = 0.5,
      delay = 0,
      slideTo,
    } = options;

    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    }

    // A short attack and a longer release: a plucked, wooden feel.
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  /** A filtered noise burst, used for the dig and for digging sounds. */
  private noise(duration: number, gain = 0.25, delay = 0): void {
    if (!this.settings.sound) return;
    if (!this.ctx || !this.master) return;

    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Fade the noise in and out so it does not click.
      const env = Math.sin((i / frames) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;

    const env2 = this.ctx.createGain();
    env2.gain.value = gain;

    src.connect(filter);
    filter.connect(env2);
    env2.connect(this.master);
    src.start(t0);
  }

  /** A UI click. Rate-limited so holding a button does not machine-gun. */
  public playClick(): void {
    const now = performance.now();
    if (now - this.lastClick < 40) return;
    this.lastClick = now;
    this.tone(520, 0.06, { type: 'square', gain: 0.16 });
  }

  /** A soft chime for a completed milestone. */
  public playChime(): void {
    this.tone(660, 0.22, { type: 'triangle', gain: 0.3 });
    this.tone(990, 0.3, { type: 'sine', gain: 0.22, delay: 0.07 });
  }

  /** A rising figure for a reel triple. */
  public playFanfare(): void {
    this.tone(523, 0.16, { type: 'triangle', gain: 0.3 });
    this.tone(659, 0.16, { type: 'triangle', gain: 0.3, delay: 0.09 });
    this.tone(784, 0.16, { type: 'triangle', gain: 0.3, delay: 0.18 });
    this.tone(1047, 0.4, { type: 'sine', gain: 0.3, delay: 0.27 });
  }

  /** The end of the day: a low settling tone. */
  public playDayEnd(): void {
    this.tone(220, 0.5, { type: 'sine', gain: 0.24 });
    this.tone(330, 0.4, { type: 'triangle', gain: 0.16, delay: 0.12 });
  }

  /** Digging: a short scrape of earth. */
  public playDig(): void {
    this.noise(0.22, 0.2);
    this.tone(140, 0.16, { type: 'sine', gain: 0.18 });
  }

  /** Something stolen: a low thud and a rustle. */
  public playTheft(): void {
    this.tone(110, 0.3, { type: 'sawtooth', gain: 0.16, slideTo: 70 });
    this.noise(0.18, 0.16, 0.04);
  }

  /** A find arriving. */
  public playFind(): void {
    this.tone(740, 0.12, { type: 'sine', gain: 0.22 });
    this.tone(988, 0.2, { type: 'sine', gain: 0.18, delay: 0.08 });
  }
}
