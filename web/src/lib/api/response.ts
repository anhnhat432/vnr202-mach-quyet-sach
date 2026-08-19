import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/errors";

export function ok<T>(data: T, requestId: string, init: ResponseInit = {}) {
  return NextResponse.json({ data, meta: { requestId } }, init);
}

export function fail(error: ApiError, requestId: string, init: ResponseInit = {}) {
  return NextResponse.json(
    {
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      meta: { requestId },
    },
    { ...init, status: error.status },
  );
}
