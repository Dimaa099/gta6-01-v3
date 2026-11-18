// PALMA HEAT — cars assembled from boxes: body, glass cab, four wheels that spin
// and steer, a light bar for cruisers and a smoke puff once a car is wrecked.
// One Car class serves parked cars, grid traffic, story cars and police.
import * as THREE from 'three';
import { GRID, CITY_MIN, CITY_MAX } from './config.js';
import { resolveCollisions } from './city.js';

const SPECS = {
  sedan:  { w: 1.9, l: 4.3, bodyH: 0.62, cabL: 2.1, name: 'Sedan' },
  hatch:  { w: 1.8, l: 3.7, bodyH: 0.66, cabL: 2.2, name: 'Hatchback' },
  truck:  { w: 2.1, l: 5.2, bodyH: 0.95, cabL: 1.5, name: 'Pickup' },
  cometa: { w: 1.9, l: 4.1, bodyH: 0.50, cabL: 1.7, name: 'Cometa GT' },
  police: { w: 1.9, l: 4.4, bodyH: 0.62, cabL: 2.1, name: 'Palma PD Cruiser' },
};

function assemble(kind, color) {
  const spec = SPECS[kind] || SPECS.sedan;
  const grp = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.bodyH, spec.l), paint);
  body.position.y = 0.55; grp.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.82, 0.52, spec.cabL),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.2, metalness: 0.4 }));
  cab.position.set(0, 1.08, kind === 'truck' ? -spec.l * 0.22 : -0.15); grp.add(cab);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.94, 0.4, spec.l * 0.45), paint);
    bed.position.set(0, 0.95, spec.l * 0.24); grp.add(bed);
  }
  if (kind === 'cometa') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 1.02, 0.09, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x181c22 }));
    wing.position.set(0, 0.98, spec.l * 0.46); grp.add(wing);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const wheels = [];
  const wx = spec.w / 2 - 0.05, wz = spec.l / 2 - 0.85;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * wx, 0.36, sz * wz);
    grp.add(w); wheels.push(w);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.8, 0.14, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  beam.position.set(0, 0.62, -spec.l / 2 - 0.02); grp.add(beam);
  let lightBar = null;
  if (kind === 'police') {
    lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    lightBar.position.set(0, 1.42, -0.15); grp.add(lightBar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.02, 0.22, spec.l * 0.7),
      new THREE.MeshBasicMaterial({ color: 0x2a4d9b }));
    stripe.position.y = 0.55; grp.add(stripe);
  }
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 6),
    new THREE.MeshBasicMaterial({ color: 0x555a60, transparent: true, opacity: 0 }));
  smoke.position.set(0, 1.2, -spec.l / 2); grp.add(smoke);
  return { grp, wheels, lightBar, smoke };
}

let seq = 0;
export class Car {
  constructor(scene, kind, color, x, z, heading = 0) {
    this.id = ++seq;
    this.kind = kind;
    this.name = (SPECS[kind] || SPECS.sedan).name;
    const built = assemble(kind, color);
    this.mesh = built.grp; this.wheels = built.wheels;
    this.lightBar = built.lightBar; this.smokeMesh = built.smoke;
    this.pos = this.mesh.position; this.pos.set(x, 0, z);
    this.heading = heading; this.speed = 0; this.steerVis = 0;
    this.damage = 0; this.occupied = false; this.isTraffic = false; this.stolen = false;
    this.maxSpeed = kind === 'cometa' ? 34 : kind === 'police' ? 31 : 26;
    this.spin = 0; this.flashT = Math.random() * 10;
    scene.add(this.mesh);
    this.syncMesh();
  }
  syncMesh() {
    this.mesh.rotation.y = this.heading;
    this.spin += this.speed * 0.06;
    for (let i = 0; i < 4; i++) {
      this.wheels[i].rotation.x = this.spin;
      if (i < 2) this.wheels[i].rotation.y = this.steerVis * 0.5;
    }
    if (this.lightBar) {
      this.flashT += 0.3;
      this.lightBar.material.color.setHex(((this.flashT * 3) | 0) % 2 ? 0xff2a2a : 0x2a6bff);
    }
    this.smokeMesh.material.opacity = this.damage > 55 ? 0.45 : 0;
    if (this.damage > 55) this.smokeMesh.scale.setScalar(1 + Math.sin(this.flashT * 2) * 0.2);
  }
  // Arcade drive model. input: {f: -1..1 throttle, steer: -1..1, brake: bool}
  drive(dt, input, colliders) {
    if (input.f !== 0) this.speed += input.f * (input.f > 0 ? 15 : 10) * dt * (this.damage > 85 ? 0.4 : 1);
    else this.speed -= this.speed * 0.7 * dt;
    if (input.brake) this.speed -= this.speed * 3.2 * dt;
    this.speed -= this.speed * (0.25 + Math.abs(this.speed) * 0.012) * dt * 0.4;
    this.speed = Math.max(-9, Math.min(this.maxSpeed, this.speed));
    if (Math.abs(this.speed) > 0.4) {
      this.heading += input.steer * 1.55 * dt * Math.sign(this.speed) * Math.min(1, Math.abs(this.speed) / 7);
    }
    this.steerVis += ((input.steer || 0) - this.steerVis) * Math.min(1, dt * 8);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    if (colliders) {
      resolveCollisions(this.pos, 1.5, colliders);
      const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
      const wantedMove = Math.abs(this.speed) * dt;
      if (wantedMove > 0.05 && moved < wantedMove * 0.35 && Math.abs(this.speed) > 6) {
        this.damage = Math.min(100, this.damage + Math.abs(this.speed) * 0.7);
        this.speed *= -0.25;
      }
    }
    this.syncMesh();
  }
  // Traffic brain: hold a lane on the current street, brake for the car ahead,
  // and pick a fresh heading at intersections.
  driveTraffic(dt, colliders, others, rng) {
    if (this.tDir === undefined) {
      this.tDir = rng.int(0, 3);                    // 0:+x 1:-x 2:+z 3:-z
      this.cruise = rng.range(8, 12.5);
      this.turnCd = 0;
    }
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dz] = DIRS[this.tDir];
    const nearestLine = (v) => GRID.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, GRID[0]);
    let target = this.cruise;
    for (const o of others) {
      if (o === this) continue;
      const rx = o.pos.x - this.pos.x, rz = o.pos.z - this.pos.z;
      const ahead = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx);
      if (ahead > 0 && ahead < 8 && side < 2.2) target = Math.min(target, Math.max(0, (ahead - 4.5) * 1.6));
    }
    this.speed += Math.max(-14 * dt, Math.min(9 * dt, target - this.speed));
    const cx = nearestLine(this.pos.x), cz = nearestLine(this.pos.z);
    this.turnCd -= dt;
    if (Math.abs(this.pos.x - cx) < 1.4 && Math.abs(this.pos.z - cz) < 1.4 && this.turnCd <= 0) {
      if (rng.chance(0.45)) {
        const options = [0, 1, 2, 3].filter((d) => d !== (this.tDir ^ 1));
        this.tDir = rng.pick(options);
      }
      this.turnCd = 3;
    }
    const [ndx, ndz] = DIRS[this.tDir];
    // ease onto the correct side of the road for the direction of travel
    if (ndx !== 0) this.pos.z += ((nearestLine(this.pos.z) + (ndx > 0 ? 2.4 : -2.4)) - this.pos.z) * Math.min(1, dt * 1.5);
    if (ndz !== 0) this.pos.x += ((nearestLine(this.pos.x) + (ndz > 0 ? -2.4 : 2.4)) - this.pos.x) * Math.min(1, dt * 1.5);
    this.pos.x += ndx * this.speed * dt;
    this.pos.z += ndz * this.speed * dt;
    this.heading = Math.atan2(ndx, ndz);
    if (this.pos.x < CITY_MIN - 2 || this.pos.x > CITY_MAX + 2 || this.pos.z < -136 || this.pos.z > 138) {
      this.tDir ^= 1; this.speed = Math.max(3, this.speed * 0.4);
    }
    this.syncMesh();
  }
}
