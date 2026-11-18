// PALMA HEAT — people built from boxes with hip-pivoted limbs that swing as
// they walk. Pedestrians stroll the sidewalks and scatter when scared.
import * as THREE from 'three';
import { GRID, ROAD_HALF } from './config.js';
import { resolveCollisions } from './city.js';

const SHIRTS = [0xe8e4da, 0xd64541, 0x3f7fbf, 0xf2b035, 0x53b06a, 0xff9db0, 0x8e5bd6, 0x2ec4b6];
const SKIN = [0xf2c49b, 0xc98d5e, 0x8a5a34, 0x6e4426];

export function makePersonMesh(shirt, skin) {
  const grp = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), cloth);
  torso.position.y = 1.12; grp.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.34), skinMat);
  head.position.y = 1.72; grp.add(head);
  const mkLimb = (w, len, mat, x, y) => {
    const geo = new THREE.BoxGeometry(w, len, w);
    geo.translate(0, -len / 2 + 0.06, 0); // pivot near the joint
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, 0); grp.add(m);
    return m;
  };
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3242 });
  const legL = mkLimb(0.15, 0.78, pants, -0.14, 0.78);
  const legR = mkLimb(0.15, 0.78, pants, 0.14, 0.78);
  const armL = mkLimb(0.13, 0.66, cloth, -0.35, 1.42);
  const armR = mkLimb(0.13, 0.66, cloth, 0.35, 1.42);
  return { grp, legL, legR, armL, armR };
}

export class Pedestrian {
  constructor(scene, rng, colliders) {
    const built = makePersonMesh(rng.pick(SHIRTS), rng.pick(SKIN));
    this.mesh = built.grp; this.parts = built;
    this.pos = this.mesh.position;
    this.axis = rng.chance(0.5) ? 'x' : 'z';
    this.line = rng.pick(GRID);
    this.side = rng.chance(0.5) ? 1 : -1;
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.along = rng.range(-125, 125);
    this.speed = rng.range(1.1, 1.9);
    this.phase = rng.range(0, 6);
    this.fleeT = 0; this.fleeFrom = null;
    this.colliders = colliders;
    this.place();
    scene.add(this.mesh);
  }
  place() {
    const off = this.side * (ROAD_HALF + 1.6);
    if (this.axis === 'x') this.pos.set(this.along, 0, this.line + off);
    else this.pos.set(this.line + off, 0, this.along);
    this.mesh.rotation.y = this.axis === 'x' ? Math.atan2(this.dir, 0) : Math.atan2(0, this.dir);
  }
  scare(from, seconds = 4) { this.fleeFrom = { x: from.x, z: from.z }; this.fleeT = seconds; }
  update(dt) {
    const running = this.fleeT > 0;
    this.phase += dt * (running ? 11 : 6);
    const swing = Math.sin(this.phase) * 0.5;
    this.parts.legL.rotation.x = swing; this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.7; this.parts.armR.rotation.x = swing * 0.7;
    if (running && this.fleeFrom) {
      this.fleeT -= dt;
      const dx = this.pos.x - this.fleeFrom.x, dz = this.pos.z - this.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      this.pos.x += (dx / d) * 3.6 * dt; this.pos.z += (dz / d) * 3.6 * dt;
      this.mesh.rotation.y = Math.atan2(dx / d, dz / d);
      resolveCollisions(this.pos, 0.45, this.colliders);
      return;
    }
    this.along += this.dir * this.speed * dt;
    if (this.along > 132) { this.along = 132; this.dir = -1; }
    if (this.along < -132) { this.along = -132; this.dir = 1; }
    this.place();
  }
}
export function spawnPedestrians(scene, rng, colliders, count = 30) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(new Pedestrian(scene, rng, colliders));
  return out;
}
