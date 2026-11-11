import { describe, expect, it } from "vitest";
import { filterMuseum, globePoint, validCoordinates, eventRange } from "@/features/history/museum-domain";
import { historyUrl, readHistoryState } from "@/features/history/domain";
import { HISTORY_EVENTS } from "@/features/history/data";
import { LOCATIONS, EVENT_GEOGRAPHY } from "@/features/history/museum-data";

describe("museum geographic and temporal contracts", () => {
  it("rejects nonfinite/out-of-range markers and maps globe longitude consistently", () => {
    expect(validCoordinates(91, 0)).toBe(false);
    expect(validCoordinates(0, Infinity)).toBe(false);
    expect(validCoordinates(21, 105)).toBe(true);
    expect(globePoint(0, 0)).toEqual([1, 0, 0]);
    expect(globePoint(90, 0)[1]).toBeCloseTo(1);
  });
  it("includes the start of campaigns even when the timeline sort date is the end", () => {
    const event = HISTORY_EVENTS.find(e => e.id === "1954-dien-bien")!;
    expect(eventRange(event)).toEqual([1954, 1954]);
    expect(filterMuseum(HISTORY_EVENTS, { from: 1954, to: 1954 }).some(e => e.id === event.id)).toBe(true);
    expect(filterMuseum(HISTORY_EVENTS, { from: 1969, to: 1974 }).map(e => e.id)).toEqual(["1973-paris"]);
  });
  it("combines location/topic and validates URL range without accepting arbitrary return routes", () => {
    expect(filterMuseum(HISTORY_EVENTS, { locationId: "paris", topic: "ngoai-giao" }).map(e => e.id)).toEqual(["1973-paris"]);
    const state = readHistoryState(new URLSearchParams("from=1950&to=1975&place=paris&topic=ngoai-giao&event=1973-paris"));
    expect(historyUrl(state)).toContain("place=paris");
    expect(readHistoryState(new URLSearchParams("from=9999&to=no&place=<script>"))).not.toHaveProperty("from");
  });
  it("provides sourced valid geography for every existing event", () => {
    for (const event of HISTORY_EVENTS) {
      const geo = EVENT_GEOGRAPHY[event.id];
      expect(geo).toBeDefined();
      for (const id of geo.locationIds) {
        const place = LOCATIONS.find(l => l.id === id)!;
        expect(place).toBeDefined();
        expect(validCoordinates(place.latitude, place.longitude)).toBe(true);
        expect(place.sourceUrl.startsWith("https://")).toBe(true);
      }
    }
  });
});
