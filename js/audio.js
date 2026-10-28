class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.init();
      this.playTone(587.33, 0.08, 0.05);
    }
    return this.enabled;
  }

  playTone(freq = 520, duration = 0.08, maxGain = 0.05) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(maxGain, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn("Audio non disponible ou bloqué:", e);
    }
  }

  playFixation() {
    this.playTone(440, 0.12, 0.04);
  }

  playDigit() {
    this.playTone(659.25, 0.06, 0.03);
  }

  playSuccess() {
    this.playTone(880, 0.12, 0.05);
  }

  playError() {
    this.playTone(330, 0.15, 0.05);
  }
}

export const soundCtrl = new SoundController();
