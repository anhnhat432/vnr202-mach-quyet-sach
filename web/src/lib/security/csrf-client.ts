export function readCsrfCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.split("; ").find((c) => c.startsWith("vnr_csrf="));
  return match ? decodeURIComponent(match.slice("vnr_csrf=".length)) : "";
}
