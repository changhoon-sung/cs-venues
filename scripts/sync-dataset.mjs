import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const upstream = "https://github.com/ccfddl/ccf-deadlines.git";
const sparsePaths = ["conference", "accept_rates"];
const dataRoot = join(root, "data", "ccfddl");
const tempRoot = await mkdtemp(join(tmpdir(), "ccfddl-"));
const checkout = join(tempRoot, "repo");

try {
  await run("git", [
    "clone",
    "--depth",
    "1",
    "--filter=blob:none",
    "--sparse",
    upstream,
    checkout,
  ]);
  await run("git", ["-C", checkout, "sparse-checkout", "set", ...sparsePaths]);

  const commit = await capture("git", ["-C", checkout, "rev-parse", "--short", "HEAD"]);

  for (const path of sparsePaths) {
    await rm(join(dataRoot, path), { recursive: true, force: true });
    await cp(join(checkout, path), join(dataRoot, path), { recursive: true });
  }

  console.log(`Synced CCFDDL data from ${upstream} @ ${commit.trim()}.`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "inherit"],
    });
    const chunks = [];

    child.stdout.on("data", (chunk) => {
      chunks.push(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}
