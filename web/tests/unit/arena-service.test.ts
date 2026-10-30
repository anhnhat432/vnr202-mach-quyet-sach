import { describe, expect, it } from "vitest";

import { answerBody, createCompetitionBody, idempotencyKey } from "@/features/arena/contracts/arena";
import { mapRpcError } from "@/features/arena/server/arena-service";

describe("database errors become stable API errors without raw SQL text", () => {
  it.each([
    [{ code: "QA409", message: "stale_session" }, 409, "stale_session"],
    [{ code: "QA409", message: "interaction_pending" }, 409, "interaction_pending"],
    [{ code: "QA410", message: "attempt_terminal" }, 410, "attempt_terminal"],
    [{ code: "QA404", message: "attempt_not_found" }, 404, "attempt_not_found"],
    [{ code: "QA422", message: "invalid_option" }, 422, "invalid_option"],
    [{ code: "55P03", message: 'canceling statement due to lock timeout on "attempts"' }, 503, "temporarily_unavailable"],
    [{ code: "QB002", message: "two_option_cap_unsatisfiable", details: "race needs 12" }, 503, "competition_not_ready"],
    [{ code: "42501", message: "actor_not_admin" }, 403, "forbidden"],
  ])("%j", (error, status, code) => {
    const mapped = mapRpcError(error);
    expect([mapped.status, mapped.code]).toEqual([status, code]);
    expect(mapped.message).not.toMatch(/attempts|race needs|SELECT|public\./);
  });

  it("passes the wait hint and the active attempt through details only", () => {
    expect(mapRpcError({ code: "QA425", message: "too_early", details: '{"availableInMs":240}' }).details).toEqual([{ field: "availableInMs", code: "wait", message: "240" }]);
    const active = mapRpcError({ code: "QA409", message: "another_attempt_active", details: '{"attemptId":"b8b6e9d0-0000-4000-8000-000000000000","game":"race"}' });
    expect(active.details?.map((d) => d.field)).toEqual(["attemptId", "game"]);
  });

  it("unknown failures are a generic 500", () => {
    const mapped = mapRpcError({ code: "XX000", message: "relation public.attempts does not exist" });
    expect([mapped.status, mapped.code, mapped.message]).toEqual([500, "internal_error", "Đã xảy ra lỗi."]);
  });
});

describe("request contracts are strict (LA-ANTI-003)", () => {
  const alloc = "b8b6e9d0-1111-4000-8000-000000000000";
  it("an answer carries only the question and the option", () => {
    expect(answerBody.safeParse({ allocationId: alloc, optionId: "b" }).success).toBe(true);
    for (const extra of [{ score: 10 }, { isCorrect: true }, { profileId: alloc }, { receivedAt: "2030-01-01T00:00:00Z" }, { remainingMs: 1 }]) {
      expect(answerBody.safeParse({ allocationId: alloc, optionId: "b", ...extra }).success).toBe(false);
    }
    expect(answerBody.safeParse({ allocationId: alloc, optionId: "B!" }).success).toBe(false);
  });

  it("idempotency keys are 8-80 URL-safe characters", () => {
    expect(idempotencyKey.safeParse("abcdefgh").success).toBe(true);
    for (const bad of ["short", "has space here", "x".repeat(81), "a;b;c;d;e;f"]) expect(idempotencyKey.safeParse(bad).success).toBe(false);
  });

  it("competition creation cannot carry rules the spec has fixed", () => {
    const base = { name: "Cuộc thi thử", kind: "rehearsal", opensAt: "2030-01-01T00:00:00Z", startDeadlineAt: "2030-01-01T01:00:00Z" };
    expect(createCompetitionBody.safeParse(base).success).toBe(true);
    for (const extra of [{ points: { easy: 500 } }, { boardCells: 25 }, { bombs: 9 }, { offsets: { raceNextMs: 100 } }, { state: "open" }]) {
      expect(createCompetitionBody.safeParse({ ...base, ...extra }).success).toBe(false);
    }
  });
});
