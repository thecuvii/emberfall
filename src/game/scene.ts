import Phaser from "phaser";
import { createBackdrop, createWorld } from "./art";
import { Run, STEP, FLOOR, BOSS_MOVES, type Input } from "./model";
import { HeroAnimation, bossFrame } from "./animation";
import { Sound } from "./audio";

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
};
type PainterEffect = {
  image: Phaser.GameObjects.Image;
  born: number;
  duration: number;
  frames: readonly number[];
};
export class Sanctuary extends Phaser.Scene {
  run = new Run(1);
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private hero!: Phaser.GameObjects.Image;
  private bossSprite!: Phaser.GameObjects.Image;
  private ink!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private heroAnimation = new HeroAnimation();
  private renderedRun?: Run;
  private renderedPhase = this.run.phase;
  private accumulator = 0;
  private previous = { x: 180, y: FLOOR, bossX: 570 };
  private sparks: Spark[] = [];
  private labels: { text: Phaser.GameObjects.Text; life: number }[] = [];
  private painterEffects: PainterEffect[] = [];
  private projectileImages = new Map<number, Phaser.GameObjects.Image>();
  private projectilePositions = new Map<
    number,
    { x: number; y: number; texture: string }
  >();
  private attachedEffect?: Phaser.GameObjects.Image;
  private bossSweep?: Phaser.GameObjects.Image;
  private shake = 0;
  constructor(
    public readInput: () => Input,
    public onUpdate: (run: Run) => void,
    public soundscape: Sound,
    public pollControls: () => void,
  ) {
    super("sanctuary");
  }
  preload() {
    this.load.spritesheet("hero", "/characters/hero.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("hero-support", "/characters/hero-support.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("boss", "/characters/boss.png", {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.spritesheet("combat-fx", "/effects/combat.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("boss-fx", "/effects/boss-combat.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
  }
  create() {
    this.textures.addCanvas("sky", createBackdrop());
    this.textures.addCanvas("world", createWorld(87, []));
    this.add.image(0, 0, "sky").setOrigin(0);
    this.add.image(0, 0, "world").setOrigin(0);
    this.ink = this.add.graphics();
    this.bossSprite = this.add
      .image(570, FLOOR, "boss")
      .setOrigin(0.5, 230 / 256);
    this.hero = this.add.image(180, FLOOR, "hero").setOrigin(0.5, 108 / 128);
    this.fx = this.add.graphics();
    this.resetPresentation();
  }
  restartRun() {
    this.run = new Run(1);
    this.run.start();
  }
  private resetPresentation() {
    this.renderedRun = this.run;
    this.accumulator = this.shake = 0;
    this.previous = {
      x: this.run.player.x,
      y: this.run.player.y,
      bossX: this.run.boss.x,
    };
    this.heroAnimation.reset(this.run.player);
    this.sparks = [];
    this.labels.forEach((l) => l.text.destroy());
    this.labels = [];
    this.painterEffects.forEach((e) => e.image.destroy());
    this.painterEffects = [];
    this.projectileImages.forEach((image) => image.destroy());
    this.projectileImages.clear();
    this.projectilePositions.clear();
    this.attachedEffect?.destroy();
    this.attachedEffect = undefined;
    this.bossSweep?.destroy();
    this.bossSweep = undefined;
  }
  private burst(
    x: number,
    y: number,
    frames: readonly number[],
    duration: number,
    scale = 1,
    flipX = false,
    texture = "combat-fx",
  ) {
    const image = this.add
      .image(x, y, texture, frames[0])
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(scale)
      .setFlipX(flipX);
    this.painterEffects.push({ image, born: this.run.time, duration, frames });
  }
  update(_time: number, delta: number) {
    if (!this.hero) return;
    this.pollControls();
    const replaced = this.renderedRun !== this.run;
    const transitioned = replaced || this.renderedPhase !== this.run.phase;
    if (replaced) this.resetPresentation();
    if (transitioned) {
      this.accumulator = 0;
      this.previous = {
        x: this.run.player.x,
        y: this.run.player.y,
        bossX: this.run.boss.x,
      };
      this.heroAnimation.step(this.run.player, 0);
    }
    const dt = Math.min(0.05, delta / 1000);
    const active = this.run.phase === "playing";
    if (active && !transitioned) this.accumulator += dt;
    let advanced = 0;
    while (active && this.accumulator >= STEP) {
      const p = this.run.player,
        b = this.run.boss;
      this.previous = { x: p.x, y: p.y, bossX: b.x };
      const before = this.run.time;
      this.run.tick(this.readInput());
      if (this.run.time > before) {
        advanced += STEP;
        this.heroAnimation.step(p, STEP);
        if (this.run.hitstop > 0)
          this.previous = { x: p.x, y: p.y, bossX: b.x };
      }
      this.accumulator -= STEP;
      if (this.run.phase !== "playing") {
        this.accumulator = 0;
        this.previous = { x: p.x, y: p.y, bossX: b.x };
        break;
      }
    }
    if (this.run.phase === "title")
      this.heroAnimation.step(this.run.player, dt);
    const p = this.run.player,
      b = this.run.boss;
    for (const e of this.run.events.splice(0)) {
      this.soundscape.play(e);
      const face = e.face ?? p.face;
      const power = e.power ?? 1;
      if (e.type === "slash")
        this.burst(
          e.x ?? p.x,
          e.y ?? p.y - 25,
          [1, 2, 3],
          0.22,
          0.72 + power * 0.13,
          face < 0,
        );
      else if (e.type === "hit" || e.type === "hurt")
        this.burst(
          e.x ?? 384,
          e.y ?? 300,
          [20, 21, 22, 23],
          0.18,
          e.type === "hurt" ? 0.65 : 0.78,
          false,
          e.type === "hurt" ? "boss-fx" : "combat-fx",
        );
      else if (e.type === "slam")
        this.burst(
          e.x ?? 384,
          FLOOR - 48,
          [12, 13, 14, 15],
          0.34,
          1.2,
          false,
          "boss-fx",
        );
      else if (e.type === "heal")
        this.burst(e.x ?? p.x, e.y ?? p.y - 25, [10, 11], 0.35, 0.75);
      const color = ["hurt", "slam", "phase"].includes(e.type)
        ? 0x9aabff
        : e.type === "heal"
          ? 0xe2c887
          : 0xffbc82;
      for (
        let i = 0;
        i < (e.type === "slam" ? 28 : e.type === "hit" ? 12 : 5);
        i++
      )
        this.sparks.push({
          x: e.x ?? 384,
          y: e.y ?? 320,
          vx: (Math.random() - 0.5) * 190,
          vy: -25 - Math.random() * 120,
          life: 0.35 + Math.random() * 0.25,
          color,
        });
      if (e.type === "hit" || e.type === "hurt") {
        const label = this.add.text(
          e.x ?? 384,
          (e.y ?? 300) - 20,
          `${e.amount}`,
          {
            fontFamily: "monospace",
            fontSize: "12px",
            color: e.type === "hurt" ? "#ff8b88" : "#ffe0ac",
            stroke: "#11151f",
            strokeThickness: 3,
          },
        );
        this.labels.push({ text: label, life: 0.6 });
      }
      if (
        !this.reducedMotion &&
        ["hit", "hurt", "slam", "phase"].includes(e.type)
      )
        this.shake = e.type === "slam" ? 3 : 1.5;
    }
    const alpha = this.accumulator / STEP;
    this.hero
      .setPosition(
        Math.round(this.previous.x + (p.x - this.previous.x) * alpha),
        Math.round(this.previous.y + (p.y - this.previous.y) * alpha),
      )
      .setFlipX(p.face < 0)
      .setTexture(
        this.heroAnimation.pose.texture,
        this.heroAnimation.pose.frame,
      );
    this.bossSprite
      .setPosition(
        Math.round(this.previous.bossX + (b.x - this.previous.bossX) * alpha),
        b.y,
      )
      .setFlipX(b.face > 0)
      .setFrame(bossFrame(b));
    this.hero.clearTint();
    this.bossSprite.clearTint();
    if (!this.reducedMotion && p.action === "hurt") this.hero.setTint(0xffaaaa);
    if (!this.reducedMotion && b.flash > 0.05)
      this.bossSprite.setTint(0xffc5ac);
    this.ink.clear();
    this.fx.clear();
    this.ink
      .fillStyle(0x0b101b, 0.5)
      .fillEllipse(p.x, FLOOR + 2, 30, 6)
      .fillEllipse(b.x, FLOOR + 3, 80, 10);
    if (b.action in BOSS_MOVES) {
      const move = BOSS_MOVES[b.action as keyof typeof BOSS_MOVES];
      if (b.actionTime < move.windup) {
        const progress = b.actionTime / move.windup;
        this.ink
          .fillStyle(0xce3d47, 0.12 + progress * 0.13)
          .fillRect(
            b.face < 0 ? b.x - move.range : b.x,
            FLOOR - 3,
            Math.min(move.range, 230),
            3,
          );
        this.fx
          .fillStyle(0xffb785, 0.4 + progress * 0.6)
          .fillRect(b.x - 2, FLOOR - 153, 4, 8);
      }
    }
    const heroX = this.hero.x,
      heroY = this.hero.y;
    const heroAction = p.action;
    const charge = p.charge;
    const attached =
      heroAction === "cast" || heroAction === "heal" || heroAction === "charge";
    if (attached && !this.attachedEffect)
      this.attachedEffect = this.add
        .image(heroX, heroY - 32, "combat-fx")
        .setBlendMode(Phaser.BlendModes.ADD);
    if (!attached) {
      this.attachedEffect?.destroy();
      this.attachedEffect = undefined;
    } else if (this.attachedEffect) {
      const progress =
        heroAction === "charge"
          ? charge
          : Math.min(1, p.actionTime / Math.max(0.01, p.actionDuration));
      const frame =
        heroAction === "heal"
          ? 8 + Math.min(3, Math.floor(progress * 4))
          : heroAction === "charge"
            ? 16 + Math.min(3, Math.floor(progress * 4))
            : 4 + Math.min(3, Math.floor(progress * 4));
      this.attachedEffect
        .setPosition(heroX, heroY - 32)
        .setFrame(frame)
        .setFlipX(p.face < 0)
        .setScale(heroAction === "charge" ? 0.45 + charge * 0.28 : 0.55)
        .setAlpha(this.reducedMotion ? 0.48 : 0.72 + progress * 0.2);
      if (heroAction === "charge") {
        this.fx
          .fillStyle(charge >= 0.99 ? 0xffe3a3 : 0xd76a45, 0.9)
          .fillRoundedRect(heroX - 18, heroY + 7, 36 * charge, 3, 1);
        this.fx
          .lineStyle(1, charge >= 0.99 ? 0xfff0bd : 0x6c3c35, 0.85)
          .strokeRoundedRect(heroX - 18, heroY + 7, 36, 3, 1);
      }
    }
    if (b.action === "sweep") {
      const move = BOSS_MOVES.sweep;
      if (
        b.actionTime >= move.windup &&
        b.actionTime < move.windup + move.active
      ) {
        const frame =
          1 +
          Math.min(
            2,
            Math.floor(((b.actionTime - move.windup) / move.active) * 3),
          );
        // The sweep is state-driven so its full slash coincides with the damaging active window.
        this.bossSweep ??= this.add
          .image(0, 0, "boss-fx")
          .setBlendMode(Phaser.BlendModes.ADD);
        this.bossSweep
          .setVisible(true)
          .setPosition(this.bossSprite.x + b.face * 46, FLOOR - 52)
          .setFrame(frame)
          .setFlipX(b.face < 0)
          .setScale(1.05)
          .setAlpha(this.reducedMotion ? 0.55 : 0.85);
      } else this.bossSweep?.setVisible(false);
    } else this.bossSweep?.setVisible(false);
    const liveIds = new Set(this.run.projectiles.map((q) => q.id));
    for (const [id, pos] of this.projectilePositions)
      if (!liveIds.has(id))
        this.burst(
          pos.x,
          pos.y,
          [20, 21, 22, 23],
          0.16,
          0.62,
          false,
          pos.texture,
        );
    for (const [id, image] of this.projectileImages)
      if (!liveIds.has(id)) {
        image.destroy();
        this.projectileImages.delete(id);
        this.projectilePositions.delete(id);
      }
    for (const q of this.run.projectiles) {
      let image = this.projectileImages.get(q.id);
      if (!image) {
        image = this.add
          .image(q.x, q.y, q.owner === "boss" ? "boss-fx" : "combat-fx")
          .setBlendMode(Phaser.BlendModes.ADD);
        this.projectileImages.set(q.id, image);
      }
      const frames =
        q.kind === "wave"
          ? [12, 13, 14, 15]
          : q.kind === "ember"
            ? [4, 5, 6, 7]
            : [16, 17, 18, 19];
      image
        .setPosition(q.x, q.kind === "wave" ? FLOOR - 24 : q.y)
        .setFrame(frames[Math.floor(this.run.time * 14) % 4])
        .setFlipX(q.vx < 0)
        .setScale(q.kind === "wave" ? 0.55 : q.kind === "ember" ? 0.62 : 0.58)
        .setAlpha(this.reducedMotion ? 0.62 : 0.9);
      this.projectilePositions.set(q.id, {
        x: q.x,
        y: q.kind === "wave" ? FLOOR - 24 : q.y,
        texture: image.texture.key,
      });
    }
    this.painterEffects = this.painterEffects.filter((effect) => {
      const progress = (this.run.time - effect.born) / effect.duration;
      effect.image
        .setFrame(
          effect.frames[
            Math.min(
              effect.frames.length - 1,
              Math.floor(progress * effect.frames.length),
            )
          ],
        )
        .setAlpha(
          (this.reducedMotion ? 0.58 : 0.92) * Math.min(1, (1 - progress) * 3),
        );
      if (progress >= 1) {
        effect.image.destroy();
        return false;
      }
      return true;
    });
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const s of this.sparks) {
      s.life -= advanced;
      s.x += s.vx * advanced;
      s.y += s.vy * advanced;
      s.vy += 230 * advanced;
      this.fx
        .fillStyle(s.color, Math.min(1, s.life * 4))
        .fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
    this.labels = this.labels.filter((l) => {
      l.life -= advanced;
      l.text.y -= advanced * 24;
      l.text.setAlpha(Math.min(1, l.life * 3));
      if (l.life <= 0) {
        l.text.destroy();
        return false;
      }
      return true;
    });
    this.shake *= Math.exp(-advanced * 25);
    this.cameras.main.setScroll(
      this.reducedMotion ? 0 : Math.sin(this.run.time * 110) * this.shake,
      0,
    );
    this.renderedPhase = this.run.phase;
    this.onUpdate(this.run);
  }
}
