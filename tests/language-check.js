/* Real DOM localization and state preservation. Run on the dev page. */
(() => {
  const s = window.emberfall,
    select = document.getElementById("language");
  const passed = [],
    initial = select.value;
  const assert = (ok, label) => {
    if (!ok) throw Error(label);
    passed.push(label);
  };
  const change = (locale) => {
    select.value = locale;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const frame = () => s.update(0, 1000 / 60);
  s.game.loop.sleep();
  try {
    const canvas = s.game.canvas,
      start = document.getElementById("start");
    change("zh");
    change("en");
    assert(
      s.game.canvas === canvas &&
        (!start || document.getElementById("start") === start),
      "Language switch preserves canvas and start listener",
    );
    if (start) {
      start.click();
      frame();
      assert(s.run.phase === "playing", "Localized start button works");
    } else {
      s.restartRun();
      frame();
    }
    s.run.player.hp = 67;
    s.run.player.skillCooldown = 3;
    const run = s.run,
      time = run.time;
    change("zh");
    change("en");
    assert(
      s.run === run && run.player.hp === 67 && run.time === time,
      "Mid-fight switch preserves Run, health and time",
    );
    assert(
      document.documentElement.lang === "en" &&
        document.title.includes("Bell Executioner"),
      "Document language and title switch",
    );
    assert(
      document
        .querySelector(".intro-copy")
        .textContent.includes("Read the warning") &&
        document.querySelector(".boss-label strong").textContent ===
          "The Bell Executioner",
      "Page and boss name switch",
    );
    assert(
      document
        .getElementById("skill-status")
        .textContent.includes("Emberline 3.0s"),
      "Cooldown text localizes without resetting cooldown",
    );
    assert(
      document
        .getElementById("boss-health-track")
        .getAttribute("aria-valuetext")
        .includes("phase 1"),
      "Dynamic accessibility text is English",
    );
    assert(
      localStorage.getItem("emberfall-language") === "en",
      "Language preference is saved",
    );
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      ),
      untranslated = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        !node.parentElement?.closest("option,script") &&
        /[\u3400-\u9fff]/.test(node.textContent)
      )
        untranslated.push(node.textContent.trim());
    }
    assert(
      !untranslated.length,
      `English page has no untranslated text: ${untranslated.join("; ")}`,
    );
    document.getElementById("pause").click();
    frame();
    change("zh");
    change("en");
    assert(
      s.run.phase === "paused" &&
        document.getElementById("panel-heading").textContent ===
          "The ember still burns",
      "Pause dialog switches without resuming",
    );
    assert(
      document.getElementById("overlay").textContent.includes("Ctrl roll") &&
        document.getElementById("overlay").textContent.includes("RMB heavy"),
      "English help reflects current controls",
    );
    const resume = document.getElementById("resume");
    resume.focus();
    resume.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    assert(
      document.activeElement === select,
      "Language selector is keyboard reachable from the dialog",
    );
    document.getElementById("resume").click();
    frame();
    assert(
      s.run.phase === "playing" && document.activeElement.id === "game",
      "Translated resume keeps keyboard gameplay working",
    );
    s.run.phase = "dead";
    frame();
    assert(
      document.getElementById("panel-heading").textContent ===
        "Fallen. Not finished.",
      "Death dialog is English",
    );
    change("zh");
    assert(
      document.getElementById("panel-heading").textContent.includes("陨落"),
      "Death dialog switches back to Chinese",
    );
    s.run.phase = "won";
    frame();
    change("en");
    assert(
      document.getElementById("panel-heading").textContent ===
        "The bell falls silent." &&
        document
          .getElementById("announcement")
          .textContent.startsWith("Victory!"),
      "Victory and live announcement localize",
    );
    document.getElementById("retry").click();
    frame();
    assert(
      s.run !== run && s.run.player.hp === 100,
      "Translated retry starts a fresh fight",
    );
    return {
      result: `${passed.length} localization assertions passed`,
      passed,
    };
  } finally {
    change(initial);
    s.game.loop.wake();
  }
})();
