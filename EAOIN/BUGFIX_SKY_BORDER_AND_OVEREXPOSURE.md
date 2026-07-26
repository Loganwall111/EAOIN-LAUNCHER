# Bugfix — "blue/white border in front of me" + over-bright sky

## Symptom (as reported)

> "When they start playing my game I get this blue texture surrounding me, I can't see anything,
> it's just like a dark blue white and the sky is way too bright and everything.
> It was like a border in front of me."

Two separate defects were stacking on top of each other. Both are now fixed.

---

## Defect 1 — Giant vertical sky planes glued to the camera (the "border")

`src/sky/DynamicSky.ts` built the star field and the two cloud layers with
`MeshBuilder.CreatePlane(...)`.

In BabylonJS `CreatePlane` returns a plane lying in the **XY plane facing +Z** — that is a
**vertical wall**, not a horizontal overhead sky layer. The code then did:

```ts
stars.infiniteDistance = true;    // pinned to the camera, never falls behind
cloud.infiniteDistance  = true;
cloud2.infiniteDistance = true;
```

…and, every single frame, also re-centred them on the player:

```ts
this.cloudLayer.position.copyFrom(camera);
this.cloudLayer.position.y = 60;
```

The result: three walls **1200, 1500 and 2400 units across**, un-rotated, permanently welded to
the camera and slicing straight through the player's eyeline. `backFaceCulling = false` meant they
rendered from both sides, so there was no angle you could turn to escape them. The cloud material
is near-white emissive (`0.85, 0.88, 0.95`) and the sky behind it is blue — which is exactly the
reported "dark blue and white border surrounding me that I can't see through".

`infiniteDistance` on top of manual per-frame positioning is also self-contradictory: Babylon
already neutralises the camera translation for infinite-distance meshes, so the extra
`copyFrom(camera)` double-applied the offset and dragged the planes even further into the near
clip range.

### Fix

* Sky layers are now **rotated flat** (`rotation.x = Math.PI / 2`) so they are true overhead
  ceilings instead of walls.
* `infiniteDistance` is **turned off** on the layers we position manually — you cannot have both.
  It is kept only for the sun and moon, which never move relative to the camera.
* Layers are parked at a **guaranteed clearance above the camera** (`+120` / `+180` world units)
  and are re-based on the camera each frame in X/Z only, so they can never intersect the player.
* Layers render in `renderingGroupId = 0` behind world geometry, are excluded from picking and
  from collisions.
* Cloud opacity is clamped so the overhead layer can never fully occlude the sky.

---

## Defect 2 — Two complete lighting rigs stacked (the "way too bright")

`GameCanvas` was building **both** lighting systems into the same scene:

| Source | Creates |
|---|---|
| `configureSceneLighting()` (`SceneLighting.ts`) | `DirectionalLight` sun @1.18, `HemisphericLight` sky @0.78, `PointLight` spawn, `ShadowGenerator` |
| `new CinematicLighting()` (`CinematicLighting.ts`) | **another** `DirectionalLight` sun @1.0, **another** `DirectionalLight` moon, **another** `HemisphericLight` @0.45, **another** `ShadowGenerator` |

Babylon sums every light's contribution per pixel, so every surface was being lit roughly
**twice over** — ~2.2x directional and ~1.2x hemispheric. Combined with `GlowLayer` being
instantiated twice (`voxel_bloom` *and* `cinematic_glow`, each adding its own bloom pass) and two
`DefaultRenderingPipeline`s competing, the whole frame washed out to white. That is the
"sky is way too bright and everything".

### Fix

* `CinematicLighting` now **adopts the existing rig** when one is already in the scene instead of
  creating a duplicate. A new `adoptExisting` option (default `true`) looks up lights by name and
  reuses them; it only constructs new lights when the scene genuinely has none.
* The same de-duplication is applied to `GlowLayer` — `CinematicLighting` reuses an existing glow
  layer rather than adding a second bloom pass.
* `GameCanvas` no longer builds a second `DefaultRenderingPipeline`; `CinematicLighting` owns the
  post stack, and total scene exposure is clamped.
* Total scene light energy is normalised in `updateWorldLighting` so day-time intensity lands back
  in a sane range.

---

## Regression test

`tests/unit/sky-render-safety.test.ts` asserts the invariants that were violated:

1. No sky layer may be both `infiniteDistance` **and** manually camera-positioned.
2. Every large sky layer must be rotated flat and sit above the camera, never at eye level.
3. The scene must contain exactly one sun, one hemispheric light and one glow layer.
