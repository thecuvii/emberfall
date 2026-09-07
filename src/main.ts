import Phaser from "phaser";
import "./styles.css";
import { Sanctuary } from "./game/scene";
import { Sound } from "./game/audio";
import { emptyInput, type Run, type Phase } from "./game/model";
import { initLocalization, t, type Message } from "./i18n";

const localization = initLocalization();

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const gameElement = el("game"),
  overlay = el("overlay");
const abilitySlots = [
  ...document.querySelectorAll<HTMLElement>("[data-ability]"),
];
const sound = new Sound();
const keys = new Set<string>(),
  edges = new Set<string>(),
  mouse = new Set<string>(),
  mouseEdges = new Set<string>(),
  touch = new Set<string>(),
  touchEdges = new Set<string>(),
  padHeld = new Set<string>(),
  padEdges = new Set<string>();
const keyMap: Record<string, string> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "jump",
  KeyW: "jump",
  ArrowUp: "jump",
  KeyJ: "attack",
  KeyL: "heavy",
  KeyK: "roll",
  ControlLeft: "roll",
  ControlRight: "roll",
  ShiftLeft: "roll",
  ShiftRight: "roll",
  KeyF: "heal",
  KeyQ: "skill",
};
// Physical codes preserve WASD on non-Latin layouts; virtual keyboards may supply only key.
const keyCode = (event: KeyboardEvent) =>
  event.code ||
  (/^[a-z]$/i.test(event.key)
    ? `Key${event.key.toUpperCase()}`
    : /^[1-3]$/.test(event.key)
      ? `Digit${event.key}`
      : event.key === " "
        ? "Space"
        : event.key === "Shift"
          ? "ShiftLeft"
          : event.key === "Control"
            ? "ControlLeft"
            : event.key);
let lastPhase: Phase = "title",
  lastPad: boolean[] = [];
const formatTime = (time: number) =>
  `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(time % 60)
    .toString()
    .padStart(2, "0")}`;
const text = (id: string, value: string) => {
  if (el(id).textContent !== value) el(id).textContent = value;
};
function clearInput() {
  keys.clear();
  edges.clear();
  mouse.clear();
  mouseEdges.clear();
  touch.clear();
  touchEdges.clear();
  padHeld.clear();
  padEdges.clear();
}
function focusGame() {
  clearInput();
  gameElement.focus({ preventScroll: true });
}
function start() {
  if (!scene.sys.isActive() || !scene.textures.exists("boss")) return;
  scene.restartRun();
  focusGame();
}
function pause() {
  scene.run.togglePause();
  clearInput();
  if (scene.run.phase === "playing") focusGame();
}
function readInput() {
  const input = emptyInput();
  const held = (action: string) =>
    [...keys].some((k) => keyMap[k] === action) ||
    mouse.has(action) ||
    touch.has(action) ||
    padHeld.has(action);
  const tapped = (action: string) =>
    [...edges].some((k) => keyMap[k] === action) ||
    mouseEdges.has(action) ||
    touchEdges.has(action) ||
    padEdges.has(action);
  input.left = held("left");
  input.right = held("right");
  input.jumpHeld = held("jump");
  input.jump = tapped("jump");
  input.attack = tapped("attack");
  input.heavy = tapped("heavy");
  input.heavyHeld = held("heavy");
  input.cancelHeavy = tapped("cancelHeavy");
  input.roll = tapped("roll");
  input.heal = tapped("heal");
  input.skill = tapped("skill");
  edges.clear();
  mouseEdges.clear();
  touchEdges.clear();
  padEdges.clear();
  return input;
}

// Menu transitions are polled at a frame boundary, never while a Run is stepping.
function pollControls() {
  padHeld.clear();
  const pad = navigator
    .getGamepads?.()
    .find((p) => p?.connected && p.mapping === "standard");
  if (pad) {
    const buttons = pad.buttons.map((b) => b.pressed);
    const hit = (n: number) => !!buttons[n] && !lastPad[n];
    const phase = scene.run.phase;
    if (phase === "title" || phase === "dead" || phase === "won") {
      if (hit(0)) start();
    } else if (hit(9)) pause();
    else if (phase === "playing") {
      if (pad.axes[0] < -0.25 || buttons[14]) padHeld.add("left");
      if (pad.axes[0] > 0.25 || buttons[15]) padHeld.add("right");
      if (buttons[0]) padHeld.add("jump");
      if (buttons[7]) padHeld.add("heavy");
      for (const [action, indices] of Object.entries({
        jump: [0],
        attack: [2],
        heavy: [7],
        roll: [1, 5],
        heal: [3],
        skill: [4],
      })) {
        if (indices.some(hit)) padEdges.add(action);
      }
    }
    lastPad = buttons;
  } else {
    lastPad = [];
    padEdges.clear();
  }
}

function updateUI(run: Run, force = false) {
  const startButton = document.getElementById(
    "start",
  ) as HTMLButtonElement | null;
  if (startButton) startButton.disabled = !scene.textures.exists("boss");
  text("health-text", `${Math.ceil(run.player.hp)} / ${run.player.maxHp}`);
  const width = `${(run.player.hp / run.player.maxHp) * 100}%`;
  if (el("health-fill").style.width !== width)
    el("health-fill").style.width = width;
  text("flask-label", t("F · 余烬药剂 × {n}", { n: run.flasks }));
  const cooldown = Math.max(0, run.player.skillCooldown);
  text(
    "skill-status",
    cooldown <= 0
      ? t("Q · 烬线就绪")
      : t("Q · 烬线 {n}s", { n: cooldown.toFixed(1) }),
  );
  for (const slot of abilitySlots) {
    const action = slot.dataset.ability;
    const remaining =
      action === "skill"
        ? cooldown
        : action === "roll"
          ? Math.max(0, run.player.rollCooldown)
          : 0;
    const spent = action === "heal" && run.flasks === 0;
    const active =
      action === "attack"
        ? run.player.action.startsWith("attack") ||
          ["airAttack", "charge", "heavy"].includes(run.player.action)
        : run.player.action === (action === "skill" ? "cast" : action);
    const name = t(
      action === "attack"
        ? "鼠标左键轻攻击，右键重攻击，按住右键蓄力"
        : action === "roll"
          ? "Ctrl 灰步，翻滚"
          : action === "skill"
            ? "Q 烬线"
            : "F 回火，治疗",
    );
    const value =
      action === "heal"
        ? `×${run.flasks}`
        : remaining > 0
          ? remaining.toFixed(1)
          : "";
    const label = `${name} · ${action === "heal" ? t("剩余 {n} 瓶", { n: run.flasks }) : remaining > 0 ? t("冷却 {n} 秒", { n: remaining.toFixed(1) }) : t("就绪")}`;
    slot.style.setProperty(
      "--remaining",
      String(Math.min(1, remaining / (action === "skill" ? 6 : 0.72))),
    );
    slot.classList.toggle("is-spent", spent);
    slot.classList.toggle("is-active", active);
    if (slot.getAttribute("aria-label") !== label)
      slot.setAttribute("aria-label", label);
    const counter = slot.querySelector(".ability-value")!;
    if (counter.textContent !== value) counter.textContent = value;
  }
  text("timer", formatTime(run.time));
  text(
    "chapter",
    run.phase === "title"
      ? t("等待挑战")
      : t("阶段 {n} / 2", { n: run.boss.stage }),
  );
  const bossPercent = Math.max(0, (run.boss.hp / run.boss.maxHp) * 100);
  el("boss-health-fill").style.width = `${bossPercent}%`;
  text("boss-health-text", `${Math.ceil(run.boss.hp)} / ${run.boss.maxHp}`);
  const bossProgress = el<HTMLDivElement>("boss-health-track");
  bossProgress.setAttribute("aria-valuenow", String(Math.ceil(run.boss.hp)));
  bossProgress.setAttribute("aria-valuemax", String(run.boss.maxHp));
  bossProgress.setAttribute(
    "aria-valuetext",
    t("丧钟执刑者，阶段 {n}，生命 {hp} / {max}", {
      n: run.boss.stage,
      hp: Math.ceil(run.boss.hp),
      max: run.boss.maxHp,
    }),
  );
  const attackNames: Record<string, Message> = {
    idle: "审视",
    walk: "逼近",
    sweep: "横扫",
    slam: "震地",
    spit: "喷焰",
    charge: "冲锋",
    transition: "狂化",
    death: "倒下",
  };
  text(
    "objective",
    run.time < 7
      ? t("左键轻击 · 右键重击（长按蓄力）· 空格跳跃")
      : t("阶段 {n} · {action}", {
          n: run.boss.stage,
          action: t(attackNames[run.boss.action] ?? "蓄势"),
        }),
  );
  if (lastPhase === run.phase && !force) return;
  lastPhase = run.phase;
  clearInput();
  const playing = run.phase === "playing";
  overlay.hidden = playing;
  el("hud").hidden = run.phase === "title";
  el("boss-hud").hidden = run.phase === "title";
  el("objective").hidden = !playing;
  el<HTMLButtonElement>("pause").disabled = !["playing", "paused"].includes(
    run.phase,
  );
  el("pause").textContent = run.phase === "paused" ? "▷" : "Ⅱ";
  el("pause").setAttribute(
    "aria-label",
    t(run.phase === "paused" ? "继续游戏" : "暂停游戏"),
  );
  if (run.phase === "title") return;
  if (playing) {
    overlay.removeAttribute("role");
    overlay.removeAttribute("aria-modal");
    return;
  }
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "panel-heading");
  let html = "";
  if (run.phase === "paused")
    html = `<div class="panel"><p class="eyebrow">TAKE A BREATH</p><h2 id="panel-heading">${t("余火尚温")}</h2><p>${t("看清红光预兆，再决定出手。")}</p><p>${t("操作详情")}</p><div class="panel-actions"><button class="primary-button" id="resume">${t("继续战斗 →")}</button></div></div>`;
  if (run.phase === "dead" || run.phase === "won") {
    html = `<div class="panel"><p class="eyebrow">${run.phase === "won" ? "THE BELL FALLS SILENT" : "ASH IS NOT THE END"}</p><h2 id="panel-heading">${t(run.phase === "won" ? "丧钟已寂。" : "陨落，而非终结。")}</h2><p>${t(run.phase === "won" ? "执刑者倒下，余火仍在燃烧。" : "记住这次预兆。下一次，穿过它。")}</p><p>${t("战斗时长 {time}　·　首领剩余生命 {hp} / {max}", { time: formatTime(run.time), hp: Math.ceil(run.boss.hp), max: run.boss.maxHp })}</p><div class="panel-actions"><button class="primary-button" id="retry">${t("重新挑战")} <span>→</span></button></div></div>`;
    el("announcement").textContent =
      run.phase === "won"
        ? t("胜利！丧钟执刑者已被击败。")
        : t("你已陨落，可以立即重新挑战。");
  }
  overlay.innerHTML = html;
  el("resume")?.addEventListener("click", pause);
  el("retry")?.addEventListener("click", start);
  overlay
    .querySelector<HTMLButtonElement>("button")
    ?.focus({ preventScroll: true });
}

const scene = new Sanctuary(readInput, updateUI, sound, pollControls);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 768,
  height: 432,
  backgroundColor: "#153438",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  banner: false,
  audio: { noAudio: true },
  fps: { target: 60, smoothStep: true },
  scene: [scene],
  input: { keyboard: false },
  render: { preserveDrawingBuffer: true },
});
el("start").addEventListener("click", start);
el("pause").addEventListener("click", pause);
const languageSelect = el<HTMLSelectElement>("language");
languageSelect.value = localization.locale;
languageSelect.addEventListener("change", () => {
  localization.change(languageSelect.value === "zh" ? "zh" : "en");
  scene.run.cancelCharge();
  el("announcement").textContent = "";
  updateUI(scene.run, true);
  updateToolbar();
  if (scene.run.phase === "playing") focusGame();
  else languageSelect.focus({ preventScroll: true });
});
function updateToolbar() {
  el("sound").setAttribute(
    "aria-label",
    t(sound.enabled ? "关闭声音" : "开启声音"),
  );
  el("sound").innerHTML =
    `♪ <span>${t(sound.enabled ? "声音开启" : "声音关闭")}</span>`;
  el("fullscreen").setAttribute(
    "aria-label",
    t(document.fullscreenElement ? "退出全屏" : "全屏游戏"),
  );
}
gameElement.addEventListener("contextmenu", (event) => event.preventDefault());
gameElement.addEventListener("pointerdown", (event) => {
  if (scene.run.phase !== "playing") return;
  gameElement.focus({ preventScroll: true });
  if (event.pointerType !== "mouse" || ![0, 2].includes(event.button)) return;
  event.preventDefault();
  const action = event.button === 0 ? "attack" : "heavy";
  if (!mouse.has(action)) mouseEdges.add(action);
  mouse.add(action);
});
// Listen outside the canvas too: releasing over the toolbar must not stick charge.
window.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse")
    mouse.delete(event.button === 2 ? "heavy" : "attack");
});
window.addEventListener("pointercancel", (event) => {
  if (event.pointerType !== "mouse") return;
  mouse.clear();
  mouseEdges.clear();
  mouseEdges.add("cancelHeavy");
});
el("sound").addEventListener("click", async () => {
  try {
    await sound.toggle();
    el("sound").setAttribute("aria-pressed", String(sound.enabled));
    updateToolbar();
    if (scene.run.phase === "playing") focusGame();
  } catch {
    el("announcement").textContent = t(
      "此浏览器暂时无法开启声音，游戏仍可继续。",
    );
  }
});
el("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector(".game-shell")!.requestFullscreen();
  } catch {
    el("announcement").textContent = t("此浏览器不支持全屏，请使用横屏游玩。");
  }
});
document.addEventListener("fullscreenchange", updateToolbar);
document.addEventListener("keydown", (event) => {
  const code = keyCode(event);
  if (code === "Escape" && !event.repeat) {
    if (document.activeElement === languageSelect) return;
    pause();
    return;
  }
  if (!overlay.hidden && event.key === "Tab") {
    const buttons = [
      languageSelect,
      ...overlay.querySelectorAll<HTMLButtonElement>("button"),
    ];
    if (
      buttons.length &&
      ((event.shiftKey && document.activeElement === buttons[0]) ||
        (!event.shiftKey && document.activeElement === buttons.at(-1)))
    ) {
      event.preventDefault();
      (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
    }
  }
  if (
    document.activeElement !== gameElement ||
    scene.run.phase !== "playing" ||
    !keyMap[code]
  )
    return;
  event.preventDefault();
  if (!keys.has(code)) edges.add(code);
  keys.add(code);
});
document.addEventListener("keyup", (event) => keys.delete(keyCode(event)));
function pauseOnLeave() {
  clearInput();
  if (scene.run.phase === "playing") scene.run.togglePause();
}
window.addEventListener("blur", pauseOnLeave);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseOnLeave();
});
document
  .querySelectorAll<HTMLButtonElement>("[data-control]")
  .forEach((button) => {
    const action = button.dataset.control!;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (scene.run.phase !== "playing") return;
      button.setPointerCapture(event.pointerId);
      touch.add(action);
      touchEdges.add(action);
    });
    button.addEventListener("pointerup", () => touch.delete(action));
    for (const name of ["pointercancel", "lostpointercapture"])
      button.addEventListener(name, () => {
        if (action === "heavy" && touch.has(action))
          touchEdges.add("cancelHeavy");
        touch.delete(action);
      });
  });
// Development-only state inspection for repeatable browser regression fixtures.
if (import.meta.env.DEV) Object.assign(window, { emberfall: scene });
