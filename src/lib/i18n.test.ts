import { expect, it } from "vitest";
import { BN, translate } from "./i18n";

it("translates by English text, fills params, falls back to English", () => {
  expect(translate("en", "Dashboard")).toBe("Dashboard");
  expect(translate("bn", "Dashboard")).toBe("ড্যাশবোর্ড");
  expect(translate("bn", "{n} trades · {d} days", { n: 5, d: 2 })).toBe("5 ট্রেড · 2 দিন");
  expect(translate("bn", "Not translated yet")).toBe("Not translated yet");
});

it("every Bangla string keeps the English placeholders", () => {
  for (const [en, bn] of Object.entries(BN)) {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    expect(ph(bn), en).toBe(ph(en));
  }
});
