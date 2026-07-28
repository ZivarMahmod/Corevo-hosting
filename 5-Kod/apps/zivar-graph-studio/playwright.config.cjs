const os = require("node:os");
const path = require("node:path");
const { defineConfig } = require("@playwright/test");

const externalUrl = process.env.ZIVAR_STUDIO_URL;
const baseURL = externalUrl || "http://127.0.0.1:8770";
const workspace = path.resolve(__dirname, "..", "..", "..");
const stateFile = path.join(os.tmpdir(), `zivar-graph-studio-e2e-${process.pid}.json`);

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: externalUrl ? undefined : {
    command: `node local-server.cjs --port 8770 --workspace "${workspace}" --state-file "${stateFile}"`,
    cwd: __dirname,
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
