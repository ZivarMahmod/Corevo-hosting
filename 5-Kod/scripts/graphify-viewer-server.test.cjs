const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const call = http.get({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      headers: { Host: `127.0.0.1:${port}` },
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    call.on("error", reject);
  });
}

async function waitForHealth(port) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const response = await request(port, "/health");
      if (response.status === 200) return;
    } catch {
      // The process may still be binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("Viewer server did not become healthy");
}

async function main() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "graphify-viewer-"));
  const port = await freePort();
  const serverScript = path.join(__dirname, "graphify-viewer-server.cjs");
  write(fixture, "tools/graphify-live/index.html", "viewer");
  write(fixture, "graphify-out/graph.html", "corevo graph");
  write(fixture, "graphify-out/5-Kod-callflow.html", "corevo callflow");
  write(fixture, "graphify-references/open-design/graphify-out/graph.html", "open design graph");
  write(fixture, "graphify-references/open-design/graphify-out/open-design-callflow.html", "open design callflow");
  write(fixture, "apps/web/.env.local", "must-not-leak");

  const child = spawn(process.execPath, [
    serverScript,
    "--port", String(port),
    "--code-root", fixture,
  ], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(port);
    assert.equal((await request(port, "/tools/graphify-live/")).status, 200);
    assert.equal((await request(port, "/graphify-out/graph.html")).status, 200);
    assert.equal(
      (await request(port, "/graphify-references/open-design/graphify-out/graph.html")).status,
      200,
    );
    assert.equal((await request(port, "/apps/web/.env.local")).status, 404);
    assert.equal((await request(port, "/../apps/web/.env.local")).status, 404);
  } finally {
    child.kill();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

main()
  .then(() => console.log("Graphify viewer allowlist self-check: OK"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
