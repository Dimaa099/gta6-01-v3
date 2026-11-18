// PALMA HEAT — Bahía Palma: a seeded grid city of pastel blocks, palms and docks.
// Buildings are boxes wearing canvas-painted lit-window facades; the whole street
// plan (asphalt, sidewalks, lane dashes, beach, apron) is painted into one big
// ground texture. Collision is a flat list of AABBs tested by resolveCollisions.
import * as THREE from 'three';
import { GRID, ROAD_HALF, CITY_MIN, CITY_MAX, WATER_Z, POIS } from './config.js';

export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    let dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius; pos.z = nz + (dz / d) * radius;
    } else {
      // centre is inside the box: exit through the nearest face
      const pens = [pos.x - c.minX, c.maxX - pos.x, pos.z - c.minZ, c.maxZ - pos.z];
      const m = Math.min(...pens);
      if (m === pens[0]) pos.x = c.minX - radius;
      else if (m === pens[1]) pos.x = c.maxX + radius;
      else if (m === pens[2]) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  pos.x = Math.max(CITY_MIN - 4, Math.min(CITY_MAX + 4, pos.x));
  pos.z = Math.max(-140, Math.min(168, pos.z));
}

function paintGround() {
  const S = 2048, WORLD = 340, HALF = WORLD / 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const px = (w) => (w + HALF) / WORLD * S;
  g.fillStyle = '#7d8a6a'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#87936f';
  for (let i = 0; i < 420; i++) g.fillRect(Math.random() * S, Math.random() * S, 9, 9);
  g.fillStyle = '#e6cf9e'; g.fillRect(0, px(128), S, px(WATER_Z) - px(128));   // beach
  g.fillStyle = '#5c6068'; g.fillRect(0, px(124), S, px(140) - px(124));      // docks apron
  g.fillStyle = '#2e7fa8'; g.fillRect(0, px(WATER_Z), S, S - px(WATER_Z));    // bay floor
  const roadW = px(ROAD_HALF + 2) - px(-ROAD_HALF - 2);
  g.fillStyle = '#33363c';
  for (const c of GRID) {
    g.fillRect(px(c) - roadW / 2, 0, roadW, px(WATER_Z));
    g.fillRect(0, px(c) - roadW / 2, px(WATER_Z), roadW);
  }
  g.strokeStyle = '#9aa0a3'; g.lineWidth = 3;
  for (const c of GRID) {
    g.strokeRect(px(c) - roadW / 2, 0, roadW, px(WATER_Z));
    g.strokeRect(0, px(c) - roadW / 2, px(WATER_Z), roadW);
  }
  g.strokeStyle = '#e8d878'; g.lineWidth = 2.5; g.setLineDash([16, 14]);
  for (const c of GRID) {
    g.beginPath(); g.moveTo(px(c), 0); g.lineTo(px(c), px(WATER_Z)); g.stroke();
    g.beginPath(); g.moveTo(0, px(c)); g.lineTo(px(WATER_Z), px(c)); g.stroke();
  }
  g.setLineDash([]);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function facadeTexture(rng, base) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 128, 10);
  for (let y = 14; y < 242; y += 22) for (let x = 10; x < 112; x += 24) {
    g.fillStyle = rng.chance(0.45) ? '#ffd98a' : '#2c3542';
    g.fillRect(x, y, 14, 12);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSign(text, color) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(12,14,20,0.85)'; g.fillRect(0, 0, 512, 96);
  g.font = 'bold 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(17, 3.2, 1);
  return sp;
}

const PASTELS = ['#c96f4a', '#d9a05b', '#b7c3cc', '#8fb6c9', '#e0d6c2', '#a3b18a', '#dda7a0', '#7f9fb0'];

export function buildCity(scene, rng) {
  const colliders = [];
  const box = (w, h, d, color, x, y, z, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z); scene.add(m);
    if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(340, 340),
    new THREE.MeshLambertMaterial({ map: paintGround() }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x2e7fa8, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(340, 60), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.03, WATER_Z + 29); scene.add(water);

  // generic blocks — plots reserved for POIs are skipped
  const reserved = [[-105, -105], [45, -45], [15, -45], [105, -105], [-45, 15], [45, 45]];
  const plots = [];
  for (let i = 0; i < GRID.length - 1; i++) for (let j = 0; j < GRID.length - 1; j++)
    plots.push([(GRID[i] + GRID[i + 1]) / 2, (GRID[j] + GRID[j + 1]) / 2]);
  for (const [cx, cz] of plots) {
    if (reserved.some(([rx, rz]) => rx === cx && rz === cz)) continue;
    if (cz > 100) continue; // south row: marina lot + docks stay open
    const twin = rng.chance(0.4);
    const n = twin ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const w = rng.range(9, 15), d = rng.range(9, 15), h = rng.range(10, 42);
      const ox = twin ? (k ? 6 : -6) : rng.range(-2, 2);
      const oz = twin ? 0 : rng.range(-2, 2);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ map: facadeTexture(rng, rng.pick(PASTELS)) }));
      b.position.set(cx + ox, h / 2, cz + oz); scene.add(b);
      colliders.push({ minX: b.position.x - w / 2, maxX: b.position.x + w / 2, minZ: b.position.z - d / 2, maxZ: b.position.z + d / 2 });
    }
  }

  const poiBlock = (poi, w, h, d, color, dx, dz) => {
    box(w, h, d, color, poi.x + dx, h / 2, poi.z + dz);
    const s = makeSign(poi.name, '#ffb347');
    s.position.set(poi.x + dx, h + 2.4, poi.z + dz); scene.add(s);
  };
  poiBlock(POIS.garage, 15, 7, 13, 0x8a5a34, 9, 9);
  poiBlock(POIS.police, 16, 12, 14, 0x4a5f8a, -9, -9);
  poiBlock(POIS.hospital, 16, 11, 14, 0xe8e8e8, -9, -9);
  poiBlock(POIS.diner, 13, 6, 11, 0xc96f7a, 9, -9);

  // marina lot slab + sign
  const lot = new THREE.Mesh(new THREE.BoxGeometry(27, 0.14, 21), new THREE.MeshLambertMaterial({ color: 0x4a4e55 }));
  lot.position.set(90, 0.07, 114); scene.add(lot);
  const mSign = makeSign(POIS.marina.name, '#7fd4ff'); mSign.position.set(99, 5.5, 125); scene.add(mSign);
  const dSign = makeSign(POIS.docks.name, '#c0c8d8'); dSign.position.set(-90, 7, 124); scene.add(dSign);

  // Palma Trust Bank: tower behind an open lobby; the vault sits inside the lobby.
  box(16, 15, 16, 0xd8c98f, 44, 7.5, -44);
  const bSign = makeSign(POIS.bank.name, '#ffe9a3'); bSign.position.set(34, 17.5, -44); scene.add(bSign);
  const lobbyMat = new THREE.MeshLambertMaterial({ color: 0xe6ddc4 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 0.3, 18), lobbyMat);
  floor.position.set(24, 0.15, -38); scene.add(floor);
  box(20, 5.5, 1, 0xcfc39f, 24, 2.75, -47);
  box(20, 5.5, 1, 0xcfc39f, 24, 2.75, -29);
  box(1, 5.5, 18, 0xcfc39f, 34, 2.75, -38);
  box(20, 0.4, 18, 0xb8ad8a, 24, 5.6, -38, false);
  const vault = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 2.2),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.35 }));
  vault.position.set(31.5, 1.7, -38); scene.add(vault);
  colliders.push({ minX: 30, maxX: 33, minZ: -39.2, maxZ: -36.8 });

  // marina dressing: piers + boats
  for (let i = 0; i < 4; i++) box(3, 0.8, 22, 0x8a6f4d, 66 + i * 16, 0.2, 152, false);
  for (let i = 0; i < 5; i++) {
    const boat = box(2.6, 1.1, 6.5, [0xe8e4da, 0x3f7fbf, 0xd64541][i % 3], 60 + i * 15, 0.35, 146 + (i % 2) * 9, false);
    boat.rotation.y = rng.range(-0.15, 0.15);
  }
  // docks: two cranes + container stacks, all clear of the package spot (-90, 132)
  for (const cx of [-118, -58]) {
    box(1.6, 13, 1.6, 0xd88f2e, cx, 6.5, 128);
    box(14, 1.4, 1.4, 0xd88f2e, cx, 12.6, 132, false);
  }
  const contCols = [0xb5493a, 0x3a6fb5, 0x3fa065, 0xc7a23a];
  [[-116, 134], [-112, 134], [-114, 134.5], [-62, 136], [-58, 132], [-122, 130]].forEach(([x, z], i) => {
    box(6, 2.6, 2.6, contCols[i % 4], x, i === 2 ? 3.9 : 1.3, z);
  });

  // palms: a beach row plus scattered shade inside blocks
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const palm = (x, z) => {
    const grp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 5.4, 6), trunkMat);
    trunk.position.y = 2.7; trunk.rotation.z = 0.08; grp.add(trunk);
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4), frondMat);
      const a = (i / 5) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
      f.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      grp.add(f);
    }
    grp.position.set(x, 0, z); scene.add(grp);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  };
  for (let x = -130; x <= 130; x += 13) palm(x + rng.range(-2, 2), 126 + rng.range(-1.5, 1.5));
  for (let i = 0; i < 26; i++) {
    const plot = rng.pick(plots);
    const x = plot[0] + rng.range(-9, 9), z = plot[1] + rng.range(-9, 9);
    if (x > 8 && x < 40 && z > -52 && z < -24) continue;
    if (Math.hypot(x - 93, z - 114) < 9) continue;
    palm(x, z);
  }

  // street lights dotted along the avenues
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  for (const c of GRID) for (let v = -120; v <= 120; v += 30) {
    if (rng.chance(0.5)) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.6, 5), poleMat);
    pole.position.set(c + 6.4, 2.8, v + 6.4); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), lampMat);
    lamp.position.set(c + 6.4, 5.7, v + 6.4); scene.add(lamp);
  }
  return { colliders, waterMat };
}
