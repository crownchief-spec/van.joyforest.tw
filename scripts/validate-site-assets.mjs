#!/usr/bin/env node
/** Validate local links, images, media, icons and OG assets referenced by final HTML. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SKIP_HTML, fileToRoute, walkHtml } from "./seo-page-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "https://van.joyforest.tw";

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function cleanUrl(value) {
  return String(value || "").trim().split("#")[0].split("?")[0];
}

function localTarget(value, pageFile) {
  let clean = cleanUrl(value);
  if (!clean || /^(?:mailto:|tel:|javascript:|data:|#)/i.test(clean)) return null;
  if (/^https?:\/\//i.test(clean)) {
    const url = new URL(clean);
    if (url.origin !== ORIGIN) return null;
    clean = url.pathname;
  }
  if (clean.startsWith("//")) return null;
  if (clean.startsWith("/")) return path.join(ROOT, decodeURIComponent(clean.slice(1)));
  return path.resolve(ROOT, path.dirname(pageFile), decodeURIComponent(clean));
}

function candidateFiles(target) {
  if (path.extname(target)) return [target];
  return [target, `${target}.html`, path.join(target, "index.html")];
}

async function main() {
  const pages = (await walkHtml(ROOT)).filter((file) => !SKIP_HTML.has(file));
  const failures = [];
  let checked = 0;

  for (const rel of pages) {
    const html = await fs.readFile(path.join(ROOT, rel), "utf8");
    const values = [];
    for (const match of html.matchAll(/\s(?:href|src|poster)="([^"]+)"/gi)) values.push(match[1]);
    for (const match of html.matchAll(/\ssrcset="([^"]+)"/gi)) {
      for (const item of match[1].split(",")) values.push(item.trim().split(/\s+/)[0]);
    }
    for (const match of html.matchAll(/url\(['"]?([^'")]+)['"]?\)/gi)) values.push(match[1]);

    for (const value of values) {
      const target = localTarget(value, rel);
      if (!target) continue;
      checked++;
      const candidates = candidateFiles(target);
      if (!(await Promise.all(candidates.map(exists))).some(Boolean)) {
        failures.push(`${rel}: ${value}`);
      }
    }
  }

  for (const required of ["favicon.ico", "manifest.webmanifest", "robots.txt", "sitemap.xml", "llms.txt"]) {
    checked++;
    if (!(await exists(path.join(ROOT, required)))) failures.push(`missing required file: ${required}`);
  }

  console.log(`[validate-site-assets] Checked ${checked} local references across ${pages.length} pages`);
  if (failures.length) {
    console.error(`[validate-site-assets] Broken references: ${failures.length}`);
    failures.slice(0, 80).forEach((item) => console.error(`  - ${item}`));
    process.exit(1);
  }
  console.log("[validate-site-assets] All local references resolve");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
