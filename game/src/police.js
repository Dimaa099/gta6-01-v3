// PALMA HEAT — the Palma PD. Cruisers roll in from edge intersections and steer
// after the player; at three stars or more an officer bails out of a stopped
// cruiser and starts shooting. Bust bookkeeping itself lives in game.js.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

// Edge intersections: always on drivable road, never inside a building.
const EDGES = [
  { x: -120, z: -120 }, { x: 120, z: -60 }, { x: -120, z: 30 }, { x: 120, z: 90 },
  { x: -60, z: -120 }, { x: 60, z: -120 }, { x: 120, z: 120 }, { x: -120, z: 120 },
];

export class Police {
  constructor(scene, rng) {
    this.scene = scene; this.rng = rng;
    this.cars = [];
    this.officers = [];
    this.spawnCd = 0;
  }
  desiredCount(wanted) { return wanted <= 0 ? 0 : Math.min(2 + wanted, 6); }
  nearestEdge(target) {
    let best = EDGES[0], bd = Infinity;
    for (const e of EDGES) {
      const d = Math.hypot(e.x - target.x, e.z - target.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  spawnOne(near) {
    const spot = near || this.rng.pick(EDGES);
    const car = new Car(this.scene, 'police', 0xe8e8ee, spot.x, spot.z, this.rng.range(0, 6.28));
    this.cars.push(car);
    return car;
  }
  update(dt, wanted, target, colliders) {
    this.spawnCd -= dt;
    if (wanted > 0 && this.cars.length < this.desiredCount(wanted) && this.spawnCd <= 0) {
      const e = this.nearestEdge(target);
      this.spawnOne({ x: e.x + this.rng.range(-4, 4), z: e.z + this.rng.range(-4, 4) });
      this.spawnCd = 2.5;
    }
    if (wanted === 0 && this.cars.length > 2) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
      this.officers = this.officers.filter((o) => o.car !== c);
    }
    const cap = 17 + wanted * 2.6;
    for (const car of this.cars) {
      if (car.held) { car.syncMesh(); continue; } // posed by a screenshot scene
      const dx = target.x - car.pos.x, dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      let dh = Math.atan2(dx, dz) - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      const f = dist > 7 ? 1 : dist > 3.4 ? 0.25 : -0.4;
      const prevMax = car.maxSpeed; car.maxSpeed = cap;
      car.drive(dt, { f, steer, brake: false }, colliders);
      car.maxSpeed = prevMax;
      // a cruiser stuck on scenery for 4s re-enters from the nearest edge
      if (dist > 22 && Math.abs(car.speed) < 1.2) {
        car.stuckT = (car.stuckT || 0) + dt;
        if (car.stuckT > 4) {
          car.stuckT = 0;
          const e = this.nearestEdge(target);
          car.pos.set(e.x, 0, e.z); car.speed = 6;
        }
      } else car.stuckT = 0;
      if (wanted >= 3 && dist < 16 && !car.officerOut && Math.abs(car.speed) < 6) {
        car.officerOut = true;
        const built = makePersonMesh(0x2a3f66, 0xf2c49b);
        built.grp.position.set(car.pos.x + 1.6, 0, car.pos.z);
        this.scene.add(built.grp);
        this.officers.push({ mesh: built.grp, parts: built, car, health: 60, shootCd: this.rng.range(0.5, 1.5), pos: built.grp.position });
      }
    }
    for (const o of this.officers) {
      const dx = target.x - o.pos.x, dz = target.z - o.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 9) { o.pos.x += (dx / dist) * 2.6 * dt; o.pos.z += (dz / dist) * 2.6 * dt; }
      o.mesh.rotation.y = Math.atan2(dx, dz);
      o.shootCd -= dt;
    }
    return this.cars.length;
  }
  nearestDist(target) {
    let best = Infinity;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.pos.x - target.x, c.pos.z - target.z));
    return best;
  }
  clearAll() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = []; this.officers = [];
  }
}
