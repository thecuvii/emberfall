/* Dev-only Phaser + DOM regression fixtures; run with agent-browser eval --stdin. */
(() => {
  const s = window.emberfall,
    game = document.getElementById("game"),
    passed = [];
  if (!s?.textures.exists("boss")) throw Error("Wait for atlases");
  const language = document.getElementById("language"),
    originalLanguage = language.value;
  language.value = "zh";
  language.dispatchEvent(new Event("change", { bubbles: true }));
  const assert = (ok, label) => {
    if (!ok) throw Error(label);
    passed.push(label);
  };
  const key = (code, down = true) =>
    game.dispatchEvent(
      new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }),
    );
  const frame = (ms = 1000 / 60) => s.update(0, ms);
  const frames = (n) => {
    for (let i = 0; i < n; i++) frame();
  };
  const mouse = (type, button, target = game) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        button,
        pointerType: "mouse",
        bubbles: true,
        cancelable: true,
      }),
    );
  const reset = () => {
    s.restartRun();
    frame();
    game.focus();
  };
  const pads = navigator.getGamepads;
  let pressed = [];
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => [
      {
        connected: true,
        mapping: "standard",
        axes: [0, 0],
        buttons: Array.from({ length: 17 }, (_, i) => ({
          pressed: pressed.includes(i),
        })),
      },
    ],
  });
  s.game.loop.sleep();
  try {
    reset();
    key("KeyD");
    frames(2);
    mouse("pointerdown", 0);
    frame();
    mouse("pointerup", 0);
    assert(s.run.player.action === "attack1", "Left mouse starts light attack");
    frames(35);
    assert(s.run.player.x > 220, "Mouse click preserves held movement");
    key("KeyD", false);
    reset();
    s.run.boss.actionDuration = 99;
    mouse("pointerdown", 2);
    frames(75);
    assert(
      s.run.player.action === "charge" &&
        s.run.player.charge === 1 &&
        !!s.attachedEffect,
      "Right mouse holds full charge with painter effect",
    );
    mouse("pointerup", 2, document.body);
    frame();
    assert(
      s.run.player.action === "heavy" && !s.attachedEffect,
      "Release outside canvas unleashes heavy and clears charge effect",
    );
    frames(12);
    assert(
      s.painterEffects.some((e) => e.image.texture.key === "combat-fx"),
      "Heavy contact plays painter slash",
    );
    reset();
    mouse("pointerdown", 2);
    frames(20);
    mouse("pointercancel", 2);
    frame();
    assert(
      s.run.player.action !== "heavy" &&
        s.run.player.action !== "charge" &&
        !s.attachedEffect,
      "Pointer cancellation never fires charged attack",
    );
    reset();
    mouse("pointerdown", 2);
    frames(20);
    window.dispatchEvent(new Event("blur"));
    frame();
    assert(
      s.run.phase === "paused" && s.run.player.charge === 0,
      "Window blur cancels charge and pauses",
    );
    document.getElementById("resume").click();
    frame();
    frames(2);
    assert(
      s.run.player.action !== "heavy",
      "Resume does not discharge lost mouse hold",
    );
    const menu = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    game.dispatchEvent(menu);
    assert(menu.defaultPrevented, "Canvas suppresses right-click context menu");
    reset();
    key("Space");
    frames(8);
    key("Space", false);
    assert(!s.run.player.grounded && s.run.player.y < 320, "Space still jumps");
    reset();
    key("KeyD");
    frames(15);
    key("KeyD", false);
    assert(s.run.player.x > 190, "DOM movement");
    key("KeyJ");
    frame();
    key("KeyJ", false);
    assert(s.run.player.action === "attack1", "DOM attack");
    key("ControlLeft");
    frame();
    key("ControlLeft", false);
    assert(
      s.run.player.action === "roll",
      "Left Ctrl cancels attack into roll",
    );
    reset();
    key("KeyQ");
    frame();
    key("KeyQ", false);
    frames(12);
    assert(
      s.run.player.skillCooldown > 5 && s.hero.texture.key === "hero-support",
      "Q uses painter cast and cooldown",
    );
    assert(
      [...document.querySelectorAll('[data-ability="skill"]')].every(
        (slot) =>
          Number(slot.style.getPropertyValue("--remaining")) > 0.8 &&
          slot.getAttribute("aria-label").includes("冷却") &&
          Number(slot.querySelector(".ability-value").textContent) > 5,
      ),
      "HUD and touch icons show the actual skill cooldown",
    );
    reset();
    s.run.player.hp = 40;
    key("KeyF");
    frame();
    key("KeyF", false);
    frames(20);
    assert(
      s.run.player.hp === 40 && s.run.player.action === "heal",
      "Healing is delayed",
    );
    key("ControlRight");
    frame();
    key("ControlRight", false);
    assert(
      s.run.player.action === "roll" && s.run.player.hp === 40,
      "Right Ctrl interrupts healing into roll",
    );
    reset();
    s.run.player.hp = 40;
    key("KeyF");
    frame();
    key("KeyF", false);
    frames(49);
    assert(
      s.run.player.hp === 75 && s.run.flasks === 1,
      "Completed heal restores 35 and spends one flask",
    );
    assert(
      [
        ...document.querySelectorAll('[data-ability="heal"] .ability-value'),
      ].every((node) => node.textContent === "×1"),
      "Both flask icons show remaining charge",
    );
    s.run.flasks = 0;
    frame();
    assert(
      [...document.querySelectorAll('[data-ability="heal"]')].every(
        (slot) =>
          slot.classList.contains("is-spent") &&
          slot.getAttribute("aria-label").includes("0 瓶"),
      ),
      "Empty flasks are visibly exhausted and described accessibly",
    );
    document.getElementById("pause").click();
    frame();
    const frozen = [s.run.time, s.hero.frame.name, s.bossSprite.frame.name];
    frames(60);
    assert(
      JSON.stringify(frozen) ===
        JSON.stringify([
          s.run.time,
          s.hero.frame.name,
          s.bossSprite.frame.name,
        ]),
      "Pause freezes both animation clocks",
    );
    assert(document.activeElement.id === "resume", "Pause dialog focus");
    document.getElementById("resume").click();
    frame();
    assert(document.activeElement.id === "game", "Resume focus");
    reset();
    s.run.player.x = 520;
    s.run.boss.x = 570;
    key("KeyJ");
    frame();
    key("KeyJ", false);
    for (let i = 0; i < 20 && !s.run.hitstop; i++) frame();
    assert(
      s.run.hitstop > 0 && s.run.boss.hp < 900,
      "Sword contact causes damage and hitstop",
    );
    const contact = [s.hero.x, s.bossSprite.x, s.hero.frame.name, s.run.time];
    frame(1000 / 144);
    assert(
      JSON.stringify(contact) ===
        JSON.stringify([
          s.hero.x,
          s.bossSprite.x,
          s.hero.frame.name,
          s.run.time,
        ]),
      "144Hz hitstop has no position or pose drift",
    );
    s.run.boss.stage = 2;
    frame();
    assert(
      document
        .getElementById("boss-health-track")
        .getAttribute("aria-valuenow") === String(s.run.boss.hp),
      "Boss health ARIA matches model",
    );
    s.run.phase = "dead";
    frame();
    assert(!!document.getElementById("retry"), "Death offers retry");
    const old = s.run;
    let ticks = 0;
    const tick = old.tick;
    old.tick = function (...args) {
      ticks++;
      return tick.apply(this, args);
    };
    pressed = [0];
    frame(25);
    assert(
      s.run !== old && ticks === 0 && s.accumulator === 0 && s.hero.x === 180,
      "Gamepad restart never ticks old Run or interpolates old position",
    );
    pressed = [];
    frame();
    assert(s.run.player.grounded, "Menu A is not replayed as jump");
    assert(
      [...document.querySelectorAll('[data-ability="heal"]')].every(
        (slot) =>
          !slot.classList.contains("is-spent") &&
          slot.querySelector(".ability-value").textContent === "×2",
      ),
      "Restart restores skill icon resources",
    );
    // Palette ownership persists from projectile flight into its impact burst.
    s.run.projectiles = [
      {
        id: 9001,
        x: 300,
        y: 310,
        vx: 0,
        vy: 0,
        radius: 9,
        damage: 0,
        owner: "hero",
        kind: "ember",
        life: 1,
      },
      {
        id: 9002,
        x: 450,
        y: 290,
        vx: 0,
        vy: 0,
        radius: 8,
        damage: 0,
        owner: "boss",
        kind: "fire",
        life: 1,
      },
    ];
    frame();
    assert(
      s.projectileImages.get(9001).texture.key === "combat-fx" &&
        s.projectileImages.get(9002).texture.key === "boss-fx",
      "Enemy and hero projectiles use distinct palettes",
    );
    s.run.projectiles = s.run.projectiles.filter((q) => q.owner === "hero");
    frame();
    assert(
      s.painterEffects.some((e) => e.image.texture.key === "boss-fx"),
      "Boss projectile impact retains the cold palette",
    );
    s.run.boss.action = "sweep";
    s.run.boss.actionTime = 0.7;
    s.run.boss.actionDuration = 1.7;
    frame();
    assert(
      s.bossSweep.texture.key === "boss-fx",
      "Boss sweep uses cold palette",
    );
    s.run.phase = "won";
    frame();
    assert(
      document.getElementById("panel-heading").textContent.includes("钟"),
      "Victory renders boss ending",
    );
    return { result: `${passed.length} browser assertions passed`, passed };
  } finally {
    language.value = originalLanguage;
    language.dispatchEvent(new Event("change", { bubbles: true }));
    mouse("pointerup", 0);
    mouse("pointerup", 2);
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: pads,
    });
    for (const code of [
      "KeyA",
      "KeyD",
      "KeyJ",
      "KeyK",
      "ControlLeft",
      "ControlRight",
      "KeyQ",
      "KeyF",
      "Space",
    ])
      key(code, false);
    s.game.loop.wake();
  }
})();
