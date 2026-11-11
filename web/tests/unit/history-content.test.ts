import { describe, expect, it } from "vitest";
import { HISTORY_EVENTS } from "@/features/history/data";
import { HISTORY_PERIODS } from "@/features/history/domain";

describe("K01 history content contracts", () => {
  it("covers six periods with at least twenty distinct, chronologically ordered events", () => {
    expect(HISTORY_EVENTS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(HISTORY_EVENTS.map(e => e.id)).size).toBe(HISTORY_EVENTS.length);
    expect(HISTORY_EVENTS.map(e => e.date)).toEqual(HISTORY_EVENTS.map(e => e.date).sort());
    for (const period of HISTORY_PERIODS) expect(HISTORY_EVENTS.filter(e => e.period === period.id).length).toBeGreaterThanOrEqual(2);
  });
  it.each(HISTORY_EVENTS)("$id has complete recall material and attributable references", event => {
    const words = event.summary.trim().split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(40);
    expect(words).toBeLessThanOrEqual(80);
    for (const bullets of [event.context, event.keyDevelopments, event.significance]) {
      expect(bullets.length).toBeGreaterThanOrEqual(2);
      expect(bullets.length).toBeLessThanOrEqual(4);
    }
    expect(event.keywords.length).toBeGreaterThanOrEqual(3);
    expect(event.keywords.length).toBeLessThanOrEqual(5);
    expect(event.sources.length).toBeGreaterThan(0);
    for (const source of event.sources) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(source.scope.length).toBeGreaterThan(20);
      expect(source.publisher.length).toBeGreaterThan(3);
      expect(source.checkedAt).toBe("2026-11-11");
    }
    expect(event.quiz.length).toBeGreaterThanOrEqual(1);
    expect(event.quiz.length).toBeLessThanOrEqual(3);
    for (const quiz of event.quiz) {
      expect(Number.isInteger(quiz.answer)).toBe(true);
      expect(quiz.answer).toBeGreaterThanOrEqual(0);
      expect(quiz.answer).toBeLessThan(quiz.options.length);
      expect(new Set(quiz.options).size).toBe(quiz.options.length);
      expect(quiz.explanation.length).toBeGreaterThan(20);
    }
    for (const image of event.images) {
      expect(image.src.startsWith("/history/")).toBe(true);
      expect(image.credit).toBeTruthy();
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(image.license).toBeTruthy();
      expect(new URL(image.sourceUrl).hostname).toBe("commons.wikimedia.org");
    }
  });
});
