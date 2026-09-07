/* Real-time normal-input boss fight, no altered stats. agent-browser eval --stdin. */
(async () => {
  const { bossBot } = await import("/tests/boss-bot.ts");
  const s = window.emberfall,
    game = document.getElementById("game");
  s.restartRun();
  s.game.loop.wake();
  game.focus();
  const held = new Set(),
    hero = new Set(),
    boss = new Set(),
    chunks = [];
  const codes = {
    left: "KeyA",
    right: "KeyD",
    roll: "KeyK",
    skill: "KeyQ",
    heal: "KeyF",
    jumpHeld: "Space",
  };
  const mouse = (down, button) =>
    game.dispatchEvent(
      new PointerEvent(down ? "pointerdown" : "pointerup", {
        button,
        pointerType: "mouse",
        bubbles: true,
      }),
    );
  const input = (value) => {
    const attack = !!value.attack;
    if (attack !== held.has("mouse0")) {
      mouse(attack, 0);
      if (attack) held.add("mouse0");
      else held.delete("mouse0");
    }
    for (const [name, code] of Object.entries(codes)) {
      const down = !!value[name];
      if (down === held.has(code)) continue;
      game.dispatchEvent(
        new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }),
      );
      if (down) held.add(code);
      else held.delete(code);
    }
  };
  const stream = s.game.canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp8",
    videoBitsPerSecond: 4000000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.start();
  const start = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 100));
  mouse(true, 2);
  await new Promise((resolve) => setTimeout(resolve, 1150));
  hero.add(s.run.player.action);
  mouse(false, 2);
  await new Promise((resolve) => setTimeout(resolve, 200));
  hero.add(s.run.player.action);
  let frame = 0;
  await new Promise((resolve) => {
    const drive = () => {
      hero.add(s.run.player.action);
      boss.add(s.run.boss.action);
      if (
        performance.now() - start > 120000 ||
        ["won", "dead"].includes(s.run.phase)
      )
        return resolve();
      const next = bossBot(s.run, frame++);
      next.jumpHeld ||= next.jump;
      input(next);
      requestAnimationFrame(drive);
    };
    requestAnimationFrame(drive);
  });
  input({});
  await new Promise((resolve) => setTimeout(resolve, 1000));
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  document.getElementById("animation-recording")?.remove();
  const a = document.createElement("a");
  a.id = "animation-recording";
  a.href = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
  a.download = "emberfall-boss.webm";
  document.body.append(a);
  return {
    phase: s.run.phase,
    hp: s.run.player.hp,
    bossHP: s.run.boss.hp,
    seconds: (performance.now() - start) / 1000,
    hero: [...hero],
    boss: [...boss],
  };
})();
