// Minimal stand-in for Supabase's Kong gateway in the local harness:
// /auth/v1/* -> GoTrue, /rest/v1/* -> PostgREST, and (when REALTIME_PORT is set) /realtime/v1/* ->
// Supabase Realtime, websockets included. Keeps headers, adds CORS for local browsers.
import http from "node:http";
import net from "node:net";

const realtimePort = Number(process.env.REALTIME_PORT || 0);
const routes = [
  ["/auth/v1", Number(process.env.GOTRUE_PORT)],
  ["/rest/v1", Number(process.env.POSTGREST_PORT)],
  ...(realtimePort ? [["/realtime/v1", realtimePort]] : []),
];
const port = Number(process.env.GATEWAY_PORT);
// Realtime resolves the tenant from the first label of the Host header (self-hosted tenant "realtime-dev").
const upstreamHost = (prefix, target) => (prefix === "/realtime/v1" ? `realtime-dev.localhost:${target}` : `127.0.0.1:${target}`);
const upstreamPath = (prefix, url) => {
  const rest = url.slice(prefix.length) || "/";
  return prefix === "/realtime/v1" && rest.startsWith("/websocket") ? `/socket${rest}` : rest;
};

const server = http
  .createServer((req, res) => {
    const route = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(`${prefix}/`) || req.url.startsWith(`${prefix}?`));
    const cors = {
      "access-control-allow-origin": req.headers.origin ?? "*",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, range",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end();
      return;
    }
    if (!route) {
      res.writeHead(404, { "content-type": "application/json", ...cors }).end('{"message":"no route"}');
      return;
    }
    const [prefix, target] = route;
    const upstream = http.request(
      { host: "127.0.0.1", port: target, method: req.method, path: upstreamPath(prefix, req.url), headers: { ...req.headers, host: upstreamHost(prefix, target) } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  })
  .listen(port, "127.0.0.1", () => console.log(`gateway listening on ${port}`));

server.on("upgrade", (req, socket, head) => {
  if (!realtimePort || !req.url.startsWith("/realtime/v1/")) return socket.destroy();
  const upstream = net.connect(realtimePort, "127.0.0.1", () => {
    const headers = { ...req.headers, host: upstreamHost("/realtime/v1", realtimePort) };
    const lines = [`${req.method} ${upstreamPath("/realtime/v1", req.url)} HTTP/1.1`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`)];
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});
