// PALMA HEAT — layout constants for Bahía Palma, an invented bay city.
// Roads form a square grid; every named place below sits on that grid.
export const ROAD_STEP = 30;                       // distance between road centre-lines
export const ROAD_HALF = 5;                        // asphalt half-width (sidewalk included to ±7)
export const GRID = [-120, -90, -60, -30, 0, 30, 60, 90, 120];
export const CITY_MIN = -138;
export const CITY_MAX = 138;
export const WATER_Z = 142;                        // bay waterline (south edge)
export const SAVE_KEY = 'palmaheat-save-v1';
export const WORLD_SEED = 20261117;

export const POIS = {
  garage:   { name: "Vega's Garage",    x: -120, z: -120 },
  bank:     { name: 'Palma Trust Bank', x: 30,   z: -30 },
  marina:   { name: 'Marina Lot',       x: 90,   z: 120 },
  docks:    { name: 'The Docks',        x: -90,  z: 120 },
  police:   { name: 'Police Station',   x: 120,  z: -90 },
  hospital: { name: 'Hospital',         x: -30,  z: 30 },
  diner:    { name: "Rosie's Diner",    x: 60,   z: 60 },
  hideout:  { name: 'Hideout',          x: -120, z: -120 },
};
export const CAR_COLORS = [0xd64541, 0x3f7fbf, 0xf2b035, 0x53b06a, 0xe8e4da, 0x8e5bd6, 0x22262e, 0xff7a1a, 0x2ec4b6, 0xd63384];
export const PLAYER_START = { x: -112, z: -104 };
export const POLICE_DOOR = { x: 112, z: -80 };
export const HOSPITAL_DOOR = { x: -30, z: 38 };
