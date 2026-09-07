import { BOSS_MOVES, emptyInput, type Run } from "../src/game/model";

/** Verification driver: observes public state and sends legal input only. */
export function bossBot(r: Run, frame: number) {
  const input = emptyInput(),
    p = r.player,
    b = r.boss;
  const dx = b.x - p.x,
    distance = Math.abs(dx);
  const move =
    b.action in BOSS_MOVES
      ? BOSS_MOVES[b.action as keyof typeof BOSS_MOVES]
      : undefined;
  const danger =
    move &&
    b.action !== "spit" &&
    b.actionTime > move.windup - 0.18 &&
    b.actionTime < move.windup + move.active &&
    (p.x - b.x) * b.face > -15;
  const safeRecovery =
    move &&
    b.actionTime > move.windup + move.active &&
    b.actionDuration - b.actionTime > 0.85;
  input.right = distance > 52 && dx > 0;
  input.left = distance > 52 && dx < 0;
  if (danger && distance < 130 && p.rollCooldown <= 0) input.roll = true;
  if (safeRecovery && p.hp <= 65 && r.flasks > 0) input.heal = true;
  if (distance < 190 && p.skillCooldown <= 0 && frame % 10 === 0)
    input.skill = true;
  input.attack = distance < 80 && !danger && frame % 17 === 0;
  const wave = r.projectiles.some(
    (q) => q.owner === "boss" && Math.abs(q.x - p.x) < 85 && q.y > p.y - 40,
  );
  input.jump = wave && p.grounded;
  input.jumpHeld = wave || !p.grounded;
  return input;
}
