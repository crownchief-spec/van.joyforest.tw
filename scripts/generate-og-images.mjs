#!/usr/bin/env node
/** Build one public 1200x630 social image URL for every indexable HTML page. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SITE_ORIGIN } from "./seo-url-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MAP_PATH = path.join(ROOT, "seo-map.json");
const OUTPUT_DIR = path.join(ROOT, "assets", "images", "og");

function slugFor(page) {
  if (page.file === "index.html") return "zh--home";
  if (page.file === "en/index.html") return "en--home";
  return page.file
    .replace(/\/index\.html$/i, "")
    .replace(/\.html$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "--")
    .replace(/^-+|-+$/g, "");
}

function localPathFromUrl(url) {
  if (!url) return "";
  let pathname;
  try {
    const parsed = new URL(url, SITE_ORIGIN);
    if (parsed.origin !== SITE_ORIGIN) return "";
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return "";
  }
  return path.join(ROOT, pathname.replace(/^\/+/, ""));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const map = JSON.parse(await fs.readFile(MAP_PATH, "utf8"));
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let generated = 0;
  const missing = [];
  for (const page of map.pages || []) {
    if (page.noindex) continue;
    const sourceUrl = page.heroImage || page.ogImage;
    const source = localPathFromUrl(sourceUrl);
    if (!source || !(await exists(source))) {
      missing.push(`${page.file}: ${sourceUrl || "no hero/og image"}`);
      continue;
    }

    const filename = `${slugFor(page)}.jpg`;
    const output = path.join(OUTPUT_DIR, filename);
    if (path.resolve(source) !== path.resolve(output)) {
      await sharp(source)
        .rotate()
        .resize(1200, 630, { fit: "cover", position: "attention" })
        .flatten({ background: "#edf4ef" })
        .jpeg({ quality: 84, progressive: true, mozjpeg: true })
        .toFile(output);
    }

    page.ogImage = `${SITE_ORIGIN}/assets/images/og/${filename}`;
    page.ogImageOverride = true;
    generated++;
  }

  map.ogImageStrategy = {
    rule: "one dedicated 1200x630 asset per indexable page, generated from heroImage",
    preferredSize: "1200x630",
    mustBeAbsoluteUrl: true,
    uniquenessRequired: true
  };
  map.todo = [
    ...(map.todo || []).filter((item) => !String(item).startsWith("OG source missing:")),
    ...missing.map((item) => `OG source missing: ${item}`)
  ];
  await fs.writeFile(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`, "utf8");

  console.log(`[generate-og-images] Generated ${generated} unique social images`);
  if (missing.length) {
    console.error(`[generate-og-images] Missing source images: ${missing.length}`);
    missing.forEach((item) => console.error(`  - ${item}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
