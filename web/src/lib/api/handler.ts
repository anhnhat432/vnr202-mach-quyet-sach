import { ZodError, type ZodType } from "zod";

import { ApiError } from "@/lib/api/errors";
import { requestIdFrom } from "@/lib/api/request-id";
import { fail } from "@/lib/api/response";
import { RosterFileError } from "@/features/roster/domain/csv";
import { RosterHeaderError } from "@/features/roster/domain/roster-table";

// Wraps a route: request id, uniform error envelope, no internal details in responses.
export function route(handler: (request: Request, requestId: string) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const requestId = requestIdFrom(request);
    try {
      const response = await handler(request, requestId);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export function errorResponse(error: unknown, requestId: string): Response {
  let apiError: ApiError;
  if (error instanceof ApiError) apiError = error;
  else if (error instanceof ZodError) {
    apiError = new ApiError(
      422,
      "validation_error",
      "Yêu cầu không hợp lệ.",
      error.issues.slice(0, 20).map((issue) => ({ field: issue.path.join("."), code: issue.code, message: "Giá trị không hợp lệ." })),
    );
  } else if (error instanceof RosterFileError) {
    const message: Record<RosterFileError["code"], string> = {
      file_too_large: "Tệp vượt giới hạn kích thước.",
      invalid_encoding: "Tệp phải mã hóa UTF-8.",
      malformed_file: "Tệp không đọc được.",
      unsupported_format: "Chỉ hỗ trợ tệp .xlsx hoặc .csv.",
      legacy_or_encrypted: "Tệp là .xls cũ hoặc có mật khẩu. Hãy lưu lại thành .xlsx không mật khẩu.",
    };
    apiError = new ApiError(422, "validation_error", message[error.code], [{ field: "file", code: error.code, message: message[error.code] }]);
  } else if (error instanceof RosterHeaderError) {
    apiError = new ApiError(422, "validation_error", "Thiếu cột MSSV hoặc Họ tên.", [{ field: "file", code: error.code, message: "Cần cột MSSV và Họ tên." }]);
  } else {
    console.error("unhandled route error", { requestId, name: error instanceof Error ? error.name : typeof error });
    apiError = new ApiError(500, "internal_error", "Đã xảy ra lỗi.");
  }
  const response = fail(apiError, requestId);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Nội dung không phải JSON hợp lệ.");
  }
  return schema.parse(body);
}
