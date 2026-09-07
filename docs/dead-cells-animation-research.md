# Dead Cells character animation research

Research date: 2026-09-07. Scope: production and control/feel lessons for a higher-quality original web character demo. This is not a prescription to copy Dead Cells' art or assets.

## Executive findings

1. **The look is not hand-drawn sprite animation.** Thomas Vasseur describes a basic 3D character and skeleton made in 3DS Max, exported as FBX, rendered by an in-house tool at very low resolution with antialiasing disabled, then exported frame-by-frame as PNGs plus normal maps. A basic toon shader restores volume in-game. The target character was only about 50 pixels tall, so detailed 3D models were deliberately wasteful. [Vasseur 2018]
2. **The important craft is authored timing, not merely a high display refresh.** Vasseur first made the animation convincing and correctly timed with the fewest key frames, then put interpolated frames *before or after* keys, “never in-between.” Attacks were essentially pose-to-pose; VFX supplied movement, impact, and strength. [Vasseur 2018]
3. **The pipeline served iteration.** Pose or timing retakes meant moving keys rather than redrawing a sprite sequence. Motion Twin could adjust a new weapon's animation timing “dozens of times in minutes,” including slowing an attack for balance. Vasseur calls easy retakes the workflow's most important advantage. [Vasseur 2018]
4. **Responsiveness is a control/state-machine property as much as an art property.** Bénard's GDC slides explicitly frame the rule as “Permadeath: never blame the game for poor controls,” ask whether traversal is intended to be the challenge, and list just-in-time jumps, arrival correction (teleport/hop/climb), interpreting player intent, free turnaround, and auto-aim. [Bénard 2019 slides]
5. **Fluidity is not synonymous with 60 FPS.** Vasseur reports that the precursor *ScarKrow* workflow reached 30 animation FPS. This is evidence for the pipeline, not proof that every Dead Cells clip plays at 30 unique drawings/poses per second. A browser may render at 60 Hz while advancing a 12/15/20/30 fps sprite sequence; interpolation, motion, VFX, controls, and carefully spaced poses determine feel. [Vasseur 2018]

## Verified production facts

These are direct developer statements, not visual inference:

| Fact | Evidence |
|---|---|
| Vasseur was Dead Cells' sole artist for one year, handling art direction, characters, monsters, animation, FX, and most backgrounds before Gwenaël Massé joined. | [Vasseur 2018] |
| A simple 2D pixel-art model sheet guided a basic 3D model and skeleton in 3DS Max; it was exported in Filmbox/FBX format. | [Vasseur 2018] |
| A purpose-built renderer output the mesh at small size without antialiasing for the pixelated result. | [Vasseur 2018] |
| Animation was built on key frames. Timing and minimum frame count were solved first; interpolation was added around, not between, the key poses. Attack animation was pose-to-pose, supported by VFX. | [Vasseur 2018] |
| Each 3D animation frame and a corresponding normal map were exported to PNG; a basic toon shader rendered volume. Frame sequences also permitted blend modes. | [Vasseur 2018] |
| Reusable rigs/assets, automatic interpolation, and fast pose/timing retakes were explicit pipeline benefits. | [Vasseur 2018] |
| Low-resolution cel shading without AA had tradeoffs: flickering pixels and reduced detail. The team chose animation over detail. | [Vasseur 2018] |
| Bénard identifies Dead Cells' three pillars as combat, progression, and replayability. The control section explicitly shows just-in-time jumps, arrival adjustment, intent interpretation, free turnaround, and auto-aim. | [Bénard 2019 slides] |
| GDC's own description says the talk concerns controls, player feedback, particles, and making players' lives easier while preserving challenge. | [GDC 2019 announcement] |
| Bénard says on his own site that he was lead game designer/developer, responsible for game design, most enemies, all weapons/skills, and all visual effects/particles; it used Haxe, HeapsIO, and his GameBase. | [Bénard project page] |

## What the primary sources do **not** establish

- No source reviewed gives exact Dead Cells frame counts or milliseconds for idle, run, jump, landing, a three-hit combo, or roll.
- No reviewed source explicitly documents the player's animation cancel windows, input-buffer duration, squash/stretch values, anticipation duration, hit-stop duration, or a named “contact frame” system.
- The phrase “30 FPS” in Vasseur's article is attached to the earlier ScarKrow method. It must not be promoted into “Dead Cells uses 30 unique sprite frames every second.”
- The GDC slide deck contains animations/video examples that do not survive text extraction. The official video URL was found, but the available media tool could not open YouTube; therefore this report claims no video viewing and invents no timestamps.
- “Anticipation,” “contact,” “squash/stretch,” and “cancel” below are implementation interpretations consistent with pose-to-pose attack craft and responsive controls, **not attributed Dead Cells production facts**.

## Implementation implications for an original web demo

### Separate simulation, display, and animation clocks

- Run input/physics deterministically (ideally fixed-step), render at the browser refresh rate, and advance discrete animation poses on an independent authored timeline.
- At 60 Hz display refresh, a 30 fps sprite sequence holds each drawing for 2 refreshes; 20 fps holds for 3; 15 fps for 4; 12 fps for 5. A 60 Hz canvas does not create 60 authored poses.
- Store per-pose durations rather than a single universal `fps`: a readable anticipation may hold longer, a contact pose may last one animation sample, and recovery may compress when chaining/cancelling.
- Gameplay event times (hitbox on/off, impulse, invulnerability, buffered transition) should be authored on the same timeline but not inferred from PNG index alone.

### Build retakes into the data model

- Keep movement root translation and gameplay collision independent of decorative sprite displacement.
- Give every action named events and editable durations so timing can be tuned without redrawing art: `anticipation`, `active/contact`, `recovery`, `chainOpen`, `cancelOpen`, `invulnerable`, `landImpact`.
- Let trails, slashes, dust, sparks, afterimages, camera kick, and brief deformation reinforce the key poses. This follows Vasseur's documented pose-to-pose-plus-VFX strategy; the exact effects are project choices.

### Prioritize intent over decorative completion

- Never make a player wait for an idle/run flourish before moving, jumping, attacking, or rolling.
- Support immediate facing correction before an attack commits; if target assistance is used, constrain it and expose it in tests.
- Add coyote time and jump buffering as web equivalents of Bénard's documented “just-in-time”/intent-friendly philosophy. Exact windows below are proposed targets, not sourced Dead Cells values.

## Proposed measurable acceptance criteria

These values are a **testable first tuning pass**, not reverse-engineered Dead Cells numbers. Evaluate at 60 Hz with frame-step capture and input/event logs. “Pose” means a distinct authored sprite drawing/sample; refresh frames are display updates.

| Action | Authored target | Responsiveness/state target | Visual/readability acceptance |
|---|---|---|---|
| **Idle** | 8–12 poses over 0.9–1.4 s, loop; intentional holds allowed | Move/jump/attack/roll starts on the next simulation tick; no exit wait | Feet/root stay within 1 source pixel; head/torso secondary motion has one clear offset phase; loop seam has no pop when frame-stepped |
| **Run** | 8–10 poses over 0.45–0.60 s at reference speed; phase scales with ground distance, not render FPS | Visual run begins within ≤50 ms of directional input; opposite input changes gameplay direction immediately and reaches a readable opposite-facing pose within ≤100 ms | Two readable contacts and two passing/air phases per cycle; planted foot slides ≤1 source pixel at reference speed; silhouette has visible compression/extension without changing collider |
| **Jump** | 2–3 takeoff poses (≤100 ms), 2–4 rise poses, 1–2 apex holds, 2–4 fall poses | Input buffer 100 ms; coyote time 80–100 ms; variable jump cut reacts within one simulation tick; state follows vertical velocity, not a fixed cinematic clip | Takeoff compression and extension are visibly distinct in frame-step; apex pose appears near sign change of vertical velocity (±50 ms); no animation lock delays control |
| **Land** | 1 contact pose plus 2–4 compression/recovery poses, total 100–180 ms for ordinary fall | Horizontal control preserved; jump can buffer during landing; heavy-land lock only above an explicit fall-speed threshold | Contact pose coincides with collision event within one 60 Hz tick; dust/impact begins same tick; feet do not penetrate floor; ordinary landing can be interrupted by move/jump |
| **3-hit combo** | Each hit has an unmistakable anticipation → contact → recovery grouping; initial tuning: hit 1 = 180–240 ms, hit 2 = 200–280 ms, hit 3 = 280–380 ms | Attack 1 responds ≤50 ms after input; queue next hit 100–150 ms before chain point; each hit exposes documented chain/cancel windows; roll-cancel allowed in chosen recovery region, never silently during committed active frames | Contact pose/event and hitbox onset differ by ≤1 tick; one strong silhouette per hit; no duplicated-looking contact pose; hit 3 has measurably longer anticipation/recovery and stronger VFX than hit 1; missed swings remain readable without hit effects |
| **Roll** | 6–10 poses over 280–380 ms, with entry compression, low travel silhouette, exit extension | Start ≤50 ms after input when legal; invulnerability and movement windows are explicit and unit-tested; direction locks at a documented point; attack/jump exit is allowed only in an authored late window | Collider policy is explicit (unchanged or reduced) and tested; travel distance varies <2% across 60/120/144 Hz displays; dust starts within one tick; ending pose blends to idle/run without a one-frame size/origin pop |

### Cross-action quality gate

1. Capture each action at 60 and 144 Hz. Gameplay event timestamps and total world displacement must match within one simulation tick; only duplicated display frames may differ.
2. Frame-step at 60 Hz and label every anticipation, contact, recovery, and cancel boundary. If reviewers cannot identify the intended contact pose without hit sparks, revise the silhouette/timing rather than adding more refresh FPS.
3. For every legal transition (idle/run/jump/land/combo/roll), automated tests assert input-to-state latency and event order. No state can become stuck waiting for animation completion.
4. Review once with VFX off and once on. Body animation must read without VFX; VFX should amplify direction/contact rather than conceal weak posing.
5. Test combo and roll at normal speed and 0.25× capture. No hitbox may precede the visible attack direction, and no impact effect may precede contact.
6. Run at least three timing retake passes on every combat action using data-only edits. If a timing change requires repainting all frames or code surgery, the pipeline misses Vasseur's central production lesson.

## Source notes and URLs

### Primary / first-person

- **[Vasseur 2018]** Thomas Vasseur, “Art Design Deep Dive: Using a 3D pipeline for 2D animation in *Dead Cells*,” Game Developer (originally Gamasutra), 25 Jan 2018. First-person developer article and the strongest source for the art pipeline.  
  https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-
- **[Bénard 2019 slides]** Sébastien Bénard, “*Dead Cells*: What the F\*n?!,” official GDC 2019 slide deck. Primary talk material; text extraction verifies headings/bullets but not embedded visual examples.  
  https://media.gdcvault.com/gdc2019/presentations/Benard-Sebastian-DeepCells.pdf
- **[Official GDC video]** The same Bénard talk on GDC's official YouTube channel. Located through GDC/Game Developer, but not viewable through the available media tool, so no timestamped claims were taken from it.  
  https://www.youtube.com/watch?v=OfSpBoA6TWw
- **[Bénard project page]** Sébastien Bénard's own Dead Cells project page, stating his responsibilities and technology.  
  https://deepnight.net/games/motion-twin/dead-cells/
- **[GDC 2019 announcement]** GDC's first-party session announcement and scope description.  
  https://gdconf.com/article/get-game-design-tips-and-tricks-from-dead-cells-co-creator-at-gdc-2019

### Discovery/secondary trail (not used to invent production details)

- Game Developer's page linking the official free GDC video:  
  https://www.gamedeveloper.com/design/video-how-cheating-and-making-player-life-easier-helped-i-dead-cells-i-shine
- Game Developer's 2018 interview landing page says Bénard discussed platforming animation and custom side-scroller physics, but its embedded Twitch video was not available in extracted page content; no detailed claims were taken from it:  
  https://www.gamedeveloper.com/design/sebastien-benard-breaks-down-the-fine-details-of-i-dead-cells-i-design
- Later Game Developer commentary (2025) was useful for finding the GDC source but was not treated as primary evidence:  
  https://www.gamedeveloper.com/design/the-secrets-of-dead-cells-smart-constraints-unlocking-the-vault-3

## Bottom line

The defensible Dead Cells lesson is not “draw more frames” or “run at 60 FPS.” It is: establish strong, economical key poses; place interpolation around those keys without weakening contacts; use VFX to reinforce motion and impact; keep animation timing cheap to retake; and make controls interpret intent so decorative animation never obstructs the combat. The proposed numbers above turn that lesson into falsifiable requirements while remaining explicitly separate from facts Motion Twin published.
