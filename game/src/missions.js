// PALMA HEAT — Carmen Vega's three jobs, told over phone-text banners, plus the
// repeatable side hustle: green package pickups and three checkpoint races.
// Stage changes are proximity/flag driven; game.js feeds player state each tick.
import * as THREE from 'three';
import { POIS } from './config.js';

export const GARAGE_MARKER = { x: -117, z: -113 };
export const DOCKS_POINT = { x: -90, z: 124 };
export const PACKAGE_POINT = { x: -90, z: 132 };
export const BANK_DOOR = { x: 14, z: -38 };
export const VAULT_POINT = { x: 28.5, z: -38 };

const CARMEN = '📱 Carmen "La Jefa" Vega';
export const MISSION_DEFS = [
  { title: 'First Run', pay: 500 },
  { title: 'Marina Muscle', pay: 900 },
  { title: 'Palma Trust', pay: 2500 },
];
export const RACES = [
  { id: 'bay-loop', name: 'Bay Loop', start: { x: -60, z: 120 }, cps: [{ x: 0, z: 120 }, { x: 60, z: 120 }, { x: 118, z: 60 }, { x: 118, z: 0 }] },
  { id: 'downtown-dash', name: 'Downtown Dash', start: { x: 0, z: -60 }, cps: [{ x: 30, z: -30 }, { x: 60, z: 0 }, { x: 30, z: 30 }, { x: 0, z: 60 }] },
  { id: 'grid-iron', name: 'Grid Iron', start: { x: -120, z: 0 }, cps: [{ x: -60, z: 30 }, { x: 0, z: 0 }, { x: 60, z: -30 }, { x: 120, z: 0 }] },
];
const PACKAGE_SPOTS = [
  { x: -30, z: -66 }, { x: 66, z: -30 }, { x: 30, z: 66 }, { x: -66, z: 30 }, { x: 96, z: -66 },
];

export class Missions {
  constructor(scene, hud, sound, hooks) {
    this.hud = hud; this.sound = sound; this.hooks = hooks;
    this.mission = 0; this.stage = 0; this.started = false; this.storyDone = false;
    this.betweenCd = 0; this.pendingStart = false;
    this.timer = 0; this.vaultProgress = 0;
    this.markerPos = null;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
    this.beam.position.y = 13; this.beam.visible = false; scene.add(this.beam);
    this.packages = PACKAGE_SPOTS.map((p) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshBasicMaterial({ color: 0x39e75f }));
      m.position.set(p.x, 0.9, p.z); scene.add(m);
      return { x: p.x, z: p.z, mesh: m, active: true, respawn: 0 };
    });
    this.raceRings = RACES.map((r) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.22, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x53c8ff }));
      m.rotation.x = Math.PI / 2; m.position.set(r.start.x, 1.1, r.start.z); scene.add(m);
      return m;
    });
    this.race = null; this.bestRaces = {};
  }
  say(text) { this.hud.dialogue(CARMEN, text); }
  startMission(m) {
    this.mission = m; this.stage = 0; this.started = true; this.vaultProgress = 0;
    if (m === 0) {
      this.say('Marco, mi amor. My sedan is outside the garage — take it to the Docks and bring me my package. Quietly.');
      this.hud.setObjective("Get in Vega's sedan at Vega's Garage");
    } else if (m === 1) {
      this.say('A collector owes me an orange Cometa GT. It sits in the Marina lot — guarded. Take it, bring it home. Fast.');
      this.hud.setObjective('Steal the orange Cometa GT from the Marina Lot');
    } else if (m === 2) {
      this.say('Last job, Marco. Palma Trust Bank. Walk in, hold at the vault, and do not stop for anyone. Then disappear to the hideout.');
      this.hud.setObjective('Drive to Palma Trust Bank');
    }
    if (this.hooks.onMissionStart) this.hooks.onMissionStart(m);
  }
  completeMission() {
    const pay = MISSION_DEFS[this.mission].pay;
    this.hooks.pay(pay);
    this.sound.sting(true); this.sound.cash();
    this.hud.toast(`Job done — +$${pay.toLocaleString()}`);
    this.started = false; this.stage = 0;
    if (this.mission >= 2) {
      this.storyDone = true; this.mission = 3;
      this.hud.setObjective('Story complete — Bahía Palma is yours. Packages and races still pay.');
      if (this.hooks.onStoryDone) this.hooks.onStoryDone();
    } else {
      this.mission += 1; this.betweenCd = 0.5; this.pendingStart = true;
      this.hud.setObjective('Carmen is calling with the next job…');
      this.say('Good work. Stay close to your phone — I have another job for you.');
    }
    if (this.hooks.autosave) this.hooks.autosave();
  }
  currentTarget(storyCars) {
    if (!this.started) return this.storyDone ? null : GARAGE_MARKER;
    const m = this.mission, s = this.stage;
    if (m === 0) {
      if (s === 0) return storyCars.sedan ? { x: storyCars.sedan.pos.x, z: storyCars.sedan.pos.z } : GARAGE_MARKER;
      if (s === 1) return DOCKS_POINT;
      if (s === 2) return PACKAGE_POINT;
      return GARAGE_MARKER;
    }
    if (m === 1) {
      if (s === 0) return storyCars.cometa ? { x: storyCars.cometa.pos.x, z: storyCars.cometa.pos.z } : POIS.marina;
      return GARAGE_MARKER;
    }
    if (m === 2) {
      if (s === 0) return BANK_DOOR;
      if (s === 1 || s === 2) return VAULT_POINT;
      return GARAGE_MARKER;
    }
    return null;
  }
  pickupPackage() {
    if (!(this.started && this.mission === 0 && this.stage === 2)) return;
    this.stage = 3;
    this.hooks.crime('theft');
    this.say('You have it? Good. The Palma PD heard something — bring it to my garage. NOW.');
    this.hud.setObjective("Deliver the package to Vega's Garage");
    this.sound.pickup();
  }
  tryStartRace(playerPos, inCar) {
    if (!inCar || this.race) return false;
    for (const r of RACES) {
      if (Math.hypot(playerPos.x - r.start.x, playerPos.z - r.start.z) < 4.5) {
        this.race = { id: r.id, name: r.name, def: r, cp: 0, t: 0, active: true };
        this.hud.toast(`Race started: ${r.name} — follow the gold beam!`);
        this.sound.pickup();
        return true;
      }
    }
    return false;
  }
  raceTarget() { return this.race ? this.race.def.cps[this.race.cp] : null; }
  onEnterCar(car, storyCars) {
    if (!this.started) return;
    if (this.mission === 0 && this.stage === 0 && car === storyCars.sedan) {
      this.stage = 1;
      this.hud.setObjective('Drive the package route: head to the Docks');
      this.say('Wheels up. The Docks, south side of the bay. Try not to scratch her.');
    }
    if (this.mission === 1 && this.stage === 0 && car === storyCars.cometa) {
      this.stage = 1; this.timer = 150;
      this.hooks.crime('cartheft2');
      this.hud.setObjective("Deliver the Cometa to Vega's Garage before the timer runs out");
      this.say('That is MY car now, Marco. Garage. Two and a half minutes.');
    }
  }
  update(dt, ctx) {
    const { pos, inCar, car, storyCars } = ctx;
    const dist = (p) => Math.hypot(pos.x - p.x, pos.z - p.z);
    // next job arrives by phone shortly after the last one, or at the garage marker
    if (!this.started && !this.storyDone) {
      this.betweenCd -= dt;
      if (this.betweenCd <= 0 && (this.pendingStart || dist(GARAGE_MARKER) < 4.5)) {
        this.pendingStart = false;
        this.startMission(this.mission);
      }
    }
    if (this.started) {
      const m = this.mission, s = this.stage;
      if (m === 0) {
        if (s === 1 && inCar && dist(DOCKS_POINT) < 12) {
          this.stage = 2;
          this.hud.setObjective('Pick up the package at the Docks (gold marker)');
          this.say('The package is on the dock, by the water. On foot, rápido.');
        } else if (s === 2 && !inCar && dist(PACKAGE_POINT) < 2.4) this.pickupPackage();
        else if (s === 3 && dist(GARAGE_MARKER) < 6.5) this.completeMission();
      } else if (m === 1 && s === 1) {
        this.timer -= dt;
        this.hud.setRaceInfo(`⏱ Cometa delivery: ${Math.max(0, Math.ceil(this.timer))}s`);
        if (this.timer <= 0) {
          this.stage = 0; this.hud.setRaceInfo('');
          this.hud.toast('Too slow — the buyer walked. Steal the Cometa again.');
          this.say('Ay, Marco. The buyer left. Get the Cometa again — and this time, DRIVE.');
          if (this.hooks.onMissionStart) this.hooks.onMissionStart(1);
        } else if (inCar && car === storyCars.cometa && dist(GARAGE_MARKER) < 6.5) {
          this.hud.setRaceInfo('');
          this.completeMission();
        }
      } else if (m === 2) {
        if (s === 0 && dist(BANK_DOOR) < 8) { this.stage = 1; this.hud.setObjective('Go inside to the vault'); }
        else if (s === 1 && dist(VAULT_POINT) < 3.6) { this.stage = 2; this.hud.setObjective('Hold E at the vault to take the cash'); }
        else if (s === 2) {
          if (ctx.eHeld) this.vaultProgress += dt;
          this.hud.setRaceInfo(this.vaultProgress > 0 ? `Cracking vault… ${Math.min(100, Math.floor(this.vaultProgress / 2.2 * 100))}%` : '');
          if (this.vaultProgress >= 2.2) {
            this.stage = 3; this.hud.setRaceInfo('');
            this.hooks.crime('robbery');
            this.say('That alarm is LOUD, Marco. Hideout. Do not lead them to my door.');
            this.hud.setObjective("Escape to the Hideout at Vega's Garage");
            this.sound.sting(false);
          }
        } else if (s === 3 && dist(GARAGE_MARKER) < 6.5) this.completeMission();
      }
    }
    // side packages: spin, pay out on touch, respawn a minute later
    for (const p of this.packages) {
      if (!p.active) {
        p.respawn -= dt;
        if (p.respawn <= 0) { p.active = true; p.mesh.visible = true; }
        continue;
      }
      p.mesh.rotation.y += dt * 2;
      if (dist(p) < (inCar ? 3 : 2)) {
        p.active = false; p.mesh.visible = false; p.respawn = 60;
        this.hooks.pay(75); this.sound.pickup();
        this.hud.toast('Package delivered: +$75');
      }
    }
    // race checkpoints
    if (this.race) {
      this.race.t += dt;
      const target = this.raceTarget();
      this.hud.setRaceInfo(`🏁 ${this.race.name} — checkpoint ${this.race.cp + 1}/${this.race.def.cps.length} · ${this.race.t.toFixed(1)}s`);
      if (target && dist(target) < 9.5) {
        this.race.cp++;
        this.sound.pickup();
        if (this.race.cp >= this.race.def.cps.length) {
          const t = this.race.t, id = this.race.id;
          if (!this.bestRaces[id] || t < this.bestRaces[id]) this.bestRaces[id] = t;
          this.hooks.pay(150); this.sound.sting(true);
          this.hud.toast(`Race won! ${t.toFixed(1)}s — +$150`);
          this.race = null; this.hud.setRaceInfo('');
          if (this.hooks.autosave) this.hooks.autosave();
        }
      }
    }
    const target = this.race ? this.raceTarget() : this.currentTarget(storyCars);
    this.markerPos = target;
    this.beam.visible = !!target;
    if (target) { this.beam.position.x = target.x; this.beam.position.z = target.z; }
  }
}
