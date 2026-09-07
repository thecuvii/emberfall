import { expect, it } from "vitest";
import { HeroAnimation, bossFrame, spriteFrame } from "../src/game/animation";
import {
  Run,
  HERO_ATTACKS,
  BOSS_MOVES,
  STEP,
  emptyInput,
} from "../src/game/model";

it("holds the painter windup through charge and releases without an idle flash", () => {
  const r = new Run(1),
    a = new HeroAnimation();
  a.reset(r.player);
  r.player.action = "charge";
  r.player.actionTime = 1;
  a.step(r.player, STEP);
  const held = { ...a.pose };
  r.player.action = "heavy";
  r.player.actionTime = 0;
  a.step(r.player, STEP);
  expect(a.pose).toEqual(held);
  r.player.actionTime = HERO_ATTACKS.heavy.contact;
  a.step(r.player, STEP);
  expect(a.pose.frame).toBe(spriteFrame("attack3", 0.245));
});

it("uses painter contact poses on the precise damage step", () => {
  for (const action of ["attack1", "attack2", "attack3"] as const) {
    const r = new Run(1),
      a = new HeroAnimation();
    a.reset(r.player);
    r.player.action = action;
    r.player.actionDuration = HERO_ATTACKS[action].duration;
    r.player.actionTime = HERO_ATTACKS[action].contact;
    a.step(r.player, STEP);
    expect(a.pose.frame).toBe(spriteFrame(action, 0.245));
  }
  for (const [action, expected] of [
    ["sweep", 6],
    ["slam", 10],
    ["spit", 13],
    ["charge", 14],
  ] as const) {
    const r = new Run(1);
    r.boss.action = action;
    r.boss.actionTime = BOSS_MOVES[action].windup;
    r.boss.actionDuration = 3;
    expect(bossFrame(r.boss)).toBe(expected);
  }
});
it("does not restart a pose clock on repeated renders or during hitstop", () => {
  const r = new Run(1),
    a = new HeroAnimation();
  r.start();
  a.reset(r.player);
  r.tick({ ...emptyInput(), attack: true });
  a.step(r.player, STEP);
  r.hitstop = 0.05;
  const pose = { ...a.pose };
  for (let i = 0; i < 3; i++) {
    const before = r.time;
    r.tick(emptyInput());
    if (r.time > before) a.step(r.player, STEP);
  }
  expect(a.pose).toEqual(pose);
});
it("roll interrupts heal immediately; death plays non-looping poses to completion", () => {
  const r = new Run(1),
    a = new HeroAnimation();
  r.start();
  r.player.hp = 50;
  r.tick({ ...emptyInput(), heal: true });
  a.step(r.player, STEP);
  expect(a.pose.texture).toBe("hero-support");
  r.tick({ ...emptyInput(), roll: true });
  a.step(r.player, STEP);
  expect(a.clip).toBe("roll");
  r.player.action = "death";
  r.player.actionDuration = 0.9;
  for (const [t, frame] of [
    [0, 8],
    [0.3, 9],
    [0.6, 10],
    [0.9, 11],
    [2, 11],
  ]) {
    r.player.actionTime = t;
    a.step(r.player, STEP);
    expect(a.pose.frame).toBe(frame);
  }
});
it("landing contact yields to a newly started attack rather than delaying input", () => {
  const r = new Run(1),
    a = new HeroAnimation();
  a.reset(r.player);
  r.player.grounded = false;
  r.player.vy = 200;
  r.player.action = "jump";
  a.step(r.player, STEP);
  r.player.grounded = true;
  r.player.action = "idle";
  a.step(r.player, STEP);
  expect(a.clip).toBe("land");
  r.player.action = "attack1";
  a.step(r.player, STEP);
  expect(a.clip).toBe("attack1");
  a.reset(new Run(1).player);
  expect(a.pose).toEqual({ texture: "hero", frame: 0 });
});
