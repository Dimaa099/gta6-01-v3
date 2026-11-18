// PALMA HEAT — Marco Reyes on foot: camera-relative WASD movement, sprint,
// walk-cycle limb swing and an orbit camera the mouse drags around him.
import * as THREE from 'three';
import { resolveCollisions } from './city.js';
import { makePersonMesh } from './pedestrians.js';

export class Player {
  constructor(scene, start, colliders) {
    const built = makePersonMesh(0x243447, 0xc98d5e);
    this.mesh = built.grp; this.parts = built;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xd64541 }));
    cap.position.y = 1.95; this.mesh.add(cap); // Marco's red cap
    this.pos = this.mesh.position;
    this.pos.set(start.x, 0, start.z);
    this.heading = 0.6; this.camYaw = 0.6; this.camPitch = 0.32;
    this.health = 100; this.dead = false;
    this.walkPhase = 0; this.moving = false;
    this.colliders = colliders;
    scene.add(this.mesh);
  }
  setPos(x, z) { this.pos.x = x; this.pos.z = z; resolveCollisions(this.pos, 0.5, this.colliders); }
  update(dt, move, sprint) {
    const mag = Math.hypot(move.x, move.z);
    this.moving = mag > 0.1;
    if (this.moving) {
      const sp = sprint ? 8.4 : 4.6;
      const nx = move.x / mag, nz = move.z / mag;
      this.pos.x += nx * sp * dt; this.pos.z += nz * sp * dt;
      this.heading = Math.atan2(nx, nz);
      this.walkPhase += dt * (sprint ? 11 : 8);
    }
    resolveCollisions(this.pos, 0.5, this.colliders);
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.parts.legL.rotation.x = swing; this.parts.legR.rotation.x = -swing;
    this.parts.armL.rotation.x = -swing * 0.8; this.parts.armR.rotation.x = swing * 0.8;
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = true;
  }
  cameraPos(dist = 7.5) {
    const cx = this.pos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = this.pos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = 1.6 + Math.sin(this.camPitch) * dist;
    return new THREE.Vector3(cx, Math.max(1.1, cy), cz);
  }
}
