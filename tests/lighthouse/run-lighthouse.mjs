import { createServer } from "node:net";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const categories = ["performance", "accessibility", "best-practices", "seo"];
const root = new URL("../..", import.meta.url);
const viteCli = fileURLToPath(new URL("../../node_modules/vite/bin/vite.js", import.meta.url));
const lighthouseCli = fileURLToPath(new URL("../../node_modules/lighthouse/cli/index.js", import.meta.url));

const previewPort = await findFreePort();
const chromePort = await findFreePort();
const chromeProfile = await mkdtemp(join(tmpdir(), "cs-venue-lighthouse-"));

let preview;
let chrome;
let shuttingDown = false;

try {
  preview = spawn(process.execPath, [viteCli, "preview", "--host", "127.0.0.1", "--port", String(previewPort)], {
    cwd: fileURLToPath(root),
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOnFailure(preview, "preview");

  const origin = `http://127.0.0.1:${previewPort}/`;
  const url = `${origin}?q=&area=all&core=all&sort=remaining&dir=asc`;
  await waitForUrl(url);
  await waitForUrl(`${origin}robots.txt`);
  await waitForUrl(`${origin}llms.txt`);
  await waitForUrl(`${origin}sitemap.xml`);

  chrome = spawn(await lighthouseChromePath(), [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${chromeProfile}`,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOnFailure(chrome, "chrome");
  await waitForUrl(`http://127.0.0.1:${chromePort}/json/version`);

  const desktop = await runLighthouse("desktop", url, chromePort, ["--preset=desktop"]);
  const mobile = await runLighthouse("mobile", url, chromePort, []);

  printScores(desktop);
  printScores(mobile);

  assertPerfect(desktop);
  assertPerfect(mobile);
} finally {
  shuttingDown = true;
  preview?.kill("SIGTERM");
  chrome?.kill("SIGTERM");
  await rm(chromeProfile, { recursive: true, force: true });
}

async function runLighthouse(label, url, port, extraArgs) {
  const args = [
    lighthouseCli,
    url,
    `--port=${port}`,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    "--max-wait-for-load=15000",
    "--quiet",
    ...extraArgs,
  ];
  const { stdout, stderr, code } = await run(process.execPath, args);
  if (code !== 0) {
    throw new Error(`Lighthouse ${label} failed with exit code ${code}\n${stderr}\n${stdout}`);
  }
  return { label, report: JSON.parse(stdout) };
}

function printScores(result) {
  const version = result.report.lighthouseVersion;
  const scores = categories
    .map((category) => `${category}:${Math.round(result.report.categories[category].score * 100)}`)
    .join(" ");
  console.log(`${result.label} lighthouse=${version} ${scores}`);
}

function assertPerfect(result) {
  const failures = categories
    .map((category) => [category, Math.round(result.report.categories[category].score * 100)])
    .filter(([, score]) => score !== 100);
  if (!failures.length) return;
  const details = failures.map(([category, score]) => `${category}=${score}`).join(", ");
  throw new Error(`Lighthouse ${result.label} scores must all be 100: ${details}`);
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until the preview or Chrome debugging endpoint is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: fileURLToPath(root),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

async function lighthouseChromePath() {
  if (process.env.LIGHTHOUSE_CHROME_PATH) return process.env.LIGHTHOUSE_CHROME_PATH;

  const executablePath = chromium.executablePath();
  const match = executablePath.match(/^(.*)\/chromium-(\d+)\//);
  if (!match) return executablePath;

  const headlessShellRoot = join(match[1], `chromium_headless_shell-${match[2]}`);
  return await findExecutable(headlessShellRoot, new Set(["chrome-headless-shell", "chrome-headless-shell.exe"]))
    ?? executablePath;
}

async function findExecutable(dir, names) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isFile() && names.has(entry.name)) return path;
    if (entry.isDirectory()) {
      const found = await findExecutable(path, names);
      if (found) return found;
    }
  }
  return null;
}

function pipeOnFailure(child, label) {
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout?.on("data", () => {});
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code === 0 || signal === "SIGTERM") return;
    console.error(`${label} exited unexpectedly`, { code, signal });
    if (stderr.trim()) console.error(stderr.trim());
  });
}
