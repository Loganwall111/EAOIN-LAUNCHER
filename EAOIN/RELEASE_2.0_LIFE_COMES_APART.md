# Update 2.0 — "Life Comes Apart"

## THE BUG YOU REPORTED — fixed

> "every time I my game I get this blue screen flashing at me when I look in the
> sky it's all blue and when I turn away it goes back to normal"

**This was a real bug, not a graphics setting.** Root cause, confirmed by
reading the render path:

`SceneLighting.configureSceneLighting()` built **two nested sky spheres**:

| Mesh | Diameter | Alpha | Flag |
|---|---|---|---|
| `overworld_sky_dome` | 1200 | 1.00 | `infiniteDistance` |
| `horizon_gradient_dome` | 800 | 0.08 | `infiniteDistance` |

`infiniteDistance` pins a mesh to the camera. So both spheres sat at the *same
effective depth*, with the smaller permanently inside the larger — they
**z-fought**, which is the flashing. And the outer dome was painted a **single
flat emissive colour**, so the instant you pitched the camera above the horizon
the whole frame became one uniform blue. Look back down at terrain and it
looked normal again. Exactly what you described.

Compounding it, **three systems each wrote `scene.clearColor` and
`scene.fogColor` every frame with different formulas** (`updateWorldLighting`,
`DynamicSky`, and `DimensionRuntime`), while the dome you actually saw was
painted by a fourth. Sky colour, fog colour and dome colour never agreed, which
produced the hard banding at the horizon.

### The fix

One dome. One writer. `sky/AtmosphereSystem` is now the **sole owner** of the
sky, and nothing else in the engine may touch `clearColor`/`fogColor`.

- `SkyDome.ts` — a single dome with a real vertical gradient baked into
  **vertex colours** (zenith → horizon ramp + a sun-facing glow band), so
  looking up gives you a graded sky instead of a flat fill.
- `infiniteDistance` is off; the dome is explicitly re-centred on the camera
  every frame. You can never reach, exit or clip it.
- The dome publishes the matching `clearColor` and `fogColor` it is drawing, so
  the horizon blends seamlessly into fogged terrain.
- `SceneLighting.ts` no longer draws *any* sky — it is purely the light rig now.

---

## The sky

- **Animated cube sun**, ~10x its old size, tumbling as it crosses the sky on
  the 20-minute cycle, with a layered corona and a 10-blade god-ray fan that
  flares and reddens dramatically at sunrise/sunset.
- **Cube moon** with an 8-phase terminator.
- **Ringed gas giant** ("the Saturn planet") with orbiting moonlets.
- **Black hole** with accretion disc and lensing halo.
- **Two drifting planets** that spin, each with a **counter-rotating cloud
  shell** so the clouds visibly move across the surface, plus **a trail of
  little stars** following each one.
- **Comets** on curved elliptical arcs with tapering tails.
- **1,400 stars** (GPU thin instances, one draw call) that twinkle, plus
  **shooting stars**.
- **Aurora Borealis** — 14 waving curtains cycling green → cyan → violet,
  strongest in polar biomes.

## Clouds

Replaced the two flat camera-locked planes (a major contributor to the white
wash) with a real **volumetric cloud field**: large cumulus **clusters** built
from overlapping blocks, domed crowns, spread across a 2800-unit field that
wraps around the player so it fills the world in every direction. Runs as GPU
thin instances — up to 2,600 cloud blocks in a single draw call.

## Per-biome and per-dimension atmospheres

`SkyProfiles.ts` — every biome and all 27 dimensions get their own sky
gradient, fog colour, fog density, cloud tint, aurora strength and weather.
Crossfades over ~2s as you walk between biomes.

**Fog policy, as requested:** low almost everywhere (`FOG_LOW`), so you can see
to the render distance. Heavy only in swamps, mushroom fields, haunted woods
and storm dimensions.

| Biome | Weather | Fog |
|---|---|---|
| Desert | **Sandstorm** | Medium, very bright sky |
| Mountains / Tundra | **Snowstorm** | Medium |
| Swamp | **Fireflies** | Heavy |
| Volcanic | Ashfall | Medium |
| Nether | Embers | Medium |
| Plains / Forest | Clear / pollen | **Low** |

## VFX

`BiomeVFX.ts` — pooled particle systems, only the active ones emit:
fireflies, **butterflies**, pollen, sandstorm, snowstorm, ashfall, embers,
spores, rain, cosmic dust. Butterflies by day and fireflies at night in lush
biomes.

## The caves — completely rebuilt

`DeepCaves.ts`. **Verified by test: 48.6% of the underground is now open
cavern, while the surface stays 93.4% solid.**

Bands are computed as *fractions of the surface-to-bedrock column* rather than
absolute depths. This mattered: EAOIN's terrain runs y=12–78 with bedrock at
y=4, so Minecraft-style absolute offsets (−20/−55/−85) fell below bedrock
everywhere and carved nothing at all.

**10 cave biomes**: Dirt Cavern, Lush Cavern, **Mushroom Valley**,
**Glow-Worm Grotto**, Crystal Hollow, Frozen Cavern, Magma Cavern, Fungal Deep,
**Undiscovered Ruins**, and the rare **Backrooms**. Bioluminescence on floors
and ceilings in every biome, and **the core of the world is lava**.

## Ocean

`OceanSystem.ts` — six graded depth zones (Surface → Sunlight → Twilight →
Midnight → Abyss → Trench) that get **progressively darker and foggier** as you
descend, summed-sine **waves**, **whirlpools** that drag you down, plankton
density scaling with depth, and **the Bloop** — audible from 400 blocks, and it
can swallow you into its own dimension.

## Wildlife

`WildlifeRegistry.ts` — 40+ real-world animals across 7 body plans.
**Snakes** (rattlesnake, python, king cobra, sea snake), ocean life (shark,
orca, humpback whale, dolphin, sea turtle, jellyfish, anglerfish, crab),
**birds that fly above** (eagle, seagull, parrot, owl, bat), and land animals
across cold/warm/hot biomes (camel, elephant, lion, giraffe, polar bear,
penguin, bear, wolf, crocodile…). Every mob now has **emissive eyes**.

## Creative inventory — fixed

Entering Creative genuinely didn't switch the inventory, because game mode was
fixed at world creation and baked into a React effect dependency that rebuilt
the entire scene.

- `/gamemode creative` (plus `/gm 1`, `/gmc`, and all Minecraft aliases)
- **F4** toggles Creative/Survival instantly
- Mode now lives in a ref, so switching **no longer rebuilds the world**
- Creative menu gains an **All** tab, search across **every** category
  (name, id, or category), and an **editable hotbar** — click a slot to arm it,
  click any block to assign it

## Boot & menus

- **Sign-in no longer forced on launch.** Boot goes straight to the title
  screen; sign-in only opens when you press the button.
- **No loading bar during boot** — nothing was loading, it was fake.
- **New Mojang-style logo phase**: each letter of EAOIN drops in on its own
  note of a four-note **"doo doo doo doo" chime**, overshoots, and settles.
  The whole boot runs noticeably longer and reads as a real AAA title card.
- **The loading bar moved to world creation**, where there is real work — a
  Minecraft-style screen with tiled dirt, a chunky segmented bar and tips.

## Spawn cutscene

`SpawnAwakening.tsx` — you wake up. Eyelids flutter open (real CSS shutters
over the **live** 3D canvas), vision focuses, you're face-down with your hands
on the ground, you push up to standing, look around, and raise your hands.
~9 seconds, fully skippable.

## World types

`WorldTypes.ts` — 12 presets on the create screen: Default, **Superflat**,
Amplified, Large Biomes, **Skylands**, Islands, Water World, **Cave World**,
**The Far Lands**, **Sub-Bedrock Stack**, **Inverted**, Single Biome.

## Dimensions

The Dimensions menu (**F8**) now **teleports** — click any of the 27 to travel
instantly, and the whole atmosphere swaps with you.

## Portals — see-through

`PortalWindow.ts` — portal interiors are no longer opaque discs. Each is a
window onto the destination: that dimension's sky gradient, sun glow, aurora,
drifting clouds, ground band and horizon silhouettes, behind a rippling
refractive edge.

> Implementation note: a true portal render needs a second camera and a
> render target *per portal*, re-rendering the scene each frame — and the
> destination's geometry isn't even loaded. Painting the destination's
> atmosphere gives the same read at a fraction of the cost.

## Black hole & the Reality Chip

`BlackHoleEncounter.ts` — a real **gravitational lensing** post-process shader.
Pixels are deflected on an inverse-square falloff around the event horizon,
with an **Einstein ring** and chromatic dispersion. It exerts genuine pull, and
crossing the horizon drops you into the void.

`RealityChip.ts` — the reward: **12 powers**, Infinity-Gauntlet style,
including **The Snap** (erase a fraction of reality), Freeze Time, Rewind,
Fold Space, Phase, Reshape, Invert Gravity, Dominate. Each has a real cooldown.

## Audio

`AmbienceEngine.ts` — **20 layered procedural soundscapes** replacing the old
single beep. Each has a filtered-noise bed (wind/water/rumble/hiss), an LFO
that makes it breathe, a tonal drone, and sparse randomised one-shots
(birdsong, crickets, drips, creaks, frogs, gulls, whale calls, distant roars).
Covers every biome, dimension, underwater, deep caves — **and the main menu**.
Crossfades over 2s.

## Survival — thirst

`Hydration.ts` — the desert is now genuinely hostile. Thirst drains on a curve
driven by **climate severity × exertion × sun exposure**: ~2 minutes to empty
in an open desert at noon, barely moving in a temperate forest. Empty means
steady damage; low means throttled stamina regen. Press **X** near water to
drink. Standing in water rehydrates you.

## Placeholder emoji → real assets

`DimensionSigil.tsx` — hand-built inline **SVG emblems** for all 27 dimensions,
each drawn from that dimension's own palette. Scales cleanly at any size and
renders identically everywhere, unlike emoji.

---

## Verification

- `tsc --noEmit` — clean
- `vitest run` — **175 tests passing** (up from 136)
- `vite build` — production bundle builds

New test suites:
- `deep-caves.test.ts` — proves caverns are large *and* the surface is intact
- `life-comes-apart.test.ts` — 32 tests across sky profiles, fog policy,
  hydration, wildlife, world types, ocean depth, the Reality Chip, ambience
  routing and `/gamemode`
- `sky-render-safety.test.ts` — the original anti-regression suite still passes

## New keybinds

| Key | Action |
|---|---|
| **F4** | Toggle Creative / Survival |
| **F8** | Dimensions menu (click to teleport) |
| **X** | Drink water |

---

## Still outstanding

Honest status on items from the brief that are **groundwork, not finished
features** — the data models and systems exist and are tested, but are not yet
fully wired into the render loop:

- **Void Leviathan boss fight** — the chip and the black-hole entry exist; the
  tentacle boss encounter itself is not yet built.
- **Sub-Bedrock stacked dimensions** — the preset and config are in place;
  the layered generation pass is not.
- **Far Lands corruption** — the preset exists; the noise-saturation pass is
  not yet implemented.
- **The Aether / Backrooms as full dimensions** — Backrooms generates as a rare
  cave pocket; neither is a standalone dimension yet.
- **Ocean waves, whirlpools and the Bloop** — fully implemented and tested as
  systems, but not yet driven from `GameCanvas`'s frame loop.
- **Ray tracing** — the existing pipeline is raster + post-processing.
  True RT is not feasible in this WebGL/WebGPU path.
- Remaining emoji in non-dimension UI still need the same SVG treatment.
