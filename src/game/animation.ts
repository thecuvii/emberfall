import manifest from "./characters.json";
import { BOSS_MOVES, HERO_ATTACKS, type Run } from "./model";

type Clip = keyof typeof manifest.clips;
export type Pose = { texture: "hero" | "hero-support" | "boss"; frame: number };
export function spriteFrame(clip: Clip, progress: number) {
  const { start, count } = manifest.clips[clip];
  return start + Math.round(Math.max(0, Math.min(1, progress)) * (count - 1));
}
export function attackPose(
  elapsed: number,
  attack: { contact: number; end: number; duration: number },
) {
  if (elapsed < attack.contact) return (elapsed / attack.contact) * 0.245;
  if (elapsed < attack.end)
    return (
      0.245 +
      ((elapsed - attack.contact) / (attack.end - attack.contact)) * 0.425
    );
  return (
    0.67 + ((elapsed - attack.end) / (attack.duration - attack.end)) * 0.33
  );
}

/** Pose selection never gates input. One simulation clock owns all action times.
 * Contact poses survive hitstop; locomotion phase survives action interruptions.
 * Landing gets a contact pose, but move/attack/roll may immediately supersede it.
 */
export class HeroAnimation {
  pose: Pose = { texture: "hero", frame: 0 };
  clip = "idle";
  private distance = 0;
  private clock = 0;
  private landing = 0;
  private grounded = true;
  private x = 180;
  reset(p: Run["player"]) {
    this.distance = this.clock = this.landing = 0;
    this.grounded = p.grounded;
    this.x = p.x;
    this.clip = "idle";
    this.pose = { texture: "hero", frame: 0 };
  }
  step(p: Run["player"], dt: number) {
    this.clock += dt;
    if (p.grounded && p.action === "run")
      this.distance += Math.abs(p.x - this.x);
    this.x = p.x;
    this.landing = Math.max(0, this.landing - dt);
    if (!this.grounded && p.grounded) this.landing = 0.14;
    this.grounded = p.grounded;
    this.clip = p.action;
    const t = p.actionTime;
    const progress = Math.min(1, t / Math.max(0.001, p.actionDuration));
    const support = (frame: number) => {
      this.pose = { texture: "hero-support", frame };
    };
    const base = (clip: Clip, at: number) => {
      this.clip = clip;
      this.pose = { texture: "hero", frame: spriteFrame(clip, at) };
    };
    if (p.action === "death")
      support(8 + Math.min(3, Math.floor(progress * 4)));
    else if (p.action === "hurt") support(8);
    else if (p.action === "heal")
      support(progress < 0.15 ? 1 : progress < 0.84 ? 2 : 3);
    else if (p.action === "cast")
      support(t < 0.08 ? 4 : t < 0.18 ? 5 : t < 0.31 ? 6 : 7);
    else if (p.action === "charge") base("attack3", 0.13);
    else if (p.action === "heavy")
      base(
        "attack3",
        t < HERO_ATTACKS.heavy.contact
          ? 0.13 + (t / HERO_ATTACKS.heavy.contact) * 0.115
          : attackPose(t, HERO_ATTACKS.heavy),
      );
    else if (p.action === "airAttack")
      support(
        t < HERO_ATTACKS.airAttack.contact
          ? 12
          : t < 0.25
            ? 13
            : p.grounded
              ? 15
              : 14,
      );
    else if (p.action === "roll") base("roll", progress);
    else if (
      p.action === "attack1" ||
      p.action === "attack2" ||
      p.action === "attack3"
    )
      base(p.action, attackPose(t, HERO_ATTACKS[p.action]));
    else if (!p.grounded)
      base(p.vy < -65 ? "rise" : p.vy > 65 ? "fall" : "apex", 0.5);
    else if (this.landing > 0 && (p.action !== "run" || this.landing > 0.105))
      base("land", 1 - this.landing / 0.14);
    else if (p.action === "run") base("run", (this.distance / 78) % 1);
    else base("idle", (this.clock / 1.5) % 1);
  }
}

export function bossFrame(b: Run["boss"]) {
  const t = b.actionTime;
  const idle = b.stage === 2 ? 19 : 0;
  if (b.action === "death") return 20 + Math.min(3, Math.floor((t / 0.9) * 4));
  if (b.action === "transition")
    return 16 + Math.min(3, Math.floor((t / 0.9) * 4));
  if (b.action === "idle") return idle;
  // Discarded generated walk pose 2 (a duplicated blade) instead of shipping it.
  if (b.action === "walk") return Math.floor(Math.abs(b.x) / 22) % 2 ? 3 : idle;
  const m = BOSS_MOVES[b.action];
  if (b.action === "sweep")
    return t < m.windup * 0.45
      ? 4
      : t < m.windup
        ? 5
        : t < m.windup + m.active
          ? 6
          : t < b.actionDuration - 0.16
            ? 7
            : idle;
  if (b.action === "slam")
    // Generated pose 9 lost the blade; hold the intact raised-cleaver pose.
    return t < m.windup
      ? 8
      : t < m.windup + m.active
        ? 10
        : t < b.actionDuration - 0.16
          ? 11
          : idle;
  if (b.action === "spit")
    return t < m.windup ? 12 : t < m.windup + m.active + 0.25 ? 13 : idle;
  return t < m.windup + m.active ? 14 : t < b.actionDuration - 0.16 ? 15 : idle;
}
