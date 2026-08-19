export function requestIdFrom(request: Request): string {
  const candidate = request.headers.get("x-request-id");
  return candidate && /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : crypto.randomUUID();
}
