#!/usr/bin/env node
/** Generate sitemap.xml with only final 200 canonical URLs */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN, toCanonicalUrl, shouldIndexPath } from "./seo-url-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITEMAP = path.join(ROOT, "sitemap.xml");

const EXCLUDE_FILES = new Set([
  "pages/guide.html",
  "pages/faq.html",
  "404.html",
  "en/404.html",
  "booking/index.html",
  "en/booking/index.html"
]);

async function walkHtml(dir, base = "") {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      out.push(...(await walkHtml(path.join(dir, e.name), rel)));
    } else if (e.isFile() && e.name.endsWith(".html")) {
      out.push(rel);
    }
  }
  return out;
}

function fileToPath(rel) {
  if (rel === "index.html") return "/";
  if (rel === "en/index.html") return "/en/";
  if (rel.endsWith("/")) {
    const dir = rel.slice(0, -"/".length);
    return toCanonicalUrl(`/${dir}/`).replace(SITE_ORIGIN, "");
  }
  return toCanonicalUrl(`/${rel}`).replace(SITE_ORIGIN, "");
}

async function getLastmod(rel) {
  const stat = await fs.stat(path.join(ROOT, rel));
  return stat.mtime.toISOString().slice(0, 10);
}

async function main() {
  const files = await walkHtml(ROOT);
  const entries = [];

  for (const rel of files) {
    if (EXCLUDE_FILES.has(rel)) continue;
    const pagePath = fileToPath(rel);
    if (!shouldIndexPath(pagePath)) continue;
    entries.push({ loc: toCanonicalUrl(pagePath), file: rel });
  }

  const unique = new Map();
  for (const e of entries) {
    if (!unique.has(e.loc)) unique.set(e.loc, e.file);
  }

  const sorted = [...unique.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];

  for (const [loc, file] of sorted) {
    const lastmod = await getLastmod(file);
    lines.push("  <url>");
    lines.push(`    <loc>${loc}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>", "");
  await fs.writeFile(SITEMAP, lines.join("\n"), "utf8");
  console.log(`[generate-sitemap] Wrote ${sorted.length} URLs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
