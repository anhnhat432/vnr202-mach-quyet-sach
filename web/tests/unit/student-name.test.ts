// @vitest-environment node
import { expect, it } from "vitest";
import { studentNameSchema } from "@/features/auth/domain/student-name";

it("normalizes a student-entered name and refuses actor/score fields", () => {
  expect(studentNameSchema.parse({ name: "  Nguyễn   Văn An  " })).toEqual({ name: "Nguyễn Văn An" });
  expect(studentNameSchema.safeParse({ name: "An", profileId: "someone-else" }).success).toBe(false);
  expect(studentNameSchema.safeParse({ name: "An", score: 100 }).success).toBe(false);
});

it("rejects empty, oversized and control-character names", () => {
  for (const name of [" ", "a".repeat(101), "An\nNguyen", "An\u0000"]) expect(studentNameSchema.safeParse({ name }).success).toBe(false);
  expect(studentNameSchema.safeParse({ name: "An" }).success).toBe(true);
});
