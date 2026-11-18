// PALMA HEAT — full play-through test: playwright-core + headless Chromium
// (swiftshader WebGL). Serves game/ on a local port and plays the entire
// three-job story with real key presses at the moments that matter.
import { chromium } from '/home/hatch/workspace/tools/pwtest/node_modules/playwright-core/index.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const GAME_DIR = new URL('./game/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(GAME_DIR, normalize(p).replace(/^\/+/, '')));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(8911, r));

const exe = process.env.CHROME || '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
}
const S = () => page.evaluate(() => window.__palma.state());
const ev = (fn, arg) => page.evaluate(fn, arg);
async function waitState(pred, timeout = 30000, label = '') {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const s = await S();
    if (pred(s)) return s;
    await page.waitForTimeout(300);
  }
  throw new Error('waitState timeout: ' + label + ' last=' + JSON.stringify(await S()));
}

await page.goto('http://127.0.0.1:8911/?seed=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__palmaReady === true, null, { timeout: 25000 });
let s = await S();
check('page loads with zero errors, title state', s.state === 'title' && errors.length === 0, s.state);
check('title screen visible', await page.isVisible('#title'));
await page.click('#btnNew');
s = await waitState((x) => x.state === 'playing' && x.started, 10000, 'new game');
check('New Game starts M1', s.mission === 0 && s.stage === 0, `mission=${s.mission} stage=${s.stage}`);

// steal a parked car with a real E press, then get back out
const parked = await ev(() => window.__palma.parkedPos());
await ev((p) => window.__palma.teleport(p.x + 2.5, p.z), parked);
await page.waitForTimeout(350);
await page.keyboard.press('KeyE');
try {
  s = await waitState((x) => x.inCar, 6000, 'enter parked car');
  check('steal parked car via E', s.inCar, s.carName || '');
  check('car theft raises wanted', s.wanted >= 1, 'wanted=' + s.wanted);
  await page.keyboard.press('KeyE');
  s = await waitState((x) => !x.inCar, 6000, 'exit car');
  check('exit car via E', !s.inCar);
} catch (e) {
  check('steal parked car via E', false, e.message);
  check('car theft raises wanted', false);
  check('exit car via E', false);
}
await ev(() => { window.__palma.setWanted(0); window.__palma.heal(); });

// M1 First Run: sedan -> docks -> package on foot -> garage
await ev(() => window.__palma.teleport(-108, -116.2));
await page.waitForTimeout(300);
await page.keyboard.press('KeyE');
s = await waitState((x) => x.inCar && x.stage === 1, 10000, 'M1 stage1');
check('M1: entered Vega sedan -> stage 1', s.stage === 1, s.carName || '');
await ev(() => window.__palma.teleport(-90, 116));
s = await waitState((x) => x.stage === 2, 10000, 'M1 stage2');
check('M1: reached the Docks -> stage 2', s.stage === 2);
await page.keyboard.press('KeyE');
await waitState((x) => !x.inCar, 8000, 'exit at docks');
await ev(() => window.__palma.teleport(-90, 130.5));
s = await waitState((x) => x.stage === 3, 10000, 'M1 stage3');
check('M1: package pickup -> stage 3 with heat', s.stage === 3 && s.wanted >= 1, `stage=${s.stage} wanted=${s.wanted}`);
await ev(() => window.__palma.teleport(-117, -116));
s = await waitState((x) => x.cash === 500, 10000, 'M1 complete');
check('M1 complete: cash is 500', s.cash === 500, 'cash=' + s.cash);
s = await waitState((x) => x.mission === 1 && x.guards.length === 2, 45000, 'M2 start');
check('M2 auto-starts with 2 marina guards', s.mission === 1 && s.guards.length === 2, 'guards=' + s.guards.length);

// M2 Marina Muscle: steal the Cometa under fire, deliver against the timer
await ev(() => window.__palma.teleport(93, 117));
await page.waitForTimeout(300);
await page.keyboard.press('KeyE');
s = await waitState((x) => x.inCar && x.stage === 1, 10000, 'M2 stage1');
check('M2: stole Cometa -> stage 1 at 2 stars', s.stage === 1 && s.wanted >= 2, `car=${s.carName} wanted=${s.wanted}`);
await ev(() => window.__palma.teleport(-116, -114));
s = await waitState((x) => x.cash === 1400, 12000, 'M2 complete');
check('M2 complete: cash is 1400', s.cash === 1400, 'cash=' + s.cash);
await page.keyboard.press('KeyE');
await waitState((x) => !x.inCar, 8000, 'exit cometa');
s = await waitState((x) => x.mission === 2, 45000, 'M3 pending');
check('M3 is the next mission', s.mission === 2);

// M3 Palma Trust: bank door -> vault hold -> hideout escape
await ev(() => window.__palma.teleport(9, -38));
s = await waitState((x) => x.stage === 1, 12000, 'M3 stage1');
check('M3: at the bank -> stage 1', s.stage === 1);
await ev(() => window.__palma.teleport(28, -38));
s = await waitState((x) => x.stage === 2, 10000, 'M3 stage2');
check('M3: at the vault -> stage 2', s.stage === 2);
await ev(() => window.__palma.holdE(90000));
s = await waitState((x) => x.stage === 3, 30000, 'M3 stage3');
check('M3: vault hold-E cracks it -> stage 3 at 3 stars', s.stage === 3 && s.wanted >= 3, `stage=${s.stage} wanted=${s.wanted}`);
await ev(() => window.__palma.teleport(-117, -116));
s = await waitState((x) => x.cash === 3900 && x.storyDone, 12000, 'M3 complete');
check('M3 complete: cash is 3900, story done', s.cash === 3900 && s.storyDone, 'cash=' + s.cash);
check('end card is shown', await page.isVisible('#endCard'));
await page.click('#btnEndClose');
await ev(() => window.__palma.setWanted(0));

// save -> reload -> Continue
await ev(() => window.__palma.save());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__palmaReady === true, null, { timeout: 25000 });
check('Continue enabled after reload', await page.isEnabled('#btnContinue'));
await page.click('#btnContinue');
s = await waitState((x) => x.state === 'playing', 10000, 'continue');
check('Continue restores cash + story progress', s.cash === 3900 && s.storyDone, `cash=${s.cash} storyDone=${s.storyDone}`);

// heat brings the police
await ev(() => { window.__palma.teleport(0, 0); window.__palma.setWanted(3); });
s = await waitState((x) => x.policeCars > 0, 45000, 'police spawn');
check('police spawn at 3 stars', s.policeCars > 0, 'cars=' + s.policeCars);

// stand next to a cruiser until the bust meter fills
await ev(() => window.__palma.setWanted(2));
let busted = false;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    s = await S();
    if (s.wanted === 0 && Math.hypot(s.x - 112, s.z + 80) < 12) { busted = true; break; }
    if (s.policePos && s.policePos.length) {
      // only close the gap while far away; once a cruiser is near, stand still
      // and let the bust meter fill (teleporting now could race the respawn)
      let c = s.policePos[0], bd = Infinity;
      for (const p of s.policePos) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; c = p; } }
      if (bd > 6) await ev((cc) => window.__palma.teleport(cc.x + 3, cc.z + 3), c);
    }
    await page.waitForTimeout(900);
  }
}
s = await S();
check('BUSTED: wanted cleared, respawn at police station', busted && s.wanted === 0, `x=${s.x} z=${s.z} cash=${s.cash}`);

// death sends Marco to the hospital at -10% cash
const cashBeforeDeath = s.cash;
await ev(() => { window.__palma.teleport(0, 30); window.__palma.hurt(500); });
s = await waitState((x) => !x.dead && x.health === 100 && Math.hypot(x.x + 30, x.z - 38) < 10, 20000, 'death respawn');
check('FLATLINED: hospital respawn at -10% cash', s.cash === cashBeforeDeath - Math.floor(cashBeforeDeath * 0.1), `cash ${cashBeforeDeath} -> ${s.cash}`);

// pistol + melee
await ev(() => { window.__palma.setWanted(0); window.__palma.teleport(-4, 4); });
await page.waitForTimeout(300);
await ev(() => window.__palma.shoot());
s = await S();
check('pistol fires: ammo spent, wanted rises', s.ammo === 11 && s.wanted >= 1, `ammo=${s.ammo} wanted=${s.wanted}`);
await ev(() => window.__palma.melee());
check('melee runs without error', errors.length === 0);

// one street race, start to finish (Bay Loop)
await ev(() => { window.__palma.setWanted(0); window.__palma.enterStoryCar('sedan'); window.__palma.teleport(-60, 118); });
await page.waitForTimeout(500);
await ev(() => window.__palma.pressE());
s = await waitState((x) => x.race && x.race.active, 10000, 'race start');
check('race starts at the Bay Loop ring', !!(s.race && s.race.name === 'Bay Loop'));
for (const cp of [{ x: 0, z: 120 }, { x: 60, z: 120 }, { x: 118, z: 60 }, { x: 118, z: 0 }]) {
  await ev((c) => window.__palma.teleport(c.x, c.z), cp);
  await page.waitForTimeout(700);
}
s = await waitState((x) => !x.race && x.bestRaces['bay-loop'] > 0, 12000, 'race finish');
check('race completes: best time kept, payout paid', s.bestRaces['bay-loop'] > 0, `best=${s.bestRaces['bay-loop']} cash=${s.cash}`);

check('zero console errors overall', errors.length === 0, errors.slice(0, 3).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n=== E2E: ${results.length - failed.length}/${results.length} passed, console errors: ${errors.length} ===`);
await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
