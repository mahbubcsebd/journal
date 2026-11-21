import { describe, expect, it } from "vitest";
import { blockedMessage, blockedStatus, isSuperAdmin } from "./admin";

describe("super admins", () => {
  it("matches listed emails, case-insensitively", () => {
    expect(isSuperAdmin("Boss@Example.com", " boss@example.com , other@x.io")).toBe(true);
    expect(isSuperAdmin("user@example.com", "boss@example.com")).toBe(false);
    expect(isSuperAdmin("boss@example.com", "")).toBe(false);
    expect(isSuperAdmin(null, "boss@example.com")).toBe(false);
  });
});

describe("account status", () => {
  const now = Date.parse("2026-11-21T10:00:00Z");
  it("banned and open-ended pauses block; expired pauses don't", () => {
    expect(blockedStatus({ status: "banned" }, now)).toBe("banned");
    expect(blockedStatus({ status: "paused", statusUntil: null }, now)).toBe("paused");
    expect(blockedStatus({ status: "paused", statusUntil: new Date(now + 1000) }, now)).toBe("paused");
    expect(blockedStatus({ status: "paused", statusUntil: new Date(now - 1000) }, now)).toBeNull();
    expect(blockedStatus({ status: "active" }, now)).toBeNull();
  });
  it("explains why", () => {
    expect(blockedMessage({ status: "banned", statusReason: "Spam" }, now)).toBe("This account has been banned. Reason: Spam");
    expect(blockedMessage({ status: "paused", statusUntil: new Date("2026-11-28T00:00:00Z") }, now)).toBe("This account is paused until 2026-11-28 00:00 UTC.");
    expect(blockedMessage({ status: "active" }, now)).toBeNull();
  });
});
