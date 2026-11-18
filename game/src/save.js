// PALMA HEAT — save games live in localStorage under one versioned key.
import { SAVE_KEY } from './config.js';
export function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    return d && typeof d === 'object' && typeof d.cash === 'number' ? d : null;
  } catch { return null; }
}
export function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
export function hasSave() { return loadSave() !== null; }
