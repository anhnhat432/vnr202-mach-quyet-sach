import { ApiError } from "@/lib/api/errors";
import type { ZodType } from "zod";

// Path parameters are read from the URL (Next passes them asynchronously; the wrapper keeps routes
// to a single signature). `fromEnd` counts path segments from the end, 0 = last.
export function pathParam<T>(request: Request, fromEnd: number, schema: ZodType<T>): T {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const parsed = schema.safeParse(segments.at(-1 - fromEnd));
  if (!parsed.success) throw new ApiError(404, "not_found", "Không tìm thấy.");
  return parsed.data;
}

export function idempotencyKeyFrom(request: Request, schema: ZodType<string>): string {
  const parsed = schema.safeParse(request.headers.get("idempotency-key"));
  if (!parsed.success) throw new ApiError(422, "validation_error", "Thiếu hoặc sai tiêu đề Idempotency-Key.", [{ field: "Idempotency-Key", code: "invalid", message: "Giá trị không hợp lệ." }]);
  return parsed.data;
}
