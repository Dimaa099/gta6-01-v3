# PALMA HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Dimaa099/gta6-01-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Dimaa099/gta6-01-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**PALMA HEAT** is an original 3D open-world crime game set in Bahía Palma, a
sun-soaked fictional bay city of palm-lined avenues, a marina, working docks
and one very trusting bank. You are **Marco Reyes**, getaway driver for crime
boss **Carmen "La Jefa" Vega**. Run her three-job story chain — *First Run*,
*Marina Muscle* and *Palma Trust* — then keep the city: steal any car, outrun
the Palma PD's five-star wanted system, brawl and shoot it out with guards and
officers, crack the Palma Trust vault, chase green package pickups and win
three checkpoint street races. Everything is real gameplay: a seeded 9×9-block
city with traffic AI, ~30 walking pedestrians, police cruisers that pursue and
officers who bail out and shoot at high heat, a BUSTED meter, hospital bills,
and a full save/continue system. All names, story, art and sound are original;
every sound is synthesized live with WebAudio.

## How to play

- **On foot:** WASD move (camera-relative), mouse orbit (click to pointer-lock, or drag), Shift sprint, **E** interact, mouse click shoot pistol, **F** melee, **R** reload
- **Driving:** **E** enter/exit any car, WASD drive, Space handbrake, **H** horn
- **Heat:** crimes (theft, assault, gunfire, robbery) raise your 0–5 stars; police pursue and the BUSTED meter fills if they pin you while slow — break line of sight to cool off
- **Missions:** follow the gold beam / minimap blip; Carmen's phone texts carry the story. M1 pays $500, M2 $900, M3 $2,500
- **Side money:** green packages +$75, street races +$150 (start one by pressing E at a blue ring while driving)
- **Save:** automatically after each job, at Vega's Garage, or from the pause menu (**P** / Esc) — Continue restores cash, progress and best race times
- **M** mute

## Run it

```
node serve.ts
```

then open http://localhost:8080 — no build step, no network needed; three.js is vendored under `game/vendor/`.

<sub>Entered on [make.fun](https://make.fun/?ref=dimarz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
