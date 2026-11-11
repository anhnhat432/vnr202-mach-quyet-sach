import { describe, expect, it } from "vitest";
import { HISTORY_EVENTS } from "@/features/history/data";
import { TEXTBOOK, TEXTBOOK_REFERENCES } from "@/features/history/textbook";

describe("user-supplied textbook scan references", () => {
  it("identifies the supplied 2021 edition and covers exactly the twenty timeline events", () => {
    expect(TEXTBOOK.isbn).toBe("978-604-57-6590-6");
    expect(TEXTBOOK.pageCount).toBe(440);
    expect(Object.keys(TEXTBOOK_REFERENCES).sort()).toEqual(HISTORY_EVENTS.map(event => event.id).sort());
    for (const reference of Object.values(TEXTBOOK_REFERENCES)) {
      expect(reference.pages.length).toBeGreaterThan(0);
      expect(reference.pages.every(page => Number.isInteger(page) && page > 0 && page <= 440)).toBe(true);
      expect(reference.pdfPages).toEqual(reference.pages);
      expect(reference.scope.length).toBeGreaterThan(20);
    }
  });
  it("preserves the WTO effective date and explicitly records the different textbook date", () => {
    expect(HISTORY_EVENTS.find(event => event.id === "2007-wto")?.date).toBe("2007-01-11");
    expect(TEXTBOOK_REFERENCES["2007-wto"].note).toContain("11/2006");
    expect(TEXTBOOK_REFERENCES["2007-wto"].note).toContain("11/01/2007");
  });
});
