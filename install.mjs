#!/usr/bin/env node
/**
 * Automatic installer & launcher — needs only Node.js 18+.
 *
 *   node install.mjs            → install Bun (if missing) + deps, run tests, build
 *   node install.mjs start      → start the production server (auto-installs/builds first if needed)
 *   node install.mjs build      → build everything: .exe, React UI, plain-JS Node build (into dist/)
 *   node install.mjs build --platforms=windows,linux,mac
 *   node install.mjs --skip-tests
 *
 * Works on Windows, macOS and Linux. No curl / PowerShell / admin rights needed:
 * if a global Bun install is not allowed, Bun is installed locally into this project.
 */
import { spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const IS_WIN = process.platform === "win32";
const args = process.argv.slice(2);
const MODE = args.includes("start") ? "start" : args.includes("build") ? "build" : "install";
const PLATFORMS = args.find((a) => a.startsWith("--platforms=")) ?? "--platforms=windows,linux,mac";
const SKIP_TESTS = args.includes("--skip-tests");

const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` };
const step = (n, msg) => console.log(`\n${c.b(`[${n}]`)} ${msg}`);
const ok = (msg) => console.log(`    ${c.g("✔")} ${msg}`);
const warn = (msg) => console.log(`    ${c.y("!")} ${msg}`);
function fail(msg, hint) {
  console.error(`\n${c.r("✖ " + msg)}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

/** Run a command, streaming output. Returns true on success. */
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: opts.quiet ? "pipe" : "inherit", shell: IS_WIN, env: { ...process.env, ...opts.env } });
  return r.status === 0;
}

/** Run a command and capture stdout (null if it fails). */
function capture(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, encoding: "utf8", shell: IS_WIN });
  return r.status === 0 ? r.stdout.trim() : null;
}

// ---------------------------------------------------------------- checks
function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) fail(`Node.js ${process.versions.node} is too old.`, "Install Node.js 18 or newer from https://nodejs.org");
  ok(`Node.js ${process.versions.node}`);
}

/** Find a working Bun: PATH → npm global bin → project-local node_modules. */
function findBun() {
  const local = join(ROOT, "node_modules", ".bin", IS_WIN ? "bun.exe" : "bun");
  const localCmd = join(ROOT, "node_modules", ".bin", IS_WIN ? "bun.cmd" : "bun");
  const candidates = ["bun"];
  const prefix = capture(IS_WIN ? "npm.cmd" : "npm", ["prefix", "-g"]);
  if (prefix) candidates.push(IS_WIN ? join(prefix, "bun.cmd") : join(prefix, "bin", "bun"));
  candidates.push(local, localCmd);

  for (const cand of candidates) {
    if (cand !== "bun" && !existsSync(cand)) continue;
    const v = capture(IS_WIN && cand !== "bun" ? `"${cand}"` : cand, ["--version"]);
    if (v) return { bin: IS_WIN && cand !== "bun" ? `"${cand}"` : cand, version: v };
  }
  return null;
}

function ensureBun() {
  let bun = findBun();
  if (bun) {
    ok(`Bun ${bun.version} already installed`);
    return bun.bin;
  }

  const npm = IS_WIN ? "npm.cmd" : "npm";
  warn("Bun not found — installing it with npm (global)…");
  if (run(npm, ["install", "-g", "bun"])) bun = findBun();

  if (!bun) {
    warn("Global install not possible (permissions?) — installing Bun locally into this project…");
    // --prefix pins the install to this folder; clearing npm_config_prefix ignores a broken global setting.
    const localEnv = { npm_config_prefix: "", NPM_CONFIG_PREFIX: "" };
    if (!run(npm, ["install", "--prefix", ROOT, "--no-save", "--no-package-lock", "bun"], { env: localEnv })) {
      fail("Could not install Bun via npm.", "Check your internet connection, then run: node install.mjs");
    }
    bun = findBun();
  }
  if (!bun) fail("Bun was installed but could not be started.", "Try closing and reopening your terminal, then run: node install.mjs");
  ok(`Bun ${bun.version} installed`);
  return bun.bin;
}

// ---------------------------------------------------------------- flows
function install(bun) {
  step(3, "Installing project dependencies (bun install)…");
  if (!run(bun, ["install"])) fail("Dependency install failed.");
  ok("Dependencies installed");

  if (SKIP_TESTS) {
    step(4, "Skipping tests (--skip-tests)");
  } else {
    step(4, "Running test suite (bun test)…");
    if (!run(bun, ["test"])) fail("Tests failed — the bracket engine is not safe to run.", "Scroll up to see which test failed.");
    ok("All tests passed");
  }

  step(5, "Building production bundle…");
  if (!run(bun, ["scripts/build.ts", "web", "bun"])) fail("Build failed.");
  ok("Built the React UI + server (dist/bun)");
}

function start(bun) {
  const port = process.env.PORT ?? "3000";
  // Absolute path so the database lives in ./data (never inside dist/, which rebuilds wipe).
  // Inside the all-in-one folder (source/…), share ../data with the apps and the Node version.
  const inBundle = existsSync(join(ROOT, "..", "START-HERE.txt"));
  const dataDir = inBundle ? join(ROOT, "..", "data") : join(ROOT, "data");
  const dbFile = process.env.DB_FILE ?? join(dataDir, "bracket.sqlite");
  mkdirSync(dataDir, { recursive: true });

  step("▶", `Starting server on http://localhost:${port}  (database: ${dbFile})`);
  console.log(`    Press ${c.b("Ctrl+C")} to stop.\n`);
  // The bundled server loads its UI files relative to its own folder, so run it from there.
  const child = spawn(bun, ["server.js"], {
    cwd: join(ROOT, "dist", "bun"),
    stdio: "inherit",
    shell: IS_WIN,
    env: { ...process.env, NODE_ENV: "production", PORT: port, DB_FILE: dbFile },
  });
  const stop = () => child.kill("SIGTERM");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.on("exit", (code) => process.exit(code ?? 0));
}

// ---------------------------------------------------------------- main
console.log(c.b("\n🏆 Bracket Engine — automatic setup\n"));
step(1, "Checking Node.js…");
checkNode();
step(2, "Checking Bun…");
const bun = ensureBun();

if (MODE === "install") {
  install(bun);
  console.log(`\n${c.g(c.b("✅ Setup complete!"))}\n\n  Start the server with:  ${c.b("node install.mjs start")}\n  Then open:              ${c.b("http://localhost:3000/health")}\n`);
} else if (MODE === "build") {
  if (!existsSync(join(ROOT, "node_modules"))) install(bun);
  step(6, "Building all outputs (.exe, React UI, plain JS for Node)…");
  if (!run(bun, ["scripts/build.ts", "all", PLATFORMS])) fail("Build failed.");
  console.log(`\n${c.g(c.b("✅ Builds ready in the dist/ folder:"))}
  ${c.b("dist/BracketEngine-AllInOne.zip")}   ⭐ everything in one download (apps + Node + source + launchers)
  ${c.b("dist/exe/")}   standalone app — double-click BracketEngine-windows-x64.exe
  ${c.b("dist/web/")}   React UI (static files)
  ${c.b("dist/node/")}  plain JavaScript — run with: cd dist/node && npm install && npm start
  ${c.b("dist/bun/")}   Bun server bundle — run with: node install.mjs start
`);
} else {
  if (!existsSync(join(ROOT, "dist", "bun", "server.js")) || !existsSync(join(ROOT, "node_modules"))) {
    warn("Project not set up yet — running setup first…");
    install(bun);
  }
  start(bun);
}
