import { describe, expect, it } from "vitest";
import {
  BOSS_MOVES,
  FLOOR,
  HERO_ATTACKS,
  Run,
  STEP,
  WORLD_WIDTH,
  emptyInput,
  type Input,
} from "../src/game/model";
import { bossBot } from "./boss-bot";

const tick = (r: Run, input: Partial<Input> = {}, frames = 1) => {
  for (let i = 0; i < frames; i++) r.tick({ ...emptyInput(), ...input });
};
const setup = () => {
  const r = new Run(42);
  r.start();
  return r;
};

it("can defeat both phases using only ordinary player inputs", () => {
  const r = setup();
  const moves = new Set<string>();
  for (let frame = 0; frame < 60 * 180 && r.phase === "playing"; frame++) {
    r.tick(bossBot(r, frame));
    moves.add(r.boss.action);
    r.events.length = 0;
  }
  expect({
    phase: r.phase,
    boss: r.boss.hp,
    hp: r.player.hp,
    time: r.time,
  }).toMatchObject({ phase: "won", boss: 0 });
  expect(moves.has("transition")).toBe(true);
  expect(moves.has("charge")).toBe(true);
});

describe("public arena contract", () => {
  it("exposes fixed arena, actors, and timing tables", () => {
    const r = new Run(7);
    expect([FLOOR, WORLD_WIDTH, STEP]).toEqual([354, 768, 1 / 60]);
    expect(r.player).toMatchObject({
      x: 180,
      y: FLOOR,
      hp: 100,
      action: "idle",
    });
    expect(r.boss).toMatchObject({
      x: 570,
      y: FLOOR,
      hp: 900,
      stage: 1,
      action: "idle",
    });
    expect(HERO_ATTACKS.attack3).toEqual({
      duration: 0.46,
      contact: 0.17,
      end: 0.3,
      damage: 42,
      range: 85,
    });
    expect(BOSS_MOVES.slam).toEqual({
      windup: 0.9,
      active: 0.2,
      recovery: 1.2,
      damage: 22,
      range: 90,
    });
  });
  it("freezes clocks but preserves buffered input and facing", () => {
    const r = setup();
    r.hitstop = 0.05;
    tick(r, { left: true, attack: true, roll: true }, 3);
    expect(r.time).toBe(0);
    expect(r.player.actionTime).toBe(0);
    tick(r, { left: true }, 2);
    expect(r.player.action).toBe("roll");
    expect(r.player.face).toBe(1);
  });
});

describe("hero actions", () => {
  it("taps heavy once, holds at full charge, and scales damage on release", () => {
    for (const [heldFrames, damage] of [
      [0, 48],
      [90, 96],
    ]) {
      const r = setup();
      r.boss.x = 230;
      r.boss.actionDuration = 99;
      tick(r, { heavy: true, heavyHeld: true });
      tick(r, { heavyHeld: true }, heldFrames);
      expect(r.player.action).toBe("charge");
      expect(r.boss.hp).toBe(900);
      expect(r.player.charge).toBeLessThanOrEqual(1);
      tick(r);
      expect(r.player.action).toBe("heavy");
      tick(r, {}, 12);
      expect(r.boss.hp).toBe(900 - damage);
      tick(r, {}, 60);
      expect(r.boss.hp).toBe(900 - damage);
    }
  });
  it("cancels charged attacks on roll, hurt, pause and pointer cancellation", () => {
    for (const reason of ["roll", "hurt", "pause", "cancel"] as const) {
      const r = setup();
      r.boss.x = 230;
      r.boss.actionDuration = 99;
      tick(r, { heavy: true, heavyHeld: true });
      tick(r, { heavyHeld: true }, 30);
      if (reason === "roll") tick(r, { roll: true, heavyHeld: true });
      if (reason === "hurt") r.hurt(10, 230);
      if (reason === "pause") {
        r.togglePause();
        r.togglePause();
      }
      if (reason === "cancel") tick(r, { cancelHeavy: true });
      tick(r, {}, 70);
      expect(r.player.charge).toBe(0);
      expect(r.boss.hp).toBe(900);
      expect(r.events.some((e) => e.type === "slash")).toBe(false);
    }
  });
  it("retains a quick heavy tap through hitstop without charging on frozen time", () => {
    const r = setup();
    r.hitstop = 0.05;
    tick(r, { heavy: true, heavyHeld: true });
    tick(r, {}, 4);
    expect(r.player.action).toBe("heavy");
    expect(r.player.charge).toBe(0);
  });
  it("chains three attacks in their final buffers and performs one air attack", () => {
    const r = setup();
    r.boss.x = 500;
    r.boss.actionDuration = 99;
    tick(r, { attack: true }, 10);
    tick(r, { attack: true }, 1);
    tick(r, {}, 11);
    expect(r.player.action).toBe("attack2");
    tick(r, { attack: true }, 12);
    tick(r, {}, 12);
    expect(r.player.action).toBe("attack3");
    while (r.player.action !== "idle") tick(r);
    tick(r, { jump: true, jumpHeld: true });
    tick(r, { attack: true, jumpHeld: true });
    expect(r.player.action).toBe("airAttack");
  });
  it("roll cancels offense and heal; heal spends only on completion", () => {
    const r = setup();
    r.player.hp = 40;
    tick(r, { heal: true });
    tick(r, {}, 20);
    expect(r.flasks).toBe(2);
    tick(r, { roll: true });
    expect(r.player.action).toBe("roll");
    tick(r, {}, 50);
    expect(r.player.hp).toBe(40);
    tick(r, { heal: true });
    tick(r, {}, 49);
    expect(r.player.hp).toBe(75);
    expect(r.flasks).toBe(1);
  });
  it("casts once at .18 seconds, has cooldown, and projectile contacts", () => {
    const r = setup();
    r.boss.x = 280;
    r.boss.actionDuration = 99;
    tick(r, { skill: true });
    tick(r, {}, 10);
    expect(r.projectiles).toHaveLength(0);
    tick(r);
    expect(r.projectiles).toHaveLength(1);
    tick(r, {}, 20);
    expect(r.boss.hp).toBe(840);
    tick(r, { skill: true });
    expect(r.player.action).not.toBe("cast");
  });
  it("supports variable jump, coyote time, and buffered landing", () => {
    const high = setup(),
      low = setup();
    tick(high, { jump: true, jumpHeld: true });
    tick(low, { jump: true, jumpHeld: true });
    tick(high, { jumpHeld: true }, 10);
    tick(low, {}, 10);
    expect(high.player.y).toBeLessThan(low.player.y);
    const r = setup();
    r.player.y = FLOOR - 2;
    r.player.grounded = false;
    r.player.vy = 100;
    tick(r, { jump: true, jumpHeld: true });
    tick(r, { jumpHeld: true });
    expect(r.player.vy).toBeLessThan(-400);
  });
});

describe("boss and combat lifecycle", () => {
  it("locks attack facing and transitions only after a committed move", () => {
    const r = setup();
    r.boss.x = 245;
    r.boss.actionDuration = 0;
    tick(r);
    expect(r.boss.action).toBe("sweep");
    const face = r.boss.face;
    r.boss.hp = 451;
    tick(r, { attack: true }, 8);
    r.player.x = 700;
    expect(r.boss.action).toBe("sweep");
    expect(r.boss.face).toBe(face);
    for (let i = 0; i < 150 && r.boss.action !== "transition"; i++) tick(r);
    expect(r.boss.action).toBe("transition");
    for (let i = 0; i < 70 && r.boss.stage === 1; i++) tick(r);
    expect(r.boss.stage).toBe(2);
  });
  it("shockwaves are jumpable, expire, and unique projectile ids are used", () => {
    const r = setup();
    r.boss.action = "slam";
    r.boss.actionTime = BOSS_MOVES.slam.windup - STEP;
    r.boss.actionDuration = 9;
    r.player.x = r.boss.x - 70;
    tick(r, { jump: true, jumpHeld: true });
    expect(r.projectiles.map((q) => q.id)).toEqual([
      ...new Set(r.projectiles.map((q) => q.id)),
    ]);
    const hp = r.player.hp;
    tick(r, { jumpHeld: true }, 100);
    expect(r.player.hp).toBe(hp);
    expect(r.projectiles.every((q) => q.life <= 1.5)).toBe(true);
  });
  it("post-hit protection prevents an unavoidable combo", () => {
    const r = setup();
    r.player.invulnerable = 0;
    r.hurt(14, r.boss.x);
    const hp = r.player.hp;
    r.hurt(22, r.boss.x);
    expect(r.player.hp).toBe(hp);
    tick(r, {}, 20);
    r.hurt(18, r.boss.x);
    expect(r.player.hp).toBe(hp);
  });
  it("gives death priority, clears combat, and delays terminal phase", () => {
    const lose = setup();
    lose.player.hp = 5;
    lose.player.invulnerable = 0;
    lose.hurt(12, 500);
    expect(lose.player.action).toBe("death");
    expect(lose.phase).toBe("playing");
    tick(lose, { heal: true }, 60);
    expect(lose.phase).toBe("dead");
    const win = setup();
    win.boss.hp = 1;
    win.boss.x = 230;
    tick(win, { attack: true }, 8);
    expect(win.boss.action).toBe("death");
    tick(win, {}, 60);
    expect(win.phase).toBe("won");
  });
});
