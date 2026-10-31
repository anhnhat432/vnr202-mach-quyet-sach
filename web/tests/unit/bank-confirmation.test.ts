import { describe, expect, it } from "vitest";
import { competitionTransitionBody } from "@/features/arena/contracts/arena";

describe("bank acknowledgement input", () => {
  it("accepts an explicit acknowledgement with an expected size and reason", () => {
    expect(competitionTransitionBody.safeParse({ target: "scheduled", bankAcknowledgement: { expectedAttempts: 60, confirmed: true, reason: "Đã xem rủi ro" } }).success).toBe(true);
  });
  it("rejects an acknowledgement without a reason and unknown fields", () => {
    expect(competitionTransitionBody.safeParse({ target: "scheduled", bankAcknowledgement: { expectedAttempts: 60, confirmed: true, reason: " " } }).success).toBe(false);
    expect(competitionTransitionBody.safeParse({ target: "scheduled", bankAcknowledgement: { expectedAttempts: 60, confirmed: true, reason: "đủ", bypass: true } }).success).toBe(false);
  });
});
