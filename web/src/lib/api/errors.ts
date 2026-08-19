export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Array<{ field: string; code: string; message: string }>,
  ) {
    super(message);
  }
}
