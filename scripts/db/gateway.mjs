// Minimal stand-in for Supabase's Kong gateway in the local harness:
// /auth/v1/* -> GoTrue, /rest/v1/* -> PostgREST. Keeps headers, adds CORS for local browsers.
import http from "node:http";

const routes = [
  ["/auth/v1", Number(process.env.GOTRUE_PORT)],
  ["/rest/v1", Number(process.env.POSTGREST_PORT)],
];
const port = Number(process.env.GATEWAY_PORT);

http
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
      { host: "127.0.0.1", port: target, method: req.method, path: req.url.slice(prefix.length) || "/", headers: { ...req.headers, host: `127.0.0.1:${target}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  })
  .listen(port, "127.0.0.1", () => console.log(`gateway listening on ${port}`));
