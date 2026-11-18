// PALMA HEAT — the DOM HUD: wallet, stars, health, weapon readout, banners,
// toasts, the BUSTED meter and the canvas minimap (roads, bay, blips).
import { GRID, WATER_Z } from './config.js';

export class Hud {
  constructor() {
    const el = (id) => document.getElementById(id);
    this.cashEl = el('cash'); this.starsEl = el('stars');
    this.healthFill = el('healthFill'); this.weaponEl = el('weapon');
    this.objectiveEl = el('objective'); this.speedEl = el('speed');
    this.promptEl = el('prompt'); this.raceEl = el('raceInfo');
    this.dialogueEl = el('dialogue'); this.dName = el('dialogueName'); this.dText = el('dialogueText');
    this.toastsEl = el('toasts');
    this.bustWrap = el('bustWrap'); this.bustFill = el('bustFill');
    this.vignette = el('vignette');
    this.mm = el('minimap').getContext('2d');
    this.dialogueT = 0;
  }
  setCash(n) { this.cashEl.textContent = '$' + n.toLocaleString(); }
  setStars(w) {
    this.starsEl.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
    this.starsEl.style.color = w ? '#ffb02e' : '#8a8f98';
  }
  setHealth(h) {
    this.healthFill.style.width = Math.max(0, h) + '%';
    this.healthFill.style.background = h < 30 ? '#e33' : '#5ec95e';
    this.vignette.style.opacity = h < 45 ? String(0.55 * (1 - h / 45)) : '0';
  }
  setWeapon(ammo, reloading) { this.weaponEl.textContent = reloading ? 'PISTOL — RELOADING…' : `PISTOL ${ammo} / ∞`; }
  setObjective(t) { this.objectiveEl.textContent = t ? '🎯 ' + t : ''; this.objectiveEl.style.display = t ? 'block' : 'none'; }
  setSpeed(kmh, carName) { this.speedEl.textContent = carName ? `${carName} · ${kmh} km/h` : ''; }
  setPrompt(t) { this.promptEl.textContent = t || ''; this.promptEl.style.display = t ? 'block' : 'none'; }
  setRaceInfo(t) { this.raceEl.textContent = t || ''; }
  setBust(v) { this.bustWrap.style.display = v > 0.02 ? 'block' : 'none'; this.bustFill.style.width = (v * 100) + '%'; }
  dialogue(name, text, seconds = 6) {
    this.dName.textContent = name; this.dText.textContent = text;
    this.dialogueEl.style.display = 'block'; this.dialogueT = seconds;
  }
  toast(text) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = text;
    this.toastsEl.appendChild(d);
    setTimeout(() => d.remove(), 4200);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild.remove();
  }
  update(dt) {
    if (this.dialogueT > 0) {
      this.dialogueT -= dt;
      if (this.dialogueT <= 0) this.dialogueEl.style.display = 'none';
    }
  }
  drawMinimap(s) {
    const g = this.mm, W = 190, WORLD = 350, HALF = WORLD / 2;
    const px = (wx) => (wx + HALF) / WORLD * W;
    const pz = (wz) => (wz + HALF) / WORLD * W;
    g.fillStyle = '#20242c'; g.fillRect(0, 0, W, W);
    g.fillStyle = '#2e7fa8'; g.fillRect(0, pz(WATER_Z), W, W - pz(WATER_Z));
    g.strokeStyle = '#4a5058'; g.lineWidth = 3;
    for (const c of GRID) {
      g.beginPath(); g.moveTo(px(c), 0); g.lineTo(px(c), pz(WATER_Z)); g.stroke();
      g.beginPath(); g.moveTo(0, pz(c)); g.lineTo(W, pz(c)); g.stroke();
    }
    g.fillStyle = '#39e75f';
    for (const p of s.packages) g.fillRect(px(p.x) - 2, pz(p.z) - 2, 4, 4);
    if (s.marker) {
      g.fillStyle = '#ffc233';
      g.beginPath(); g.arc(px(s.marker.x), pz(s.marker.z), 4.5, 0, 7); g.fill();
    }
    const blink = ((performance.now() / 350) | 0) % 2 === 0;
    if (blink || s.wanted < 3) {
      g.fillStyle = '#3f7fff';
      for (const c of s.police) { g.beginPath(); g.arc(px(c.x), pz(c.z), 3, 0, 7); g.fill(); }
    }
    g.save();
    g.translate(px(s.x), pz(s.z));
    g.rotate(Math.atan2(Math.sin(s.yaw), -Math.cos(s.yaw)) + Math.PI);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill();
    g.restore();
  }
}
