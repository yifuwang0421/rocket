/**
 * Cross-platform resources copy script
 */

import { existsSync, cpSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const ELECTRON_DIR = join(ROOT_DIR, "apps/electron");

const srcDir = join(ELECTRON_DIR, "resources");
const destDir = join(ELECTRON_DIR, "dist/resources");

if (existsSync(srcDir)) {
  rmSync(destDir, { recursive: true, force: true });
  cpSync(srcDir, destDir, { recursive: true, force: true });
  console.log("📦 Copied resources to dist");
} else {
  console.log("⚠️ No resources directory found");
}

const cliOutDir = join(destDir, "rocket-cli");
mkdirSync(cliOutDir, { recursive: true });

const cliBuild = await Bun.build({
  entrypoints: [join(ROOT_DIR, "apps/cli/src/index.ts")],
  outdir: cliOutDir,
  target: "bun",
  format: "esm",
  naming: "index.js",
});

if (!cliBuild.success) {
  for (const log of cliBuild.logs) {
    console.error(log);
  }
  throw new Error("Failed to build bundled Rocket CLI");
}

console.log("Bundled Rocket CLI");
