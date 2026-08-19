import { describe, expect, it } from "vitest";

import { getPlannedDossiers, listPublishedDossiers } from "@/features/content/server/local-content";

describe("phase one content catalogue", () => {
  it("contains exactly 15 planned dossiers split five per chapter", () => {
    const planned = getPlannedDossiers();
    expect(planned).toHaveLength(15);
    expect(Object.groupBy(planned, (item) => item.chapter)).toMatchObject({
      chapter_1: expect.arrayContaining([expect.any(Object)]),
      chapter_2: expect.arrayContaining([expect.any(Object)]),
      chapter_3: expect.arrayContaining([expect.any(Object)]),
    });
    expect(planned.filter((item) => item.chapter === "chapter_1")).toHaveLength(5);
    expect(planned.filter((item) => item.chapter === "chapter_2")).toHaveLength(5);
    expect(planned.filter((item) => item.chapter === "chapter_3")).toHaveLength(5);
  });

  it("publishes one complete dossier per chapter", async () => {
    const published = await listPublishedDossiers();
    expect(published).toHaveLength(3);
    expect(published.map((item) => item.chapter)).toEqual(["chapter_1", "chapter_2", "chapter_3"]);
  });
});
