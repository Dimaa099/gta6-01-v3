// PALMA HEAT — pistol hitscan with tracer + muzzle light, magazine/reload,
// and an F-key melee swing. Targets are plain records registered by game.js;
// this module only applies damage and fires their callbacks.
import * as THREE from 'three';

export class Combat {
  constructor(scene, sound) {
    this.scene = scene; this.sound = sound;
    this.ammo = 12; this.reloading = 0;
    this.flash = new THREE.PointLight(0xffc266, 0, 18);
    scene.add(this.flash);
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 0 });
    this.tracer = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
      this.tracerMat);
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
    this.tracerT = 0;
    this.targets = [];
  }
  addTarget(t) { this.targets.push(t); return t; }
  removeTarget(t) { this.targets = this.targets.filter((x) => x !== t); }
  reload() { if (this.reloading <= 0 && this.ammo !== 12) this.reloading = 1.1; }
  update(dt) {
    if (this.reloading > 0) { this.reloading -= dt; if (this.reloading <= 0) this.ammo = 12; }
    if (this.tracerT > 0) { this.tracerT -= dt; this.tracerMat.opacity = Math.max(0, this.tracerT * 6); }
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 260);
  }
  damage(t, amount) {
    t.health -= amount;
    if (t.onHit) t.onHit(t);
    if (t.health <= 0 && t.alive) { t.alive = false; if (t.onDeath) t.onDeath(t); }
  }
  // Returns 'hit' | 'miss' | 'empty' | 'busy'.
  shoot(from, yaw, onCrime) {
    if (this.reloading > 0) return 'busy';
    if (this.ammo <= 0) { this.reload(); return 'empty'; }
    this.ammo--;
    this.sound.gunshot();
    if (onCrime) onCrime('shoot');
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    const muzzle = new THREE.Vector3(from.x + dx * 0.6, 1.35, from.z + dz * 0.6);
    let bestAlong = 60, hit = null;
    for (const t of this.targets) {
      if (!t.alive) continue;
      const ox = t.pos.x - muzzle.x, oz = t.pos.z - muzzle.z;
      const along = ox * dx + oz * dz;
      if (along < 0 || along > 60) continue;
      if (Math.abs(ox * dz - oz * dx) < 0.85 && along < bestAlong) { bestAlong = along; hit = t; }
    }
    const end = muzzle.clone();
    end.x += dx * (hit ? bestAlong : 42); end.z += dz * (hit ? bestAlong : 42);
    this.tracer.geometry.setFromPoints([muzzle, end]);
    this.tracerMat.opacity = 0.9; this.tracerT = 0.14;
    this.flash.position.copy(muzzle); this.flash.intensity = 60;
    if (hit) { this.damage(hit, 34); return 'hit'; }
    return 'miss';
  }
  melee(from, targets, onCrime) {
    this.sound.punch();
    let best = null, bd = 2.3;
    for (const t of targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.pos.x - from.x, t.pos.z - from.z);
      if (d < bd) { bd = d; best = t; }
    }
    if (!best) return false;
    this.damage(best, 26);
    if (onCrime) onCrime('assault');
    return true;
  }
}
