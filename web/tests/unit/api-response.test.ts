import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/response";

describe("API response envelope", () => {
  it("wraps success with request ID", async () => {
    const response = ok({ value: 1 }, "req-1");
    expect(await response.json()).toEqual({ data: { value: 1 }, meta: { requestId: "req-1" } });
  });

  it("does not expose internal error details", async () => {
    const response = fail(new ApiError(422, "validation_error", "Yêu cầu không hợp lệ."), "req-2");
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "validation_error", message: "Yêu cầu không hợp lệ." },
      meta: { requestId: "req-2" },
    });
  });
});
