import { describe, expect, it } from "vitest";
import { cellSign, closeOpenFence, parseBlock } from "./coach-blocks";

describe("parseBlock", () => {
  it("parses a chart", () => {
    const b = parseBlock("chart", '{"type":"bar","title":"By session","unit":"money","data":[{"label":"London","value":120.5},{"label":"NY","value":"-80"}]}');
    expect(b).toMatchObject({ kind: "chart", type: "bar", data: [{ label: "London", value: 120.5 }, { label: "NY", value: -80 }] });
  });
  it("tolerates trailing commas and prose", () => {
    const b = parseBlock("cards", 'here: {"items":[{"label":"Win rate","value":"54%","tone":"profit",},],}');
    expect(b).toMatchObject({ kind: "cards", items: [{ label: "Win rate", value: "54%", tone: "profit" }] });
  });
  it("unknown tone falls back", () => {
    const b = parseBlock("callout", '{"tone":"purple","text":"Hi"}');
    expect(b).toMatchObject({ kind: "callout", tone: "info", text: "Hi" });
  });
  it("pads/trims table rows to the column count", () => {
    const b = parseBlock("table", '{"columns":["A","B"],"rows":[["1"],["1","2","3"],[4,null]]}');
    expect(b?.kind === "table" && b.rows).toEqual([["1", ""], ["1", "2"], ["4", ""]]);
  });
  it("pie with negatives becomes bars", () => {
    const b = parseBlock("chart", '{"type":"pie","data":[{"label":"a","value":-1},{"label":"b","value":2}]}');
    expect(b?.kind === "chart" && b.type).toBe("bar");
  });
  it("rejects other languages and bad JSON", () => {
    expect(parseBlock("ts", "{}")).toBeNull();
    expect(parseBlock("chart", "{nope")).toBeNull();
    expect(parseBlock("chart", '{"data":[]}')).toBeNull();
  });
});

describe("cellSign", () => {
  it.each([
    ["-$35.20", -1],
    ["−12", -1],
    ["$-4.00", -1],
    ["(40)", -1],
    ["+$12", 1],
    ["$12.50", 1],
    ["1.5R", 1],
    ["[+$5](/trades/x)", 1],
    ["0.00", 0],
    ["$0.00", 0],
    ["Revenge", 0],
  ])("%s → %d", (t, s) => expect(cellSign(t)).toBe(s));
});

it("closes an unterminated fence", () => {
  expect(closeOpenFence("a\n```chart\n{")).toBe("a\n```chart\n{\n```");
  expect(closeOpenFence("a\n```x\n```")).toBe("a\n```x\n```");
});
