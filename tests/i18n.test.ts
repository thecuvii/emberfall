import { expect, it } from "vitest";
import { messages, resolveLocale, t } from "../src/i18n";

it("prefers a saved supported language, then browser languages, then English", () => {
  expect(resolveLocale("zh", ["en-US"])).toBe("zh");
  expect(resolveLocale("en", ["zh-CN"])).toBe("en");
  expect(resolveLocale(null, ["zh-TW", "en"])).toBe("zh");
  expect(resolveLocale("invalid", ["fr", "en-GB"])).toBe("en");
  expect(resolveLocale(null, ["fr", "zh-HK"])).toBe("zh");
  expect(resolveLocale(null, [])).toBe("en");
});
it("preserves dynamic placeholders in every English message", () => {
  const fields = (s: string) =>
    [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [key, translated] of Object.entries(messages)) {
    expect(translated.trim().length).toBeGreaterThan(0);
    expect(fields(translated), key).toEqual(fields(key));
  }
  expect(t("阶段 {n} / 2", { n: 2 })).toBe("阶段 2 / 2");
});
