import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("allows same-site paths", () => {
    expect(safeNext("/trades?sort=pnl")).toBe("/trades?sort=pnl");
  });
  it("blocks open redirects", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/\tevil", null, ""]) {
      expect(safeNext(bad)).toBe("/dashboard");
    }
  });
});
