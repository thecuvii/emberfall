export const FLOOR = 354;
export const WORLD_WIDTH = 768;
export const STEP = 1 / 60;

export type Input = {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpHeld: boolean;
  attack: boolean;
  heavy: boolean;
  heavyHeld: boolean;
  cancelHeavy: boolean;
  roll: boolean;
  heal: boolean;
  skill: boolean;
};
export const emptyInput = (): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  attack: false,
  heavy: false,
  heavyHeld: false,
  cancelHeavy: false,
  roll: false,
  heal: false,
  skill: false,
});

export type Phase = "title" | "playing" | "paused" | "dead" | "won";
export type HeroAction =
  | "idle"
  | "run"
  | "jump"
  | "attack1"
  | "attack2"
  | "attack3"
  | "airAttack"
  | "charge"
  | "heavy"
  | "roll"
  | "cast"
  | "heal"
  | "hurt"
  | "death";
export type BossAction =
  | "idle"
  | "walk"
  | "sweep"
  | "slam"
  | "spit"
  | "charge"
  | "transition"
  | "death";
export type GameEvent = {
  type:
    | "slash"
    | "hit"
    | "hurt"
    | "kill"
    | "jump"
    | "roll"
    | "heal"
    | "cast"
    | "slam"
    | "phase";
  x?: number;
  y?: number;
  amount?: number;
  face?: number;
  power?: number;
};
export type Projectile = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  owner: "hero" | "boss";
  kind: "ember" | "wave" | "fire";
  life: number;
};

export const HERO_ATTACKS = {
  attack1: { duration: 0.3, contact: 0.09, end: 0.2, damage: 22, range: 70 },
  attack2: { duration: 0.34, contact: 0.12, end: 0.23, damage: 26, range: 75 },
  attack3: { duration: 0.46, contact: 0.17, end: 0.3, damage: 42, range: 85 },
  airAttack: { duration: 0.38, contact: 0.1, end: 0.25, damage: 30, range: 75 },
  heavy: { duration: 0.6, contact: 0.17, end: 0.32, damage: 48, range: 95 },
} as const;
export const BOSS_MOVES = {
  sweep: { windup: 0.7, active: 0.2, recovery: 0.8, damage: 14, range: 112 },
  slam: { windup: 0.9, active: 0.2, recovery: 1.2, damage: 22, range: 90 },
  spit: { windup: 1, active: 0.25, recovery: 0.85, damage: 12, range: 500 },
  charge: { windup: 0.8, active: 0.5, recovery: 1, damage: 18, range: 180 },
} as const;

type AttackAction = keyof typeof HERO_ATTACKS;
const isAttack = (a: HeroAction): a is AttackAction => a in HERO_ATTACKS;
const bossDuration = (a: keyof typeof BOSS_MOVES) => {
  const m = BOSS_MOVES[a];
  return m.windup + m.active + m.recovery;
};

export class Run {
  phase: Phase = "title";
  readonly seed: number;
  time = 0;
  hitstop = 0;
  flasks = 2;
  events: GameEvent[] = [];
  projectiles: Projectile[] = [];
  player = {
    x: 180,
    y: FLOOR,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    face: 1,
    grounded: true,
    action: "idle" as HeroAction,
    actionTime: 0,
    actionDuration: 0,
    charge: 0,
    rollCooldown: 0,
    skillCooldown: 0,
    invulnerable: 0,
  };
  boss = {
    x: 570,
    y: FLOOR,
    hp: 900,
    maxHp: 900,
    face: -1,
    action: "idle" as BossAction,
    actionTime: 0,
    actionDuration: 0.9,
    stage: 1 as 1 | 2,
    flash: 0,
  };
  private coyote = 0.1;
  private jumpBuffer = 0;
  private attackBuffer = 0;
  private pending = {
    roll: false,
    heal: false,
    skill: false,
    heavy: false,
    cancelHeavy: false,
  };
  private attackHit = false;
  private castFired = false;
  private bossHit = false;
  private bossMove = 0;
  private bossTargetX = 0;
  private bossTargetY = FLOOR;
  private transitionPending = false;
  private projectileId = 1;
  private endTimer = 0;

  constructor(seed: number) {
    this.seed = seed;
  }
  start() {
    if (this.phase === "title") this.phase = "playing";
  }
  togglePause() {
    if (this.phase === "playing") {
      this.cancelCharge();
      this.phase = "paused";
    } else if (this.phase === "paused") this.phase = "playing";
  }

  cancelCharge() {
    this.pending.heavy = false;
    if (this.player.action === "charge")
      this.heroAction(this.player.grounded ? "idle" : "jump");
  }

  private heroAction(action: HeroAction, duration = 0) {
    const p = this.player;
    p.action = action;
    p.actionTime = 0;
    p.actionDuration = duration;
    if (action !== "heavy") p.charge = 0;
    this.attackHit = false;
    if (action === "cast") this.castFired = false;
  }
  private bossAction(action: BossAction, duration: number) {
    const b = this.boss;
    b.action = action;
    b.actionTime = 0;
    b.actionDuration = duration;
    this.bossHit = false;
    if (
      action !== "idle" &&
      action !== "walk" &&
      action !== "transition" &&
      action !== "death"
    ) {
      b.face = this.player.x < b.x ? -1 : 1;
      this.bossTargetX = this.player.x;
      this.bossTargetY = this.player.y - 24;
    }
  }
  hurt(amount: number, from: number) {
    const p = this.player;
    if (
      this.phase !== "playing" ||
      p.invulnerable > 0 ||
      p.action === "death" ||
      this.boss.hp <= 0
    )
      return;
    p.hp = Math.max(0, p.hp - amount);
    p.invulnerable = 0.85;
    p.vx = (p.x >= from ? 1 : -1) * 145;
    this.events.push({ type: "hurt", x: p.x, y: p.y - 24, amount });
    this.hitstop = 0.065;
    this.heroAction(p.hp ? "hurt" : "death", p.hp ? 0.18 : 0.9);
    if (!p.hp) {
      this.projectiles = [];
      this.endTimer = 0.9;
    }
  }
  private damageBoss(amount: number) {
    const b = this.boss;
    if (b.hp <= 0 || this.player.hp <= 0 || b.action === "transition") return;
    b.hp = Math.max(0, b.hp - amount);
    b.flash = 0.1;
    this.hitstop = 0.05;
    this.events.push({ type: "hit", x: b.x, y: b.y - 40, amount });
    if (!b.hp) {
      this.events.push({ type: "kill", x: b.x, y: b.y - 30 });
      this.bossAction("death", 0.9);
      this.projectiles = [];
      this.endTimer = 0.9;
    } else if (b.hp < b.maxHp / 2) this.transitionPending = true;
  }
  private chooseBossMove() {
    if (this.transitionPending && this.boss.stage === 1) {
      this.transitionPending = false;
      this.bossAction("transition", 0.9);
      return;
    }
    const stage2 = this.boss.stage === 2;
    const rotation: BossAction[] = stage2
      ? ["sweep", "slam", "spit", "charge", "sweep", "slam"]
      : ["sweep", "spit", "slam"];
    const action = rotation[
      this.bossMove++ % rotation.length
    ] as keyof typeof BOSS_MOVES;
    this.bossAction(action, bossDuration(action));
  }
  private updateBoss(dt: number) {
    const b = this.boss,
      p = this.player;
    b.flash = Math.max(0, b.flash - dt);
    b.actionTime += dt;
    if (b.action === "death") return;
    if (b.action === "transition") {
      if (b.actionTime >= b.actionDuration) {
        b.stage = 2;
        this.events.push({ type: "phase", x: b.x, y: b.y });
        this.bossAction("idle", 0.75);
      }
      return;
    }
    if (b.action === "idle" || b.action === "walk") {
      const dx = p.x - b.x;
      if (Math.abs(dx) > 145) {
        b.action = "walk";
        b.face = dx < 0 ? -1 : 1;
        b.x += b.face * 65 * dt;
      } else b.action = "idle";
      if (b.actionTime >= b.actionDuration) this.chooseBossMove();
      return;
    }
    const move = BOSS_MOVES[b.action as keyof typeof BOSS_MOVES];
    const active =
      b.actionTime >= move.windup && b.actionTime < move.windup + move.active;
    if (b.action === "charge" && active)
      b.x += b.face * 330 * (b.stage === 2 ? 1.08 : 1) * dt;
    if (
      b.action === "charge" &&
      active &&
      Math.abs(p.x - b.x) < 55 &&
      Math.abs(p.y - b.y) < 48
    )
      this.hurt(move.damage, b.x);
    if (active && !this.bossHit) {
      this.bossHit = true;
      if (b.action === "slam") {
        this.events.push({ type: "slam", x: b.x, y: b.y });
        for (const dir of [-1, 1])
          this.projectiles.push({
            id: this.projectileId++,
            x: b.x,
            y: FLOOR - 8,
            vx: dir * 145,
            vy: 0,
            radius: 10,
            damage: move.damage,
            owner: "boss",
            kind: "wave",
            life: 1.5,
          });
      } else if (b.action === "spit") {
        const dx = this.bossTargetX - b.x,
          dy = this.bossTargetY - (b.y - 55);
        const angle = Math.atan2(dy, dx);
        for (const fan of [-0.18, 0, 0.18])
          this.projectiles.push({
            id: this.projectileId++,
            x: b.x + b.face * 25,
            y: b.y - 55,
            vx: Math.cos(angle + fan) * 150,
            vy: Math.sin(angle + fan) * 150,
            radius: 8,
            damage: move.damage,
            owner: "boss",
            kind: "fire",
            life: 3,
          });
      } else if (
        b.action !== "charge" &&
        (p.x - b.x) * b.face >= -12 &&
        Math.abs(p.x - b.x) <= move.range &&
        Math.abs(p.y - b.y) < 45
      )
        this.hurt(move.damage, b.x);
    }
    if (b.actionTime >= b.actionDuration)
      this.bossAction("idle", b.stage === 2 ? 0.68 : 0.75);
    b.x = Math.max(64, Math.min(704, b.x));
  }
  private updateProjectiles(dt: number) {
    for (const q of this.projectiles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (
        q.owner === "hero" &&
        this.boss.hp > 0 &&
        Math.hypot(q.x - this.boss.x, q.y - (this.boss.y - 35)) < q.radius + 30
      ) {
        q.life = 0;
        this.damageBoss(q.damage);
      } else if (
        q.owner === "boss" &&
        this.player.hp > 0 &&
        Math.hypot(q.x - this.player.x, q.y - (this.player.y - 22)) <
          q.radius + 18
      ) {
        q.life = 0;
        this.hurt(q.damage, q.x);
      }
    }
    this.projectiles = this.projectiles.filter(
      (q) =>
        q.life > 0 && q.x > -30 && q.x < WORLD_WIDTH + 30 && q.y < FLOOR + 30,
    );
  }
  tick(input: Input, dt = STEP) {
    if (this.phase !== "playing") return;
    if (input.jump) this.jumpBuffer = 0.13;
    if (input.attack) this.attackBuffer = 0.15;
    this.pending.roll ||= input.roll;
    this.pending.heal ||= input.heal;
    this.pending.skill ||= input.skill;
    this.pending.heavy ||= input.heavy;
    this.pending.cancelHeavy ||= input.cancelHeavy;
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }
    if (this.endTimer > 0) {
      this.time += dt;
      this.endTimer -= dt;
      this.player.actionTime += dt;
      this.boss.actionTime += dt;
      if (this.endTimer <= 0) this.phase = this.player.hp <= 0 ? "dead" : "won";
      return;
    }
    const actions = this.pending;
    this.pending = {
      roll: false,
      heal: false,
      skill: false,
      heavy: false,
      cancelHeavy: false,
    };
    const p = this.player;
    this.time += dt;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.rollCooldown = Math.max(0, p.rollCooldown - dt);
    p.skillCooldown = Math.max(0, p.skillCooldown - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.coyote = p.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    p.actionTime += dt;

    if (actions.cancelHeavy) this.cancelCharge();
    if (actions.roll && p.rollCooldown <= 0 && p.action !== "death") {
      this.heroAction("roll", 0.32);
      p.rollCooldown = 0.72;
      p.invulnerable = Math.max(p.invulnerable, 0.2);
      p.vx = p.face * 285;
      this.attackBuffer = 0;
      this.events.push({ type: "roll", x: p.x, y: p.y });
    } else if (
      actions.heal &&
      p.hp < p.maxHp &&
      this.flasks > 0 &&
      ["idle", "run"].includes(p.action)
    ) {
      this.heroAction("heal", 0.8);
      p.vx = 0;
    } else if (
      actions.skill &&
      p.skillCooldown <= 0 &&
      ["idle", "run"].includes(p.action)
    ) {
      this.heroAction("cast", 0.42);
      p.skillCooldown = 6;
      p.vx = 0;
    } else if (
      actions.heavy &&
      !actions.cancelHeavy &&
      ["idle", "run", "jump"].includes(p.action)
    ) {
      this.heroAction("charge", 1);
      this.attackBuffer = 0;
      p.vx = 0;
    }

    if (p.action === "charge") {
      // A normal click stays an uncharged heavy; one second reaches full power.
      p.charge = Math.min(1, Math.max(0, p.actionTime - 0.18) / 0.82);
      this.attackBuffer = 0;
      if (!input.heavyHeld)
        this.heroAction("heavy", HERO_ATTACKS.heavy.duration);
    }

    if (p.action === "heal" && p.actionTime >= p.actionDuration) {
      p.hp = Math.min(p.maxHp, p.hp + 35);
      this.flasks--;
      this.events.push({ type: "heal", x: p.x, y: p.y - 25, amount: 35 });
      this.heroAction("idle");
    } else if (p.action === "cast" && !this.castFired && p.actionTime >= 0.18) {
      this.castFired = true;
      this.projectiles.push({
        id: this.projectileId++,
        x: p.x + p.face * 24,
        y: p.y - 28,
        vx: p.face * 310,
        vy: 0,
        radius: 9,
        damage: 60,
        owner: "hero",
        kind: "ember",
        life: 0.55,
      });
      this.events.push({ type: "cast", x: p.x, y: p.y - 28 });
    }

    if (isAttack(p.action)) {
      const attack = HERO_ATTACKS[p.action];
      if (!this.attackHit && p.actionTime >= attack.contact) {
        this.attackHit = true;
        this.events.push({
          type: "slash",
          x: p.x + p.face * 35,
          y: p.y - 25,
          face: p.face,
          power: p.action === "heavy" ? 1 + p.charge : 1,
        });
        const dx = this.boss.x - p.x;
        if (
          Math.sign(dx || p.face) === p.face &&
          Math.abs(dx) <= attack.range &&
          Math.abs(p.y - this.boss.y) < 60
        )
          this.damageBoss(
            Math.round(
              attack.damage * (p.action === "heavy" ? 1 + p.charge : 1),
            ),
          );
      }
      if (
        p.actionTime >= attack.duration - 0.15 &&
        this.attackBuffer > 0 &&
        (p.action === "attack1" || p.action === "attack2")
      ) {
        const next = p.action === "attack1" ? "attack2" : "attack3";
        this.attackBuffer = 0;
        this.heroAction(next, HERO_ATTACKS[next].duration);
      } else if (p.actionTime >= p.actionDuration)
        this.heroAction(p.grounded ? "idle" : "jump");
    } else if (
      ["roll", "cast", "hurt"].includes(p.action) &&
      p.actionTime >= p.actionDuration
    )
      this.heroAction(p.grounded ? "idle" : "jump");

    if (
      this.attackBuffer > 0 &&
      !isAttack(p.action) &&
      ["idle", "run", "jump"].includes(p.action)
    ) {
      this.attackBuffer = 0;
      const a: AttackAction = p.grounded ? "attack1" : "airAttack";
      this.heroAction(a, HERO_ATTACKS[a].duration);
    }
    const axis = Number(input.right) - Number(input.left);
    const movable = ["idle", "run", "jump"].includes(p.action);
    if (axis && movable) {
      p.face = axis;
      p.vx = axis * 185;
    } else if (movable) p.vx *= 0.72;
    else if (isAttack(p.action)) p.vx *= 0.65;
    else if (p.action === "hurt") p.vx *= 0.88;
    if (this.jumpBuffer > 0 && this.coyote > 0 && movable) {
      p.vy = -455;
      p.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.heroAction("jump");
      this.events.push({ type: "jump", x: p.x, y: p.y });
    }
    if (!input.jumpHeld && p.vy < -170) p.vy = -170;
    if (!p.grounded) p.vy += 1250 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(32, Math.min(736, p.x));
    if (p.y >= FLOOR) {
      p.y = FLOOR;
      p.vy = 0;
      p.grounded = true;
      if (p.action === "jump") this.heroAction("idle");
    } else p.grounded = false;
    if (["idle", "run"].includes(p.action))
      p.action = Math.abs(p.vx) > 15 ? "run" : "idle";

    this.updateBoss(dt);
    this.updateProjectiles(dt);
  }
}
