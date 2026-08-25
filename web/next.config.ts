import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

// Cho phép kết nối tới đúng project Supabase đã cấu hình (REST + Realtime WebSocket),
// dùng cho Giờ G bỏ phiếu trực tiếp. Không cấu hình thì connect-src giữ nguyên 'self'.
const supabaseConnectSources: string[] = [];
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
    supabaseConnectSources.push(`https://${host}`, `wss://${host}`);
  } catch {
    // URL không hợp lệ — bỏ qua, giữ CSP mặc định.
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  ["connect-src 'self'", ...supabaseConnectSources].join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ...(isDevelopment
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
