const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const argv = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const port = Number(argument("--port", "8765"));
const codeRoot = path.resolve(argument("--code-root", path.join(__dirname, "..")));
const routes = new Map([
  ["/tools/graphify-live/", ["tools/graphify-live/index.html", "text/html; charset=utf-8"]],
  ["/tools/graphify-live/index.html", ["tools/graphify-live/index.html", "text/html; charset=utf-8"]],
  ["/graphify-out/graph.html", ["graphify-out/graph.html", "text/html; charset=utf-8"]],
  ["/graphify-out/5-Kod-callflow.html", ["graphify-out/5-Kod-callflow.html", "text/html; charset=utf-8"]],
  [
    "/graphify-references/open-design/graphify-out/graph.html",
    ["graphify-references/open-design/graphify-out/graph.html", "text/html; charset=utf-8"],
  ],
  [
    "/graphify-references/open-design/graphify-out/open-design-callflow.html",
    ["graphify-references/open-design/graphify-out/open-design-callflow.html", "text/html; charset=utf-8"],
  ],
]);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Viewer-porten måste vara mellan 1 och 65535.");
}

function reply(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    reply(response, 405, "Method Not Allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  } catch {
    reply(response, 400, "Bad Request");
    return;
  }

  if (pathname === "/health") {
    reply(response, 200, request.method === "HEAD" ? "" : '{"ok":true}', "application/json; charset=utf-8");
    return;
  }

  const route = routes.get(pathname);
  if (!route) {
    reply(response, 404, "Not Found");
    return;
  }

  const [relativePath, contentType] = route;
  const file = path.join(codeRoot, relativePath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    reply(response, 404, "Not Found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
