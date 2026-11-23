import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { proxyPath, signWsToken, wsUrlFor } from "./ws-token";

describe("signWsToken", () => {
  it("signs a payload the SMC server can verify", () => {
    const token = signWsToken("user-1", "secret-abc", 1000, 60);
    const [payload, sig] = token.split(".");
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({ sub: "user-1", exp: 1060 });
    expect(sig).toBe(createHmac("sha256", "secret-abc").update(payload).digest("base64url"));
  });

  it("refuses to sign without a secret", () => {
    expect(() => signWsToken("user-1", "")).toThrow(/SMC_WS_SECRET/);
  });
});

describe("wsUrlFor", () => {
  it("switches to ws(s) and adds the token", () => {
    expect(wsUrlFor("https://desk.example.com/", "a.b")).toBe("wss://desk.example.com/ws?token=a.b");
    expect(wsUrlFor("http://localhost:4000", "a.b")).toBe("ws://localhost:4000/ws?token=a.b");
  });
});

describe("proxyPath", () => {
  it("allows only /api/... paths", () => {
    expect(proxyPath(["api", "scanner"])).toBe("/api/scanner");
    expect(proxyPath(["api", "journal", "abc-1"])).toBe("/api/journal/abc-1");
    expect(proxyPath(["ws"])).toBeNull();
    expect(proxyPath(["api"])).toBeNull();
  });

  it("refuses traversal and odd characters", () => {
    expect(proxyPath(["api", ".."])).toBeNull();
    expect(proxyPath(["api", "a%2F.."])).toBeNull();
    expect(proxyPath(["api", "a b"])).toBeNull();
  });
});
