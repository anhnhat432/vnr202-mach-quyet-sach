import { describe, expect, it } from "vitest";

import { getPlannedDossiers, getPublishedDossierBySlug, listPublishedDossiers } from "@/features/content/server/local-content";

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

  it("excludes all draft dossiers from public listing and slug lookup", async () => {
    const planned = getPlannedDossiers();
    const published = await listPublishedDossiers();
    const publishedSlugs = new Set(published.map((d) => d.slug));

    // Verify draft dossiers are not in published list
    const draftDossiers = planned.filter((d) => d.status === "draft");
    expect(draftDossiers.length).toBeGreaterThan(0);

    for (const draft of draftDossiers) {
      expect(publishedSlugs.has(draft.slug)).toBe(false);
    }

    // Verify getPublishedDossierBySlug returns null for all draft dossiers
    for (const draft of draftDossiers) {
      const result = await getPublishedDossierBySlug(draft.slug);
      expect(result).toBeNull();
    }
  });
});
