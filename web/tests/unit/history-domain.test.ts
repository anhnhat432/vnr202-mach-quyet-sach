import { describe, expect, it } from "vitest";
import { filterHistory, normalizeSearch, readHistoryState } from "@/features/history/domain";

const events = [
  { id: "a", date: "1911-06-05", period: "before-1930", title: "Nguyễn Tất Thành ra đi", summary: "Bến Nhà Rồng", people: ["Nguyễn Tất Thành"], location: "Sài Gòn", keywords: ["cứu nước"] },
  { id: "b", date: "1954-05-07", period: "1945-1954", title: "Chiến thắng Điện Biên Phủ", summary: "Chiến dịch", people: ["Võ Nguyên Giáp"], location: "Điện Biên", keywords: ["kháng chiến"] },
];

describe("history exploration contracts", () => {
  it("matches Vietnamese with or without accents, including đ and combined accents", () => {
    expect(normalizeSearch("  ĐIỆN Biên  ")).toBe("dien bien");
    expect(filterHistory(events, "all", "Vo Nguyen Giap").map(e => e.id)).toEqual(["b"]);
    expect(filterHistory(events, "all", "Điện Biên").map(e => e.id)).toEqual(["b"]);
    expect(filterHistory(events, "all", "1954").map(e => e.id)).toEqual(["b"]);
    expect(filterHistory(events, "all", "ben nha rong").map(e => e.id)).toEqual(["a"]);
  });
  it("combines filters, preserves chronological order and supports empty results", () => {
    expect(filterHistory([...events].reverse(), "all", "").map(e => e.id)).toEqual(["a", "b"]);
    expect(filterHistory(events, "before-1930", "1954")).toEqual([]);
    expect(filterHistory(events, "all", "không có")).toEqual([]);
  });
  it("validates URL state and ignores unrecognized periods", () => {
    expect(readHistoryState(new URLSearchParams("period=bad&q=abc&event=a"))).toEqual({ period: "all", query: "abc", eventId: "a" });
    expect(readHistoryState(new URLSearchParams("period=1945-1954"))).toEqual({ period: "1945-1954", query: "", eventId: null });
  });
});
