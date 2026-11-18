// PALMA HEAT — the glue: renderer boot, input, the wanted/police pressure loop,
// combat wiring, guards, save/continue, menus, the __palma test API and the
// main loop. Story flow lives in missions.js; the city in city.js.
import * as THREE from 'three';
import { WORLD_SEED, PLAYER_START, POLICE_DOOR, HOSPITAL_DOOR, CAR_COLORS, GRID } from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { Car } from './vehicles.js';
import { spawnPedestrians, makePersonMesh } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions, GARAGE_MARKER } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { loadSave, writeSave, hasSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || WORLD_SEED) >>> 0;
const rng = makeRng(seed);

// ---------- renderer / scene / golden-hour light ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc3e8);
scene.fog = new THREE.Fog(0xe8c9a0, 90, 320);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
camera.position.set(-120, 8, -90);
const sun = new THREE.DirectionalLight(0xffd9a8, 2.6);
sun.position.set(-80, 120, -40); scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbdd8ff, 0x8a6f4d, 1.15));

const city = buildCity(scene, rng);
const sound = new SoundBank();
const hud = new Hud();

// ---------- actors ----------
const player = new Player(scene, PLAYER_START, city.colliders);
const peds = spawnPedestrians(scene, rng, city.colliders, 30);
const police = new Police(scene, rng);
const combat = new Combat(scene, sound);

const allCars = [];
function addCar(kind, color, x, z, heading, traffic = false) {
  const c = new Car(scene, kind, color, x, z, heading);
  c.isTraffic = traffic;
  allCars.push(c);
  return c;
}
const storyCars = {
  sedan: addCar('sedan', 0x2ec4b6, -108, -120, Math.PI / 2),
  cometa: addCar('cometa', 0xff7a1a, 93, 114, Math.PI),
};
// parked cars sit in the kerb lane mid-block: clear of buildings, junctions,
// each other and both story cars
const parkedCars = [];
for (const gz of GRID) for (let i = 0; i < GRID.length - 1; i++) {
  if (!rng.chance(0.42)) continue;
  const x = (GRID[i] + GRID[i + 1]) / 2, z = gz + (rng.chance(0.5) ? 3.4 : -3.4);
  if (parkedCars.some((p) => Math.hypot(p.pos.x - x, p.pos.z - z) < 10)) continue;
  if (Math.hypot(x - 93, z - 114) < 12 || Math.hypot(x + 108, z + 120) < 12) continue;
  parkedCars.push(addCar(rng.pick(['sedan', 'hatch', 'truck']), rng.pick(CAR_COLORS), x, z, Math.PI / 2));
}
const trafficCars = [];
for (let i = 0; i < 8; i++) {
  trafficCars.push(addCar(rng.pick(['sedan', 'hatch', 'truck']), rng.pick(CAR_COLORS),
    rng.pick(GRID), rng.pick(GRID), 0, true));
}

// ---------- run state ----------
const G = {
  state: 'title', started: false, cash: 0, wanted: 0,
  inCar: false, car: null, dead: false, bust: 0,
  crimeAgo: 99, shootCd: 0, assaultCd: 0, hitCd: 0, decayT: 0,
  respawnT: 0, splashT: 0, guards: [], markerOverride: null, shotTick: null,
  player, police, hud, storyCars, camera,
};
const focusPos = () => (G.inCar && G.car) ? G.car.pos : player.pos;
function addCash(n) { G.cash += n; hud.setCash(G.cash); }
function crime(kind) {
  G.crimeAgo = 0;
  if (kind === 'theft') G.wanted = Math.min(5, G.wanted + 1);
  else if (kind === 'cartheft2') G.wanted = Math.max(G.wanted, 2);
  else if (kind === 'robbery') G.wanted = Math.max(G.wanted, 3);
  else if (kind === 'shoot') { if (G.shootCd <= 0) { G.wanted = Math.min(5, G.wanted + 1); G.shootCd = 5; } }
  else if (kind === 'assault') { if (G.assaultCd <= 0) { G.wanted = Math.min(5, G.wanted + 1); G.assaultCd = 5; } }
  else if (kind === 'hitped') { if (G.hitCd <= 0) { G.wanted = Math.min(5, G.wanted + 1); G.hitCd = 4; } }
  hud.setStars(G.wanted);
}
G.setWanted = (n) => { G.wanted = Math.max(0, Math.min(5, Math.floor(n))); hud.setStars(G.wanted); };

// ---------- M2 marina guards ----------
function spawnGuards() {
  for (const gd of G.guards) { scene.remove(gd.mesh); combat.removeTarget(gd.target); }
  G.guards = [];
  for (const [x, z] of [[89, 110.5], [97, 117.5]]) {
    const built = makePersonMesh(0x22262e, 0x8a5a34);
    built.grp.position.set(x, 0, z);
    scene.add(built.grp);
    const guard = { mesh: built.grp, parts: built, pos: built.grp.position, health: 80, alive: true, shootCd: rng.range(0.8, 1.6), target: null };
    guard.target = combat.addTarget({
      pos: guard.pos, health: 80, alive: true,
      onHit: (t) => { guard.health = t.health; },
      onDeath: () => {
        guard.alive = false;
        guard.mesh.rotation.x = -Math.PI / 2; guard.mesh.position.y = 0.25;
        hud.toast('Guard down');
        for (const p of peds) p.scare(guard.pos, 5);
      },
    });
    G.guards.push(guard);
  }
}

const missions = new Missions(scene, hud, sound, {
  pay: (n) => addCash(n),
  crime: (k) => crime(k),
  toast: (t) => hud.toast(t),
  onMissionStart: (m) => { if (m === 1) spawnGuards(); },
  onStoryDone: () => {
    document.getElementById('endStats').textContent =
      `Marco ran all three of Carmen Vega's jobs and banked $${G.cash.toLocaleString()}. Bahía Palma is his now — packages, races and trouble included.`;
    document.getElementById('endCard').style.display = 'flex';
  },
  autosave: () => doSave(true),
});
G.missions = missions;

// ---------- entering / leaving cars ----------
// E-key interaction priority — one press fires exactly ONE action (edge-triggered
// on keydown, never repeated):
//   1. start a street race (driving, stopped on a blue race ring)
//   2. exit the car (driving, anywhere else)
//   3. pick up the M1 package (on foot, at the docks package marker)
//   4. enter the nearest car (on foot)
//   5. save at Vega's Garage (on foot, at the marker, no job running)
// The bank vault is deliberately NOT an E action: it is a continuous hold,
// polled every frame while E is down.
function nearestCar(maxD = 3.8) {
  let best = null, bd = maxD;
  for (const c of allCars) {
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterCar(car) {
  if (!car || G.inCar) return;
  G.inCar = true; G.car = car; car.occupied = true;
  player.mesh.visible = false;
  if (car.isTraffic) {
    car.isTraffic = false; car.stolen = true;
    crime('theft');
    hud.toast('Car jacked — the driver fled!');
    for (const p of peds) if (Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z) < 14) p.scare(car.pos, 4);
  } else if (car !== storyCars.sedan && !car.stolen) {
    car.stolen = true;
    if (car !== storyCars.cometa) crime('theft');
  }
  missions.onEnterCar(car, storyCars);
  sound.ensure();
}
G.enterCar = enterCar;
function exitCar() {
  if (!G.inCar || !G.car) return;
  const car = G.car;
  car.occupied = false;
  player.setPos(car.pos.x + Math.cos(car.heading) * 2.2, car.pos.z - Math.sin(car.heading) * 2.2);
  player.mesh.visible = true;
  G.inCar = false; G.car = null;
  sound.setEngine(0, false);
}
function interact() {
  if (G.state !== 'playing' || G.dead) return;
  sound.ensure();
  if (G.inCar) {
    if (missions.tryStartRace(G.car.pos, true)) return;
    exitCar();
    return;
  }
  if (missions.started && missions.mission === 0 && missions.stage === 2) {
    if (Math.hypot(player.pos.x + 90, player.pos.z - 132) < 2.6) { missions.pickupPackage(); return; }
  }
  const car = nearestCar();
  if (car) { enterCar(car); return; }
  if (Math.hypot(player.pos.x - GARAGE_MARKER.x, player.pos.z - GARAGE_MARKER.z) < 4.5 && !missions.started) {
    doSave(); hud.toast("Saved at Vega's Garage");
  }
}

// ---------- save / load ----------
function doSave(quiet = false) {
  writeSave({
    cash: G.cash, mission: missions.mission, storyDone: missions.storyDone,
    x: Math.round(focusPos().x), z: Math.round(focusPos().z),
    best: missions.bestRaces,
  });
  if (!quiet) hud.toast('Game saved');
  refreshContinue();
}
function applySave(d) {
  G.cash = d.cash; hud.setCash(G.cash);
  missions.mission = typeof d.mission === 'number' ? d.mission : 0;
  missions.storyDone = !!d.storyDone;
  missions.bestRaces = d.best || {};
  missions.started = false; missions.stage = 0;
  player.setPos(d.x ?? PLAYER_START.x, d.z ?? PLAYER_START.z);
  hud.setObjective(missions.storyDone
    ? 'Free roam — packages and races still pay. Garage for a save.'
    : "Head to Vega's Garage for the next job");
}
function refreshContinue() { document.getElementById('btnContinue').disabled = !hasSave(); }

// ---------- arrest / death ----------
function splash(title, sub, ms = 2100) {
  document.getElementById('bigTitle').textContent = title;
  document.getElementById('bigSub').textContent = sub;
  document.getElementById('bigScreen').style.display = 'flex';
  G.splashT = ms / 1000;
}
function respawnAt(spot) {
  exitCar();
  police.clearAll();
  G.setWanted(0); G.bust = 0;
  player.health = 100; G.dead = false;
  player.setPos(spot.x, spot.z);
  hud.setHealth(100);
}
function doBusted() {
  const fine = Math.min(G.cash, 100 + G.wanted * 50);
  G.cash -= fine; hud.setCash(G.cash);
  splash('BUSTED', `Palma PD got you. Fine: $${fine.toLocaleString()}`);
  sound.sting(false);
  respawnAt(POLICE_DOOR);
}
function doDeath() {
  const loss = Math.floor(G.cash * 0.1);
  G.cash -= loss; hud.setCash(G.cash);
  splash('FLATLINED', `The hospital patched Marco up. Bill: $${loss.toLocaleString()} (10%)`);
  sound.sting(false);
  respawnAt(HOSPITAL_DOOR);
}
function hurtPlayer(dmg) {
  if (G.dead || G.state !== 'playing') return;
  player.health -= dmg;
  hud.setHealth(player.health);
  if (player.health <= 0) {
    player.health = 0; G.dead = true; G.respawnT = 1.4;
    exitCar();
  }
}

// ---------- input ----------
const keys = {};
let eHeldApi = 0;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  sound.ensure();
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyR') combat.reload();
  if (e.code === 'KeyF') doMelee();
  if (e.code === 'KeyH' && G.inCar) sound.horn();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
let pointerLocked = false, dragging = false, lastMX = 0, lastMY = 0;
renderer.domElement.addEventListener('click', () => {
  sound.ensure();
  if (G.state === 'playing' && !pointerLocked) {
    try {
      const p = renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(() => { /* headless: drag-look fallback */ });
    } catch { /* drag-look fallback */ }
  }
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
addEventListener('mousemove', (e) => {
  if (G.state !== 'playing') return;
  if (pointerLocked) {
    player.camYaw -= e.movementX * 0.0031;
    player.camPitch = Math.max(0.02, Math.min(1.1, player.camPitch + e.movementY * 0.0026));
  } else if (dragging) {
    player.camYaw -= (e.clientX - lastMX) * 0.006;
    player.camPitch = Math.max(0.02, Math.min(1.1, player.camPitch + (e.clientY - lastMY) * 0.005));
    lastMX = e.clientX; lastMY = e.clientY;
  }
});
addEventListener('mousedown', (e) => {
  if (e.target !== renderer.domElement) return;
  dragging = true; lastMX = e.clientX; lastMY = e.clientY;
  if (G.state === 'playing' && !G.inCar && !G.dead) doShoot();
});
addEventListener('mouseup', () => { dragging = false; });
function doShoot() {
  const r = combat.shoot(player.pos, player.camYaw, (k) => crime(k));
  if (r === 'hit' || r === 'miss') {
    for (const p of peds) if (Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 18) p.scare(player.pos, 4);
  }
}
function doMelee() {
  if (G.state !== 'playing' || G.inCar || G.dead) return;
  combat.melee(player.pos, combat.targets, (k) => crime(k));
}
function toggleMute() {
  sound.setMuted(!sound.muted);
  document.getElementById('btnMute').textContent = sound.muted ? '🔇 Sound: Off' : '🔊 Sound: On';
}
function togglePause() {
  if (G.state === 'playing') { G.state = 'paused'; document.getElementById('pause').style.display = 'flex'; }
  else if (G.state === 'paused') { G.state = 'playing'; document.getElementById('pause').style.display = 'none'; }
}

// ---------- menus ----------
function startSession(fresh) {
  document.getElementById('title').style.display = 'none';
  document.getElementById('endCard').style.display = 'none';
  G.state = 'playing'; G.started = true;
  sound.ensure();
  if (fresh) {
    G.cash = 0; hud.setCash(0);
    missions.mission = 0; missions.storyDone = false; missions.started = false;
    missions.stage = 0; missions.bestRaces = {};
    player.setPos(PLAYER_START.x, PLAYER_START.z);
    missions.startMission(0);
  }
}
document.getElementById('btnNew').addEventListener('click', () => startSession(true));
document.getElementById('btnContinue').addEventListener('click', () => {
  const d = loadSave(); if (!d) return;
  startSession(false); applySave(d);
});
document.getElementById('btnHow').addEventListener('click', () => {
  const h = document.getElementById('howto');
  h.style.display = h.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('btnMute').addEventListener('click', toggleMute);
document.getElementById('btnResume').addEventListener('click', togglePause);
document.getElementById('btnSave').addEventListener('click', () => doSave());
document.getElementById('btnLoad').addEventListener('click', () => {
  const d = loadSave(); if (d) { applySave(d); hud.toast('Save loaded'); }
});
document.getElementById('btnRestart').addEventListener('click', () => {
  document.getElementById('pause').style.display = 'none'; startSession(true);
});
document.getElementById('btnQuit').addEventListener('click', () => {
  document.getElementById('pause').style.display = 'none';
  document.getElementById('title').style.display = 'flex';
  G.state = 'title'; G.started = false; refreshContinue();
});
document.getElementById('btnEndClose').addEventListener('click', () => {
  document.getElementById('endCard').style.display = 'none';
});
refreshContinue();
hud.setCash(0); hud.setStars(0); hud.setHealth(100);

// ---------- frame update ----------
const camTarget = new THREE.Vector3();
let mmTick = 0;
function tick(dt) {
  hud.update(dt);
  if (G.splashT > 0) {
    G.splashT -= dt;
    if (G.splashT <= 0) document.getElementById('bigScreen').style.display = 'none';
  }
  if (G.state !== 'playing') return;
  G.crimeAgo += dt; G.shootCd -= dt; G.assaultCd -= dt; G.hitCd -= dt;
  if (eHeldApi > 0) eHeldApi -= dt;
  const eHeld = !!keys['KeyE'] || eHeldApi > 0;
  const fp = focusPos();

  if (G.dead) {
    G.respawnT -= dt;
    if (G.respawnT <= 0) doDeath();
    return;
  }

  // movement: drive the car, or walk Marco camera-relatively
  let playerSpeed = 0;
  if (G.inCar && G.car) {
    const f = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    const steer = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
    G.car.drive(dt, { f, steer, brake: !!keys['Space'] }, city.colliders);
    player.pos.set(G.car.pos.x, 0, G.car.pos.z);
    playerSpeed = Math.abs(G.car.speed);
    hud.setSpeed(Math.round(Math.abs(G.car.speed) * 3.6), G.car.name);
    sound.setEngine(G.car.speed / G.car.maxSpeed, true);
    for (const p of peds) {
      if (Math.abs(G.car.speed) > 5 && Math.hypot(p.pos.x - G.car.pos.x, p.pos.z - G.car.pos.z) < 1.9) {
        p.scare(G.car.pos, 5); crime('hitped');
        p.pos.x += (p.pos.x - G.car.pos.x) * 0.4 + 2;
        p.pos.z += (p.pos.z - G.car.pos.z) * 0.4;
      }
    }
  } else {
    const sin = Math.sin(player.camYaw), cos = Math.cos(player.camYaw);
    let mx = 0, mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) { mx += sin; mz += cos; }
    if (keys['KeyS'] || keys['ArrowDown']) { mx -= sin; mz -= cos; }
    if (keys['KeyA'] || keys['ArrowLeft']) { mx += cos; mz -= sin; }
    if (keys['KeyD'] || keys['ArrowRight']) { mx -= cos; mz += sin; }
    player.update(dt, { x: mx, z: mz }, !!(keys['ShiftLeft'] || keys['ShiftRight']));
    playerSpeed = player.moving ? 4.6 : 0;
    hud.setSpeed(0, null);
    sound.setEngine(0, false);
  }

  for (const c of trafficCars) if (!c.occupied) c.driveTraffic(dt, city.colliders, allCars, rng);
  for (const c of allCars) if (!c.isTraffic && c !== G.car) c.syncMesh();
  for (const p of peds) p.update(dt);

  missions.update(dt, { pos: fp, inCar: G.inCar, car: G.car, storyCars, eHeld });

  // police pressure + the bust meter
  police.update(dt, G.wanted, fp, city.colliders);
  if (G.shotTick) G.shotTick();
  sound.setSiren(police.cars.length > 0 && G.wanted > 0, dt);
  const copDist = police.nearestDist(fp);
  if (G.wanted > 0 && copDist < 9.5 && playerSpeed < 2.2) G.bust += dt / 2.4;
  else G.bust = Math.max(0, G.bust - dt * 0.7);
  hud.setBust(G.bust);
  if (G.bust >= 1) { doBusted(); return; }
  if (G.wanted > 0 && G.crimeAgo > 9 && copDist > 42) {
    G.decayT += dt;
    if (G.decayT > 5) {
      G.decayT = 0;
      G.setWanted(G.wanted - 1);
      if (G.wanted > 0) hud.toast('Heat is cooling…');
    }
  }

  // hostile NPC fire: officers who bailed out, and the marina guards
  const npcShoot = () => { sound.gunshot(); hurtPlayer(rng.range(3.5, 7.5)); };
  for (const o of police.officers) {
    if (!o.target) {
      o.target = combat.addTarget({
        pos: o.pos, health: o.health, alive: true,
        onHit: (t) => { o.health = t.health; },
        onDeath: () => {
          o.health = 0;
          o.mesh.rotation.x = -Math.PI / 2; o.mesh.position.y = 0.25;
          hud.toast('Officer down — heat rising'); crime('assault');
        },
      });
    }
    if (o.health <= 0) continue;
    if (o.shootCd <= 0 && Math.hypot(o.pos.x - fp.x, o.pos.z - fp.z) < 24) {
      o.shootCd = rng.range(1.0, 1.7); npcShoot();
    }
  }
  for (const gd of G.guards) {
    if (!gd.alive) continue;
    const nearCometa = Math.hypot(player.pos.x - storyCars.cometa.pos.x, player.pos.z - storyCars.cometa.pos.z) < 26;
    const stoleIt = missions.started && missions.mission === 1 && missions.stage >= 1;
    if ((nearCometa || stoleIt) && gd.shootCd <= 0 && Math.hypot(gd.pos.x - fp.x, gd.pos.z - fp.z) < 24) {
      gd.shootCd = rng.range(1.1, 1.9); npcShoot();
      for (const p of peds) p.scare(gd.pos, 3);
    }
  }
  combat.update(dt);

  // contextual prompt line
  let prompt = '';
  if (G.inCar) prompt = missions.race ? '' : 'E — get out · Space — handbrake · H — horn';
  else {
    const car = nearestCar();
    if (car) prompt = `E — ${car.stolen || car === storyCars.sedan ? 'drive' : 'steal'} the ${car.name}`;
    else if (missions.started && missions.mission === 2 && missions.stage === 2) prompt = 'Hold E — crack the vault';
    else if (Math.hypot(player.pos.x - GARAGE_MARKER.x, player.pos.z - GARAGE_MARKER.z) < 4.5 && !missions.started && !missions.storyDone) prompt = 'E — save · Carmen has work for you';
  }
  hud.setPrompt(prompt);
  hud.setWeapon(combat.ammo, combat.reloading > 0);
  hud.setHealth(player.health);

  // camera: chase behind the car, orbit behind Marco
  if (G.inCar && G.car) {
    camTarget.set(
      G.car.pos.x - Math.sin(G.car.heading) * 9.5, 3.6,
      G.car.pos.z - Math.cos(G.car.heading) * 9.5);
    camera.position.lerp(camTarget, Math.min(1, dt * 5));
    camera.lookAt(G.car.pos.x, 1.4, G.car.pos.z);
  } else {
    camTarget.copy(player.cameraPos(7.5));
    camera.position.lerp(camTarget, Math.min(1, dt * 10));
    camera.lookAt(player.pos.x, 1.5, player.pos.z);
  }

  if ((mmTick++ & 1) === 0) {
    hud.drawMinimap({
      x: fp.x, z: fp.z, yaw: G.inCar && G.car ? G.car.heading : player.heading,
      marker: G.markerOverride || missions.markerPos,
      police: police.cars.map((c) => c.pos),
      packages: missions.packages.filter((p) => p.active),
      wanted: G.wanted,
    });
  }
}

// ---------- __palma test / screenshot API ----------
window.__palma = {
  state: () => {
    const fp = focusPos();
    return {
      state: G.state, started: G.started,
      mission: missions.mission, stage: missions.stage,
      inCar: G.inCar, carName: G.car ? G.car.name : null,
      wanted: G.wanted, cash: G.cash,
      guards: G.guards.filter((g) => g.alive).map((g) => ({ x: g.pos.x, z: g.pos.z, health: g.health })),
      storyDone: missions.storyDone,
      policeCars: police.cars.length,
      policePos: police.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      x: fp.x, z: fp.z, dead: G.dead, health: Math.round(player.health),
      ammo: combat.ammo,
      race: missions.race ? { active: true, name: missions.race.name, cp: missions.race.cp } : null,
      vault: Math.round(missions.vaultProgress * 100) / 100,
      bestRaces: { ...missions.bestRaces },
    };
  },
  start: () => startSession(true),
  step: (n) => { for (let i = 0; i < n; i++) tick(1 / 60); },
  teleport: (x, z) => {
    if (G.inCar && G.car) { G.car.pos.set(x, 0, z); G.car.speed = 0; }
    player.setPos(x, z);
    if (G.inCar && G.car) player.pos.set(x, 0, z);
  },
  setWanted: (n) => G.setWanted(n),
  heal: () => { player.health = 100; G.dead = false; hud.setHealth(100); },
  hurt: (n) => hurtPlayer(n),
  holdE: (ms) => { eHeldApi = Math.max(eHeldApi, ms / 1000); },
  save: () => doSave(true),
  shoot: () => doShoot(),
  melee: () => doMelee(),
  enterStoryCar: (kind) => {
    const car = kind === 'cometa' ? storyCars.cometa : storyCars.sedan;
    player.setPos(car.pos.x + 2, car.pos.z + 2);
    enterCar(car);
  },
  pressE: () => interact(),
  crime: (k) => crime(k),
  parkedPos: () => (parkedCars.length ? { x: parkedCars[0].pos.x, z: parkedCars[0].pos.z } : null),
};

// ---------- boot: screenshot scenes pose a running game ----------
const shotName = params.get('shot');
if (shotName) {
  startSession(true);
  applyShot(G, shotName);
  if (shotName === 'title') {
    G.state = 'title'; G.started = false;
    document.getElementById('title').style.display = 'flex';
  }
}
window.__palmaReady = true;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
