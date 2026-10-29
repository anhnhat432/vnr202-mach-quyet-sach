// Best-effort client identifiers for rate limiting and audit. Values are hashed before storage.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function deviceLabel(request: Request): string {
  return (request.headers.get("user-agent") ?? "unknown").slice(0, 300);
}
