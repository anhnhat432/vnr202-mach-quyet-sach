import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const sources = JSON.parse(fs.readFileSync(path.join(root, "docs/sdd/content/sources.json"), "utf8")).sources;

describe("Chapter 1 authoring sources", () => {
  it("registers every course session used by the four drafts", () => {
    const ids = new Set(sources.map((source: { id: string }) => source.id));
    for (const session of [3, 5, 6, 7, 8, 9, 10]) {
      expect(ids.has(`10000000-0000-0000-0000-${String(session).padStart(12, "0")}`)).toBe(true);
    }
  });

  it("gives every Chapter 1 source a rights note and verified status", () => {
    const chapterSources = sources.filter((source: { id: string }) =>
      /00000000000(3|5|6|7|8|9)$|000000000010$/.test(source.id),
    );
    expect(chapterSources.every((source: { rightsNote: string }) => source.rightsNote.length >= 5)).toBe(true);
    expect(
      chapterSources.every(
        (source: { verificationStatus: string }) => source.verificationStatus === "verified",
      ),
    ).toBe(true);
  });
});

describe("Chapter 1 Draft dossiers", () => {
  it("authors dossier 01 as a complete hidden Draft", () => {
    const dossier = JSON.parse(
      fs.readFileSync(path.join(root, "docs/sdd/content/dossiers/01-con-duong-nao-cho-doc-lap.json"), "utf8"),
    );
    expect(dossier.status).toBe("draft");
    expect(dossier.experience.evidence).toHaveLength(6);
    expect(dossier.experience.decision.options).toHaveLength(3);
    expect(dossier.claims).toHaveLength(6);
    expect(dossier.causalNodes).toHaveLength(6);
    expect(dossier.review.reviewedBy).toBeUndefined();
  });

  it("authors dossier 03 as a complete hidden Draft", () => {
    const dossier = JSON.parse(
      fs.readFileSync(path.join(root, "docs/sdd/content/dossiers/03-giu-mach-phong-trao.json"), "utf8"),
    );
    expect(dossier.status).toBe("draft");
    expect(dossier.experience.evidence).toHaveLength(6);
    expect(dossier.experience.decision.options).toHaveLength(3);
    expect(dossier.claims.map((claim: { category: string }) => claim.category)).toEqual([
      "context",
      "basis",
      "implementation",
      "result",
      "limitation",
      "lesson",
    ]);
  });

  it("authors dossier 04 with open and semi-open struggle choices", () => {
    const dossier = JSON.parse(
      fs.readFileSync(
        path.join(root, "docs/sdd/content/dossiers/04-linh-hoat-trong-mot-cua-so-dan-chu.json"),
        "utf8",
      ),
    );
    expect(dossier.status).toBe("draft");
    expect(dossier.experience.evidence).toHaveLength(6);
    expect(dossier.experience.decision.options).toHaveLength(3);
    expect(dossier.experience.historicalComparison.limitations.length).toBeGreaterThanOrEqual(1);
  });
});
