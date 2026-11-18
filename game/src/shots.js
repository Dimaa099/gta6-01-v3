// PALMA HEAT — frozen set-piece scenes for screenshots: ?shot=<name>&seed=1.
// Each scene poses the live game (cars, heat, banners) and then holds still.
export function applyShot(G, name) {
  const P = G.player;
  G.setWanted(0);
  if (name === 'title') {
    P.setPos(-6, 14); P.camYaw = 2.4; P.heading = 2.4;
  } else if (name === 'chase') {
    const car = G.storyCars.sedan;
    G.enterCar(car);
    car.pos.set(2, 0, 60); car.heading = Math.PI / 2; car.speed = 20;
    P.camYaw = Math.PI / 2;
    const copA = G.police.spawnOne({ x: -11, z: 55.2 });
    copA.heading = Math.PI / 2; copA.speed = 12; copA.held = true;
    const copB = G.police.spawnOne({ x: -15, z: 65.8 });
    copB.heading = Math.PI / 2; copB.speed = 12; copB.held = true;
    // every frame, re-pin the cruisers in formation behind the fleeing sedan
    G.shotTick = () => {
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      G.camera.position.set(car.pos.x - fx * 16, 6.5, car.pos.z - fz * 16);
      G.camera.lookAt(car.pos.x + fx * 4, 1.2, car.pos.z + fz * 4);
      copA.pos.set(car.pos.x - fx * 6.5 - fz * 2.2, 0, car.pos.z - fz * 6.5 + fx * 2.2);
      copA.heading = car.heading; copA.syncMesh();
      copB.pos.set(car.pos.x - fx * 7.5 + fz * 2.7, 0, car.pos.z - fz * 7.5 - fx * 2.7);
      copB.heading = car.heading; copB.syncMesh();
    };
    G.setWanted(3);
    G.hud.setObjective('Lose the Palma PD!');
  } else if (name === 'foot') {
    P.setPos(-4, 6); P.camYaw = 0.7; P.heading = 0.7;
    G.hud.dialogue('📱 Carmen "La Jefa" Vega', 'Marco. Bahía Palma is waking up. Do not keep me waiting.');
    G.hud.setObjective("Get in Vega's sedan at Vega's Garage");
  } else if (name === 'bank') {
    P.setPos(18, -38); P.camYaw = Math.PI / 2; P.heading = Math.PI / 2;
    G.hud.setObjective('Hold E at the vault to take the cash');
    G.markerOverride = { x: 29, z: -38 };
  } else if (name === 'marina') {
    P.setPos(81, 101); P.camYaw = 0.85; P.heading = 0.85;
    G.hud.setObjective('Steal the orange Cometa GT from the Marina Lot');
    G.markerOverride = { x: G.storyCars.cometa.pos.x, z: G.storyCars.cometa.pos.z };
  }
}
