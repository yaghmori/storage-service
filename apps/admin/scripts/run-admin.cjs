#!/usr/bin/env node
/**
 * Start Next admin with PORT / ADMIN_PORT / DEBUG_PORT from env (.env loaded here).
 * Usage: node scripts/run-admin.cjs [dev|start|dev:debug]
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function resolveNextBin(cwd) {
  try {
    return require.resolve("next/dist/bin/next", { paths: [cwd] });
  } catch {
    try {
      return require.resolve("next/dist/bin/next", {
        paths: [path.join(cwd, "../..")],
      });
    } catch {
      return null;
    }
  }
}

const root = path.resolve(__dirname, "..");
loadDotEnv(path.join(root, ".env.local"));
loadDotEnv(path.join(root, ".env"));

const mode = process.argv[2] || "dev";
const port = String(
  parseInt(process.env.PORT || process.env.ADMIN_PORT || "3203", 10) || 3203,
);
const debugPort = String(
  parseInt(process.env.DEBUG_PORT || process.env.ADMIN_DEBUG_PORT || "9203", 10) ||
    9203,
);

process.env.PORT = port;

const nextBin = resolveNextBin(root);
if (!nextBin) {
  console.error(
    "Could not resolve next binary. Run pnpm install from the monorepo root.",
  );
  process.exit(1);
}

const args = [nextBin, mode === "start" ? "start" : "dev", "-p", port];

const env = { ...process.env };
if (mode === "dev:debug") {
  const inspect = `--inspect=${debugPort}`;
  env.NODE_OPTIONS = env.NODE_OPTIONS
    ? `${env.NODE_OPTIONS} ${inspect}`
    : inspect;
}

const child = spawn(process.execPath, args, {
  cwd: root,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
