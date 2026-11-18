// PALMA HEAT — every sound is synthesized live with WebAudio. No audio assets.
export class SoundBank {
  constructor() {
    this.ctx = null; this.bus = null; this.muted = false;
    this.eng = null; this.engGain = null;
    this.sir = null; this.sirGain = null; this.sirPhase = 0;
    this.padOn = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.bus = this.ctx.createGain();
      this.bus.gain.value = this.muted ? 0 : 0.5;
      this.bus.connect(this.ctx.destination);
      this.startPad();
    } catch { /* silent fallback */ }
  }
  setMuted(m) {
    this.muted = m;
    if (this.bus) this.bus.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.04);
  }
  blip(freq, dur, type = 'sine', vol = 0.2, glide = 0, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(24, glide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.bus);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  burst(dur, vol, cutoff) {
    if (!this.ctx) return;
    const len = Math.max(1, (this.ctx.sampleRate * dur) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = cutoff;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(flt); flt.connect(g); g.connect(this.bus); src.start();
  }
  gunshot() { this.burst(0.15, 0.5, 850); this.blip(150, 0.09, 'square', 0.14, 48); }
  punch() { this.burst(0.07, 0.3, 480); this.blip(95, 0.08, 'sine', 0.24, 44); }
  pickup() { this.blip(880, 0.09, 'sine', 0.2); this.blip(1318, 0.15, 'sine', 0.2, 0, 0.08); }
  cash() { this.blip(1568, 0.08, 'square', 0.1); this.blip(2093, 0.16, 'square', 0.1, 0, 0.07); }
  horn() { this.blip(370, 0.35, 'sawtooth', 0.11); this.blip(466, 0.35, 'sawtooth', 0.11); }
  sting(win = true) {
    (win ? [523, 659, 784, 1047] : [392, 330, 262]).forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.22, 0, i * 0.11));
  }
  startPad() {
    if (!this.ctx || this.padOn) return; this.padOn = true;
    const g = this.ctx.createGain(); g.gain.value = 0.03; g.connect(this.bus);
    for (const f of [110, 164.8, 220]) {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      o.connect(g); o.start();
    }
  }
  setEngine(ratio, active) {
    if (!this.ctx) return;
    if (active && !this.eng) {
      this.eng = this.ctx.createOscillator(); this.eng.type = 'sawtooth';
      this.engGain = this.ctx.createGain(); this.engGain.gain.value = 0;
      const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 520;
      this.eng.connect(flt); flt.connect(this.engGain); this.engGain.connect(this.bus);
      this.eng.start();
    }
    if (this.eng) {
      const t = this.ctx.currentTime, r = Math.abs(ratio);
      this.eng.frequency.setTargetAtTime(52 + r * 165, t, 0.08);
      this.engGain.gain.setTargetAtTime(active ? 0.05 + r * 0.055 : 0, t, 0.1);
    }
  }
  setSiren(active, dt) {
    if (!this.ctx) return;
    if (active && !this.sir) {
      this.sir = this.ctx.createOscillator(); this.sir.type = 'triangle';
      this.sirGain = this.ctx.createGain(); this.sirGain.gain.value = 0.04;
      this.sir.connect(this.sirGain); this.sirGain.connect(this.bus);
      this.sir.start();
    }
    if (this.sir) {
      this.sirPhase += dt;
      const hi = ((this.sirPhase * 1.6) | 0) % 2 === 0;
      this.sir.frequency.setTargetAtTime(hi ? 880 : 660, this.ctx.currentTime, 0.03);
      if (!active) { try { this.sir.stop(); } catch { /* noop */ } this.sir = null; this.sirGain = null; }
    }
  }
}
